/**
 * Textes et données de l'accueil (refonte créative 2026-10, ADR-0047).
 *
 * Règles d'écriture (05_DESIGN §13) : une phrase dit un fait du produit ; vouvoiement ;
 * typographie française (espace insécable avant « : », fine avant « ? ! ; ») ; aucun chiffre
 * d'usage, avis ou garantie inventés. Les aperçus d'interface sont des démonstrations aux
 * contenus fictifs, signalées comme telles à l'écran.
 *
 * Module de DONNÉES seulement (aucune logique), relu par tests/unit/landing-editorial.test.ts.
 */
import type { Persona } from '@/ai/prompts/_schema';
import type { AppFeatureId } from '@/ai/routing/featureVisibility';
import type { FaqItem } from '@/seo/meta';
import type { IconName } from '@/ui/icons';

export const HERO_COPY = {
  kicker: 'Information médicale générale',
  kickerDetail: 'Grand public · Étudiants en santé · Professionnels',
  // Groupes insécables : sur téléphone, « Une question / de santé, » plutôt qu'un mot isolé.
  line1: [['Une', 'question'], ['de', 'santé,']],
  line2: [['trois', 'niveaux'], ['de', 'réponse.']],
  subhead:
    'MedInfo AI adapte ses explications au grand public, aux étudiants en santé et aux professionnels. ' +
    'Autour du chat : simulation ECOS et révisions, présentations, CV et articles.',
  meta: 'Un premier message gratuit, sans créer de compte.',
  readout: '25 mm/s · 10 mm/mV',
  cardLabel: 'Exemple d’affichage',
  cardQuestion: 'Qu’est-ce que l’hypertension artérielle ?',
} as const;

/** Lignes d'exemple du hero : la forme de la réponse selon le profil (pas une réponse clinique). */
export const HERO_READINGS: { id: Persona; label: string; text: string }[] = [
  {
    id: 'public',
    label: 'Grand public',
    text: 'La tension mesure la pression du sang dans les artères. On parle d’hypertension quand elle reste trop élevée de façon durable, confirmée par plusieurs mesures.',
  },
  {
    id: 'student',
    label: 'Étudiant',
    text: 'Définition, diagnostic et bilan initial selon le référentiel du Collège, connaissances de rang A d’abord, puis des relances pour approfondir.',
  },
  {
    id: 'professional',
    label: 'Professionnel',
    text: 'Synthèse des recommandations et de la littérature, avec le type de chaque source et les références citées dans le texte.',
  },
];

export interface AudienceCopy {
  id: Persona;
  label: string;
  /** Onglet sur ordinateur / tablette. */
  tabLabel: string;
  shortLabel: string;
  icon: IconName;
  title: string;
  description: string;
  points: string[];
  access: string;
  photo: 'sources' | 'study' | 'work';
  question: string;
}

export const AUDIENCES: AudienceCopy[] = [
  {
    id: 'public',
    label: 'Grand public',
    tabLabel: 'Grand public',
    shortLabel: 'Public',
    icon: 'users',
    title: 'Comprendre une information de santé',
    description: 'Les sujets de santé expliqués sans jargon, avec les références consultables depuis la réponse.',
    points: [
      'Des explications en langage courant, sans diagnostic ni avis individuel',
      'Les références citées s’ouvrent depuis la réponse',
      'Avec un compte : un compte rendu ou une ordonnance résumés en langage clair',
    ],
    access: 'Un message sans inscription, puis un compte gratuit.',
    photo: 'sources',
    question: 'Qu’est-ce que l’hypertension artérielle exactement ?',
  },
  {
    id: 'student',
    label: 'Étudiants en santé',
    tabLabel: 'Étudiants',
    shortLabel: 'Étudiant',
    icon: 'bookOpen',
    title: 'Réviser les cours et le raisonnement clinique',
    description: 'Des réponses appuyées sur les référentiels des Collèges (EDN/R2C), avec des relances pour approfondir.',
    points: [
      'QCM et QCS type EDN générés depuis une réponse, notés selon le barème des discordances',
      'Simulation ECOS : un patient simulé, puis une évaluation pédagogique sur 20',
      'Planning de révisions et analyse des partiels',
    ],
    access: 'Outils réservés aux comptes étudiants vérifiés.',
    photo: 'study',
    question: 'HTA de l’adulte : que retenir pour l’EDN ?',
  },
  {
    id: 'professional',
    label: 'Professionnels de santé',
    tabLabel: 'Professionnels',
    shortLabel: 'Pro',
    icon: 'stethoscope',
    title: 'Explorer la littérature médicale',
    description: 'Une synthèse des recommandations et de la littérature, références à l’appui.',
    points: [
      'Chaque source porte son type : officielle, recommandation, étude, RCP',
      'Compte rendu structuré d’une consultation dictée',
      'Scores cliniques, présentations, CV et rédaction d’article',
    ],
    access: 'Outils réservés aux comptes professionnels vérifiés.',
    photo: 'work',
    question: 'Hypertension : quelles cibles selon les recommandations récentes ?',
  },
];

export interface ShowcaseChapter {
  id: 'chat' | 'ecos' | 'qcm' | 'slides' | 'overview';
  index: string;
  feature: AppFeatureId;
  title: string;
  text: string;
  audience: string;
}

