import { describe, expect, it } from 'vitest';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';
import { gateUiMessageStream, type GateReport, SAFE_MARGIN } from '@/ai/guardrails/streamGate';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function* fromArray(chunks: any[]): AsyncGenerator<any> {
  for (const c of chunks) yield c;
}

let counter = 0;
const genId = () => `id-${counter++}`;

async function run(chunks: any[]): Promise<{ out: any[]; report: GateReport }> {
  counter = 0;
  const report: GateReport = { blocked: false, fullText: '' };
  const out: any[] = [];
  for await (const c of gateUiMessageStream(fromArray(chunks), genId, report)) {
    out.push(c);
  }
  return { out, report };
}

const releasedText = (out: any[]) =>
  out
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');

const isRefusal = (out: any[]) =>
  out.some((c) => c.type === 'tool-output-available' && c.output?.message === CANONICAL_REFUSAL);

// Un texte assez long pour dépasser la marge et être libéré progressivement.
const LONG = 'L’hypertension artérielle correspond à une élévation durable de la pression. '.repeat(3);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('gateUiMessageStream — validation incrémentale (couche 3 streaming)', () => {
  it('laisse passer un texte bénin et le restitue intégralement', async () => {
    const { out, report } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: LONG.slice(0, 100) },
      { type: 'text-delta', id: 't1', delta: LONG.slice(100) },
      { type: 'text-end', id: 't1' },
    ]);

    expect(report.blocked).toBe(false);
    expect(isRefusal(out)).toBe(false);
    expect(releasedText(out)).toBe(LONG);
    // Part texte ouverte puis fermée.
    expect(out[0]).toMatchObject({ type: 'text-start', id: 't1' });
    expect(out.at(-1)).toMatchObject({ type: 'text-end', id: 't1' });
  });

  it('diffuse progressivement : du texte est libéré AVANT le text-end', async () => {
    const { out } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: LONG },
      { type: 'text-end', id: 't1' },
    ]);

    const endIdx = out.findIndex((c) => c.type === 'text-end');
    const releasedBeforeEnd = out
      .slice(0, endIdx)
      .filter((c) => c.type === 'text-delta')
      .map((c) => c.delta)
      .join('');
    // La marge de sûreté est gardée en réserve, mais le gros du texte sort avant la fin.
    expect(releasedBeforeEnd.length).toBeGreaterThan(LONG.length - SAFE_MARGIN - 1);
  });

  it('bloque dès qu’un marqueur diagnostique apparaît et n’affiche jamais le marqueur', async () => {
    const { out, report } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Bonjour, ' },
      { type: 'text-delta', id: 't1', delta: 'vous avez probablement une otite.' },
      { type: 'text-end', id: 't1' },
    ]);

    expect(report.blocked).toBe(true);
    expect(isRefusal(out)).toBe(true);
    // Le marqueur n’apparaît dans AUCUN texte diffusé.
    expect(releasedText(out).toLowerCase()).not.toContain('vous avez probablement');
  });

  it('supprime les tool-calls (sources/suggestions) émis après un blocage', async () => {
    const { out } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'votre diagnostic est une migraine.' },
      { type: 'text-end', id: 't1' },
      { type: 'tool-input-available', toolCallId: 'x', toolName: 'show_sources', input: {} },
      { type: 'tool-output-available', toolCallId: 'x', output: { citations: [{ title: 'X' }] } },
    ]);

    // Aucune citation source ne doit fuiter après un refus.
    expect(out.some((c) => c.toolName === 'show_sources')).toBe(false);
    expect(out.some((c) => c.output?.citations)).toBe(false);
  });

  it('transmet les tool-calls dans une réponse bénigne', async () => {
    const { out, report } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Une migraine est une affection fréquente.' },
      { type: 'text-end', id: 't1' },
      { type: 'tool-input-available', toolCallId: 'x', toolName: 'show_sources', input: {} },
      { type: 'tool-output-available', toolCallId: 'x', output: { citations: [{ title: 'HAS' }] } },
    ]);

    expect(report.blocked).toBe(false);
    expect(out.some((c) => c.toolName === 'show_sources')).toBe(true);
    expect(out.some((c) => c.output?.citations)).toBe(true);
  });

  it('décision identique à la validation bufferisée : un marqueur en fin de texte est bloqué', async () => {
    const tail = "Après analyse, votre diagnostic est une migraine.";
    const { out, report } = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: LONG },
      { type: 'text-delta', id: 't1', delta: tail },
      { type: 'text-end', id: 't1' },
    ]);

    expect(report.blocked).toBe(true);
    expect(isRefusal(out)).toBe(true);
    expect(releasedText(out).toLowerCase()).not.toContain('votre diagnostic est');
  });
});
