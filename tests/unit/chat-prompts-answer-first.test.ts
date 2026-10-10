import { describe, it, expect } from 'vitest';

import { PUBLIC_PROMPT_V3 } from '@/ai/prompts/public.v3';
import { STUDENT_PROMPT_V4 } from '@/ai/prompts/student.v4';
import { PROFESSIONAL_PROMPT_V2 } from '@/ai/prompts/professional.v2';
import { isUppercaseHeading, sectionKindOf } from '@/ai/chat/parseAssistantMessage';

/**
 * Révision « répondre d'abord » (ADR-0046) : les chatbots doivent répondre sur le fond
 * dès le premier message, prendre position, et dérouler une trame complète quand une
 * pathologie est en jeu. Ces tests empêchent le retour du questionnaire-barrière qui
 * produisait, en prod, des premières réponses composées uniquement de questions.
 */
describe('prompts du chat — répondre d’abord', () => {
  it('grand public : plus aucune consigne qui interdit de répondre avant un questionnaire', () => {
    expect(PUBLIC_PROMPT_V3).not.toMatch(/tu ne réponds pas/i);
    expect(PUBLIC_PROMPT_V3).not.toMatch(/RECUEIL MINIMUM OBLIGATOIRE/);
    expect(PUBLIC_PROMPT_V3).not.toMatch(/POSER DES QUESTIONS D'ABORD/);
    expect(PUBLIC_PROMPT_V3).not.toMatch(/MODE QUESTIONS/);
    expect(PUBLIC_PROMPT_V3).not.toMatch(/POUR MIEUX VOUS AIDER/);
    expect(PUBLIC_PROMPT_V3).toMatch(/RÉPONDRE D'ABORD, PRÉCISER ENSUITE/);
    expect(PUBLIC_PROMPT_V3).toMatch(/Une réponse composée seulement de questions est interdite/);
  });

  it('grand public : la sécurité est conservée', () => {
    expect(PUBLIC_PROMPT_V3).toMatch(/RÈGLE DES SIGNES SENTINELLES/);
    expect(PUBLIC_PROMPT_V3).toMatch(/Appelez immédiatement le 15/);
    expect(PUBLIC_PROMPT_V3).toMatch(/ne pas poser de diagnostic certain/);
    expect(PUBLIC_PROMPT_V3).toMatch(/ne pas donner de posologies détaillées/);
    expect(PUBLIC_PROMPT_V3).toMatch(/jamais d'un diagnostic certain pour cette personne/);
  });

  it('grand public : trame pathologie complète, titres lisibles par le parseur', () => {
    const headings = [
      "C'EST QUOI ?",
      'QUI EST CONCERNÉ ?',
      'POURQUOI ET COMMENT CELA ARRIVE',
      'LES SYMPTÔMES',
      'COMMENT CELA ÉVOLUE',
      'CE QUI PEUT Y RESSEMBLER',
      'COMMENT ON LE DIAGNOSTIQUE',
      'COMMENT ON LE SOIGNE',
      'PRÉVENTION ET VIE QUOTIDIENNE',
      'QUAND CONSULTER OU APPELER LE 15',
      "COMPRENDRE L'EXPLICATION LA PLUS PROBABLE",
    ];
    const lines = PUBLIC_PROMPT_V3.split('\n').map((l) => l.trim());
    for (const h of headings) {
      expect(lines).toContain(h);
      // Titre de corps : borne bien une section, sans être pris pour une section de fin.
      expect(isUppercaseHeading(h)).toBe(true);
      expect(sectionKindOf(h)).toBeNull();
    }
  });

  it('grand public : le titre QUESTIONS_PATIENT reste exact (sinon le parseur ne le reconnaît plus)', () => {
    const lines = PUBLIC_PROMPT_V3.split('\n').filter((l) => l.trim().startsWith('QUESTIONS_PATIENT'));
    for (const l of lines) expect(sectionKindOf(l)).toBe('questionsPatient');
  });

  it('étudiant : réponse d’abord, trame obligatoire et première intention explicite', () => {
    expect(STUDENT_PROMPT_V4).toMatch(/RÉPONDRE D'ABORD — RÈGLE PRIORITAIRE/);
    expect(STUDENT_PROMPT_V4).toMatch(/TRAME OBLIGATOIRE POUR UNE PATHOLOGIE/);
    expect(STUDENT_PROMPT_V4).not.toMatch(/clarifie le contexte \(spécialité, niveau, informations manquantes\)/);
    for (const part of ['Épidémiologie', 'Physiopathologie', 'Diagnostics différentiels', 'Évolution, complications', 'PREMIÈRE INTENTION', 'Prévention']) {
      expect(STUDENT_PROMPT_V4).toContain(part);
    }
  });

  it('professionnel : prise de position, pas de clarification préalable, trame pathologie', () => {
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/PRISE DE POSITION — RÈGLE PRIORITAIRE/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/Ne jamais conditionner la réponse à une clarification/);
    expect(PROFESSIONAL_PROMPT_V2).not.toMatch(/Clarifier seulement si une donnée manquante/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/TRAME PATHOLOGIE/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/au minimum de niveau 2 et suit la TRAME PATHOLOGIE/);
  });

  it('professionnel : spécificité clinique (nommer, chiffrer) sans renoncer à l’abstention ciblée', () => {
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/SPÉCIFICITÉ CLINIQUE — RÈGLE PRIORITAIRE/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/Ne jamais écrire qu’aucune posologie ou stratégie ne peut être proposée/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/applique la règle d’abstention à CETTE valeur uniquement/);
    // L'abstention reste en place : une valeur introuvable n'est jamais inventée.
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/RÈGLE D’ABSTENTION/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/« Le choix dépend de l’indication » n’est jamais une conduite recommandée/);
  });

  it('professionnel : triage « indéterminé » proscrit, INTERACTION facultative et bornée', () => {
    expect(PROFESSIONAL_PROMPT_V2).not.toMatch(/Toujours expliciter le triage clinique à partir des seules données fournies/);
    expect(PROFESSIONAL_PROMPT_V2).not.toMatch(/INTERACTION\s+Section obligatoire/);
    expect(PROFESSIONAL_PROMPT_V2).not.toMatch(/^- données critiques manquantes$/m);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/Section FACULTATIVE/);
    expect(PROFESSIONAL_PROMPT_V2).toMatch(/Au plus 2 questions/);
    for (const h of ['DÉFINITION ET ÉPIDÉMIOLOGIE', 'PHYSIOPATHOLOGIE', 'DIAGNOSTIC POSITIF', 'DIAGNOSTICS DIFFÉRENTIELS', 'ÉVOLUTION ET COMPLICATIONS', 'PRISE EN CHARGE', 'PRÉVENTION ET SUIVI']) {
      expect(PROFESSIONAL_PROMPT_V2).toMatch(new RegExp(`^- ${h}( :|$)`, 'm'));
    }
  });

  it('étudiant : démarche de clinicien, jamais des conseils grand public', () => {
    expect(STUDENT_PROMPT_V4).toMatch(/Tu t'adresses à un futur médecin, jamais à un patient ou à un parent/);
  });

  it('grand public : références inline en (SRCx), jamais de lien dans le corps', () => {
    expect(PUBLIC_PROMPT_V3).toMatch(/les références s'écrivent \(SRC1\) ou \(SRC1, SRC2\) : jamais entre crochets/);
  });
});
