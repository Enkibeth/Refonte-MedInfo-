import { describe, expect, it } from 'vitest';

import { getActivePrompt } from '@/ai/prompts/index';
import { isExplicitFictiveEducationalCase, screenConversation } from '@/ai/orchestrator';
import { getToolsForPersona, VALID_PERSONAS } from '../../app/api/chat+api';

describe('étape 6 — prompt student.v2', () => {
  it('active le prompt student v2 conforme au contrat 04_CHATBOT §6', () => {
    const prompt = getActivePrompt('student');

    expect(prompt.id).toBe('student');
    expect(prompt.version).toBe('2.1.0');
    expect(prompt.regulatory_scope).toBe('non-MDSW · éducatif (cas fictifs)');
    expect(prompt.contract.forbidden_outputs).toEqual(
      expect.arrayContaining(['real_patient_case_analysis', 'individualized_diagnosis', 'sycophancy']),
    );
    expect(prompt.contract.mandatory_refusal_patterns).toEqual(
      expect.arrayContaining(['real_patient_case', 'personal_symptoms', 'individual_advice']),
    );
    expect(prompt.template).toContain('render_qcm');
    expect(prompt.template).toContain('EXPLICITEMENT fictif et pédagogique');
    expect(prompt.template).toContain('Les sources disponibles ne permettent pas de répondre avec certitude.');
  });
});

describe('étape 6 — matrice tools /api/chat', () => {
  it('accepte public + student, sans activer professional dans la route MVP', () => {
    expect(VALID_PERSONAS).toEqual(['public', 'student']);
  });

  it('public ne reçoit jamais render_qcm', () => {
    expect(Object.keys(getToolsForPersona('public'))).toEqual([
      'propose_followups',
      'show_sources',
      'refuse_and_redirect',
    ]);
  });

  it('student reçoit render_qcm en plus des outils communs', () => {
    expect(Object.keys(getToolsForPersona('student'))).toEqual([
      'propose_followups',
      'show_sources',
      'refuse_and_redirect',
      'render_qcm',
    ]);
  });
});

describe('étape 6 — cas fictifs étudiants vs cas réels', () => {
  it('autorise uniquement un cas clinique explicitement fictif/pédagogique pour student', async () => {
    const text = 'Cas clinique fictif pédagogique EDN : un patient de 58 ans présente une douleur thoracique. Fais un QCM sourcé.';

    expect(isExplicitFictiveEducationalCase(text)).toBe(true);
    const screen = await screenConversation([{ role: 'user', content: text }], {
      allowFictiveEducationalCases: true,
    });
    expect(screen.allowed).toBe(true);
  });

  it('bloque le même cas fictif si la route ne passe pas par le persona student', async () => {
    const text = 'Cas clinique fictif pédagogique EDN : un patient de 58 ans présente une douleur thoracique. Fais un QCM sourcé.';

    const screen = await screenConversation([{ role: 'user', content: text }]);
    expect(screen.allowed).toBe(false);
  });

  it('refuse un cas patient réel ou anonymisé même en persona student', async () => {
    const text = 'Cas clinique fictif pédagogique EDN inspiré d’un vrai patient anonymisé vu en stage : que faire ?';

    expect(isExplicitFictiveEducationalCase(text)).toBe(false);
    const screen = await screenConversation([{ role: 'user', content: text }], {
      allowFictiveEducationalCases: true,
    });
    expect(screen.allowed).toBe(false);
  });
});