export const SHOWCASE: ShowcaseChapter[] = [
  {
    id: 'chat',
    index: '01',
    feature: 'chat',
    title: 'Des réponses structurées, références à l’appui',
    text: 'Pendant la rédaction, le déroulé des étapes montre les recherches effectuées. Chaque référence citée s’ouvre depuis la réponse, avec son type de source.',
    audience: 'Les trois assistants',
  },
  {
    id: 'ecos',
    index: '02',
    feature: 'ecos',
    title: 'Une station ECOS, puis son évaluation',
    text: 'Le patient simulé ne répond qu’à ce que vous lui demandez. À la fin de la station, une évaluation pédagogique reprend la grille et note le passage sur 20.',
    audience: 'Étudiants',
  },
  {
    id: 'qcm',
    index: '03',
    feature: 'chat',
    title: 'Un QCM type EDN à partir d’une réponse',
    text: 'Sous une réponse du chat étudiant, générez un QCM ou un QCS. La note suit le barème EDN des discordances et se calcule sur votre appareil.',
    audience: 'Étudiants',
  },
  {
    id: 'slides',
    index: '04',
    feature: 'presentation',
    title: 'Une présentation prête pour le staff',
    text: 'Diapositives médicales à la main ou avec l’IA, exportées en PPTX pour PowerPoint et Keynote.',
    audience: 'Étudiants et professionnels',
  },
  {
    id: 'overview',
    index: '05',
    feature: 'revision',
    title: 'Votre semaine de révisions, d’un coup d’œil',
    text: 'Le planning répartit une charge quotidienne réaliste et signale le risque de retard. La vue d’ensemble reprend vos conversations et vos travaux récents.',
    audience: 'Étudiants',
  },
];

/** Étapes du déroulé de réponse, telles que l'interface du chat les affiche. */
export const METHOD_STEPS: { title: string; detail: string }[] = [
  { title: 'Analyse de la question', detail: 'Résumé de la réflexion du modèle, affiché en clair.' },
  { title: 'Recherches effectuées', detail: 'Les requêtes exactes, puis les pages ouvertes.' },
  { title: 'Domaines consultés', detail: 'Chaque site consulté reste cliquable.' },
  { title: 'Rédaction', detail: 'La réponse, avec le nombre de sources citées.' },
];

export const TRUST_ITEMS: [string, string][] = [
  ['Des modèles d’IA récents', 'MedInfo AI associe des modèles d’OpenAI et d’Anthropic, choisis selon la tâche. Le chat fonctionne aujourd’hui avec GPT-6 Luna.'],
  ['Des outils de travail', 'Simulations ECOS, planning de révisions, présentations, CV et rédaction d’articles, accessibles selon votre profil.'],
  ['Des références consultables', 'Les documents cités s’ouvrent depuis la réponse, avec leur type de source, pour poursuivre votre lecture.'],
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'MedInfo AI est-il gratuit ?',
    answer:
      'Oui pour commencer : le premier message est gratuit, sans inscription, sur les trois chatbots. ' +
      'Un compte gratuit permet de continuer ; un abonnement lève seulement la limite de messages. ' +
      'Les sources officielles (HAS, ANSM…) restent gratuites pour tous.',
  },
  {
    question: 'MedInfo AI remplace-t-il un médecin ou un pharmacien ?',
    answer:
      'Non. MedInfo AI fournit de l’information médicale générale, jamais un diagnostic ni un avis ' +
      'individuel. En cas de symptôme inquiétant, consultez un professionnel de santé ; en cas d’urgence, ' +
      'composez le 15 (SAMU) ou le 112.',
  },
  {
    question: 'D’où viennent les réponses ?',
    answer:
      'Selon le mode choisi, l’assistant peut rechercher sur Internet des recommandations et des publications médicales. ' +
      'Les références citées permettent de consulter les documents d’origine. Vérifiez leur date, leur contexte et leur niveau de preuve.',
  },
  {
    question: 'Quelle différence entre les trois chatbots ?',
    answer:
      'Le chat grand public explique sans jargon ; le chat étudiant s’appuie sur les référentiels des ' +
      'Collèges (EDN/R2C) ; le chat professionnel propose une synthèse de la littérature et des recommandations. ' +
      'Les comptes étudiants et professionnels vérifiés accèdent aux trois.',
  },
  {
    question: 'Quels outils au-delà du chat ?',
    answer:
      'Analyse de document médical (grand public), simulation ECOS, planning de révisions et analyse ' +
      'des partiels (étudiants), compte rendu de consultation dicté (professionnels), générateur de ' +
      'présentations, créateur de CV, rédaction d’article et scores cliniques (étudiants et professionnels).',
  },
  {
    question: 'Mes conversations sont-elles privées ?',
    answer:
      'Oui : votre historique de conversations n’est visible que par vous (isolation stricte par compte) ' +
      'et vous pouvez l’exporter en PDF ou le supprimer. Les documents analysés ne sont jamais stockés.',
  },
];

export const CLOSING_COPY = {
  title: 'Posez votre première question.',
  text: 'Un premier message gratuit, sans créer de compte, sur l’assistant de votre choix.',
} as const;
