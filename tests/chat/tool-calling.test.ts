import { describe, expect, it } from 'vitest';

import { proposeFollowupsTool } from '@/ai/skills/propose_followups';
import { showSourcesTool } from '@/ai/skills/show_sources';
import { refuseAndRedirectTool } from '@/ai/skills/refuse_and_redirect';
import { renderQcmTool } from '@/ai/skills/render_qcm';
import { allowed_personas as followupPersonas } from '@/ai/skills/propose_followups';
import { allowed_personas as sourcesPersonas } from '@/ai/skills/show_sources';
import { allowed_personas as refusePersonas } from '@/ai/skills/refuse_and_redirect';
import { allowed_personas as qcmPersonas } from '@/ai/skills/render_qcm';
import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

/**
 * Tests des 4 skills (tool-calling natif, 04_CHATBOT §8).
 * Matrice persona × outil : public n'a pas render_qcm.
 * refuse_and_redirect retourne toujours CANONICAL_REFUSAL.
 */
describe('skills — matrice persona × outil', () => {
  it('propose_followups autorise tous les personas', () => {
    expect(followupPersonas).toContain('public');
    expect(followupPersonas).toContain('student');
    expect(followupPersonas).toContain('professional');
  });

  it('show_sources autorise tous les personas', () => {
    expect(sourcesPersonas).toContain('public');
    expect(sourcesPersonas).toContain('student');
    expect(sourcesPersonas).toContain('professional');
  });

  it('refuse_and_redirect autorise tous les personas', () => {
    expect(refusePersonas).toContain('public');
    expect(refusePersonas).toContain('student');
    expect(refusePersonas).toContain('professional');
  });

  it('render_qcm reserve au persona student uniquement', () => {
    expect(qcmPersonas).toContain('student');
    expect(qcmPersonas).not.toContain('public');
    expect(qcmPersonas).not.toContain('professional');
  });
});

describe('skills — schemas et execute', () => {
  it('propose_followups a un inputSchema et un execute', () => {
    expect(proposeFollowupsTool.inputSchema).toBeDefined();
    expect(typeof proposeFollowupsTool.execute).toBe('function');
  });

  it('show_sources a un inputSchema et un execute', () => {
    expect(showSourcesTool.inputSchema).toBeDefined();
    expect(typeof showSourcesTool.execute).toBe('function');
  });

  it('refuse_and_redirect a un inputSchema et un execute', () => {
    expect(refuseAndRedirectTool.inputSchema).toBeDefined();
    expect(typeof refuseAndRedirectTool.execute).toBe('function');
  });

  it('render_qcm a un inputSchema et un execute', () => {
    expect(renderQcmTool.inputSchema).toBeDefined();
    expect(typeof renderQcmTool.execute).toBe('function');
  });

  it('refuse_and_redirect — execute retourne CANONICAL_REFUSAL exact', async () => {
    const exec = refuseAndRedirectTool.execute!;
    const result = await exec(
      { reason: 'personal_symptoms', redirect_target: 'doctor' },
      { toolCallId: 'test', messages: [] },
    );
    expect((result as any).message).toBe(CANONICAL_REFUSAL);
    expect((result as any).reason).toBe('personal_symptoms');
  });
});
