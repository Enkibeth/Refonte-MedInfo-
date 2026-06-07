/**
 * Modèles de compte rendu médical — logique PURE, testée dans
 * tests/unit/report-templates.test.ts. Inspiré des « decks » de QCM-quizz :
 * l'utilisateur choisit un gabarit avant la génération.
 *
 * Chaque modèle ne fait qu'orienter la STRUCTURE de mise en forme. Garde-fou
 * transversal (cohérent avec ADR-0006, module CR pro) : l'IA met en forme ce que
 * le médecin a dicté/saisi, elle n'ajoute aucune donnée clinique non fournie et
 * ne propose aucune décision. Le professionnel valide systématiquement.
 */
export interface ReportTemplate {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** Consigne ajoutée au prompt système pour orienter la structure du CR. */
  instruction: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'auto',
    emoji: '✨',
    label: 'Automatique',
    description: 'Structure adaptée au contenu dicté.',
    instruction:
      'MODÈLE : structure libre. Choisis les sections les plus adaptées au contenu réel ' +
      '(ex. Motif de consultation, Anamnèse, Examen clinique, Conclusion, Conduite à tenir).',
  },
  {
    id: 'consultation',
    emoji: '🩺',
    label: 'Consultation',
    description: 'CR de consultation classique.',
    instruction:
      'MODÈLE : compte rendu de consultation, dans cet ordre quand l\'information existe — ' +
      '## Motif de consultation, ## Antécédents, ## Histoire de la maladie, ## Examen clinique, ' +
      '## Conclusion, ## Conduite à tenir. N\'invente aucune section sans contenu.',
  },
  {
    id: 'courrier',
    emoji: '✉️',
    label: 'Courrier au confrère',
    description: 'Lettre adressée à un médecin correspondant.',
    instruction:
      'MODÈLE : courrier médical à un confrère. Commence par « Cher Confrère, Chère Consœur, », ' +
      'rédige une synthèse en paragraphes (motif, éléments cliniques, conclusion, conduite à tenir ' +
      'et suivi proposé), puis termine par une formule de politesse. Laisse en clair les champs non ' +
      'dictés (ex. « [Nom du correspondant] ») sans les inventer.',
  },
  {
    id: 'operatoire',
    emoji: '🔪',
    label: 'CR opératoire',
    description: 'Compte rendu d\'un geste / intervention.',
    instruction:
      'MODÈLE : compte rendu opératoire — ## Indication, ## Installation et anesthésie, ' +
      '## Voie d\'abord, ## Description du geste, ## Incidents / Difficultés, ## Suites immédiates, ' +
      '## Consignes post-opératoires. Ne documente que les temps réellement décrits.',
  },
  {
    id: 'observation',
    emoji: '📋',
    label: 'Observation d\'entrée',
    description: 'Observation médicale d\'hospitalisation.',
    instruction:
      'MODÈLE : observation médicale d\'entrée — ## Motif d\'hospitalisation, ## Antécédents, ' +
      '## Histoire de la maladie, ## Examen clinique d\'entrée, ## Hypothèses diagnostiques, ' +
      '## Examens demandés, ## Plan de prise en charge.',
  },
  {
    id: 'ordonnance',
    emoji: '💊',
    label: 'Mise en forme d\'ordonnance',
    description: 'Met en forme uniquement les prescriptions dictées.',
    instruction:
      'MODÈLE : mise en forme d\'ordonnance. Liste UNIQUEMENT les traitements/examens EXPLICITEMENT ' +
      'dictés par le médecin, un par ligne (médicament, dosage, posologie, durée tels que dictés). ' +
      'GARDE-FOU STRICT : n\'ajoute, ne suggère, ne corrige et ne modifie aucun médicament, dose ou ' +
      'posologie ; si une mention est ambiguë, recopie-la telle quelle et signale-la entre crochets ' +
      '« [à confirmer] ». Tu es un outil de transcription, pas un prescripteur.',
  },
];

export const DEFAULT_TEMPLATE_ID = 'auto';

export function getReportTemplate(id: string | null | undefined): ReportTemplate {
  return (
    REPORT_TEMPLATES.find((t) => t.id === id) ??
    REPORT_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) ??
    REPORT_TEMPLATES[0]
  );
}

/** Consigne de structure à concaténer au prompt système de génération. */
export function buildTemplateInstruction(id: string | null | undefined): string {
  return getReportTemplate(id).instruction;
}
