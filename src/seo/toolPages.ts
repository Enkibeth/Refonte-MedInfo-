/**
 * Présentation publique des outils (SEO 2026-10) — module PUR, testé (tests/unit/tool-pages.test.ts).
 *
 * Les pages d'outils (/ecos, /scores, /cv-builder…) sont indexables et listées dans le sitemap,
 * mais un visiteur non connecté (et donc un robot) n'y voyait qu'un indicateur de chargement,
 * puis une carte « réservé aux comptes » d'une trentaine de mots. Cette présentation la
 * remplace pour les visiteurs : ce que fait l'outil, pour qui, comment y accéder.
 *
 * Règle éditoriale : uniquement des faits du produit tel qu'il existe (docs CLAUDE.md, code) ;
 * aucun chiffre d'usage, témoignage, garantie ni promesse clinique. Vouvoiement (pages
 * publiques), pas de tiret cadratin.
 */
import type { AppFeatureId } from '@/ai/routing/featureVisibility';

export type ToolPageId = Exclude<AppFeatureId, 'chat'>;

export interface ToolPage {
  /** Titre de la page (h1). */
  title: string;
  /** Phrase d'introduction. */
  lead: string;
  /** Ce que permet l'outil : faits vérifiables, 3 à 5 points. */
  points: readonly string[];
  /** Public ayant accès à l'outil (reflète featureVisibility.ts). */
  audience: string;
  /** Mention de cadre affichée sous la liste (information générale, données). */
  note?: string;
}

export const TOOL_PAGES: Record<ToolPageId, ToolPage> = {
  document: {
    title: 'Analyse de document médical',
    lead: "Un compte rendu, une ordonnance ou un résultat d’analyse expliqué en langage clair, à partir d’un PDF, d’une photo ou d’un texte collé.",
    points: [
      'Résumé en langage clair des points importants du document.',
      'Traduction du document dans la langue de votre choix.',
      "Historique de vos analyses dans votre compte ; le document lui-même n’est jamais conservé.",
      'Export du résultat en PDF.',
    ],
    audience: 'Grand public, avec un compte gratuit.',
    note: "Information générale : l’analyse ne remplace pas l’avis du professionnel qui vous suit.",
  },
  ecos: {
    title: 'Simulation ECOS',
    lead: "Des stations d’entraînement aux ECOS avec un patient simulé par IA, puis une évaluation sur grille.",
    points: [
      '15 stations fictives couvrant les situations de départ des annales ECOS 2024.',
      "Un patient simulé qui ne donne que l’information demandée, question après question.",
      'Évaluation sur grille avec une note sur 20.',
      'Historique de vos passages, avec la meilleure et la dernière note par station.',
      'Dictée vocale pour interroger le patient.',
    ],
    audience: 'Étudiants en santé, compte étudiant vérifié.',
    note: 'Cas pédagogiques fictifs : aucun patient réel.',
  },
  revision: {
    title: 'Planning de révisions',
    lead: "Un planning de révisions calculé à partir de la date de l’examen, du temps disponible et du travail à couvrir.",
    points: [
      'Charge quotidienne calculée, en mode lissé ou en prenant de l’avance.',
      'Redistribution automatique du travail en retard.',
      'Jauge de risque verte, orange ou rouge, sans masquer un objectif irréaliste.',
      "Suggestions d’organisation par IA, à la demande.",
    ],
    audience: 'Étudiants en santé, compte étudiant vérifié.',
  },
  partiel: {
    title: 'Analyse des partiels',
    lead: 'Les notes de votre promotion importées depuis un fichier Excel, CSV ou PDF : rang, distribution et points forts.',
    points: [
      'Distribution réelle des notes et z-scores pour comparer des épreuves de difficulté inégale.',
      'Coefficients modifiables, seuil de validation et moyenne pondérée.',
      'Simulateur « et si » et note nécessaire pour atteindre un objectif.',
      'Calcul entièrement local : aucune note n’est envoyée.',
    ],
    audience: 'Étudiants en santé, compte étudiant vérifié.',
  },
  audio: {
    title: 'Compte rendu de consultation dicté',
    lead: 'Une consultation dictée, transcrite puis mise en forme en compte rendu structuré.',
    points: [
      'Transcription de la dictée puis compte rendu structuré par IA.',
      "Enregistrement audio supprimé dans les 24 heures ; le texte reste dans votre bibliothèque privée.",
      'Classement par dossiers et export PDF.',
    ],
    audience: 'Professionnels de santé, compte professionnel vérifié.',
    note: 'Compte rendu généré par IA, à relire et valider par le professionnel de santé.',
  },
  presentation: {
    title: 'Générateur de présentations médicales',
    lead: "Des diapositives médicales construites à la main ou avec l’IA, puis exportées pour PowerPoint et Keynote.",
    points: [
      'Éditeur de diapositives avec aperçu et plusieurs thèmes.',
      'Mode IA pour construire ou reprendre une présentation par la conversation.',
      'Export PPTX compatible PowerPoint et Keynote.',
      'Historique de vos présentations dans votre compte.',
    ],
    audience: 'Étudiants et professionnels de santé, compte vérifié.',
  },
  'cv-builder': {
    title: 'Créateur de CV médical',
    lead: "Un CV médical avec vos propres rubriques, un aperçu A4 fidèle et un PDF au texte sélectionnable.",
    points: [
      'Rubriques libres, trois modèles de départ et sept polices.',
      'Export PDF au texte sélectionnable, lisible par les logiciels de tri des candidatures.',
      'Ajustement automatique pour tenir sur un nombre de pages choisi.',
      'Relecture par IA : des suggestions à valider, jamais de réécriture automatique.',
      "Import d’un CV existant au format PDF ou Word.",
    ],
    audience: 'Étudiants et professionnels de santé, compte vérifié.',
  },
  article: {
    title: "Rédaction d’article médical",
    lead: 'Un éditeur de manuscrit par sections, avec compteurs, bibliographie et aides à la rédaction.',
    points: [
      'Gabarits par type de document : article original IMRaD, abstract, cas clinique, revue, thèse.',
      'Compteurs de caractères et de mots par section, avec limites modifiables.',
      'Bibliographie par DOI ou PMID, citations Vancouver ou APA renumérotées automatiquement.',
      "Aides IA qui n’inventent ni fait ni référence, et contrôle d’originalité indicatif.",
      'Export Word et Markdown.',
    ],
    audience: 'Étudiants et professionnels de santé, compte vérifié.',
  },
  scores: {
    title: 'Scores médicaux',
    lead: '75 scores et calculateurs cliniques, avec une interprétation affichée selon le résultat.',
    points: [
      'Cardiologie, thrombose, pneumologie, urgences, néphrologie, hépato-gastro-entérologie, neurologie, gériatrie et anesthésie.',
      'CHA₂DS₂-VASc, HAS-BLED, Glasgow, CURB-65, CKD-EPI, MELD, NIHSS, G8, MMSE et bien d’autres.',
      'Recherche par nom ou par fonction quand le nom du score vous échappe.',
      'Calcul local et déterministe, sans IA ; un résultat incomplet est signalé comme tel.',
    ],
    audience: 'Étudiants et professionnels de santé, compte vérifié.',
    note: 'Ne remplace ni le jugement clinique ni les recommandations en vigueur.',
  },
};
