/**
 * Scores médicaux — types du moteur PUR (aucune dépendance React/réseau/IA).
 *
 * Un score = une définition déclarative : champs interactifs (choix à boutons ou
 * saisie numérique) + une fonction `compute` DÉTERMINISTE qui renvoie la valeur,
 * son affichage et son INTERPRÉTATION clinique. Rien n'est envoyé au serveur :
 * tout se calcule sur l'appareil (comme l'analyseur de partiels).
 *
 * ⚠️ Enjeu clinique : les critères et seuils sont figés dans la donnée et
 * couverts par des tests (`tests/unit/scores.test.ts`). Aucune valeur n'est
 * « inventée » : chaque score cite sa logique et, quand utile, une mise en garde.
 * Ces scores sont une AIDE À LA DÉCISION, jamais un diagnostic automatique.
 */

export type ScoreCategory =
  | 'cardio'
  | 'thrombose'
  | 'pneumo'
  | 'urgences'
  | 'nephro'
  | 'hepato'
  | 'neuro'
  | 'geriatrie'
  | 'anesthesie'
  | 'general';

export interface CategoryMeta {
  id: ScoreCategory;
  label: string;
  /** Nom d'icône du design system (src/ui/iconPaths.ts) — string pour rester pur. */
  icon: string;
}

/** Gravité d'une bande d'interprétation → pilote la couleur dans l'UI. */
export type RiskLevel = 'info' | 'low' | 'moderate' | 'high' | 'critical';

export interface ScoreOption {
  label: string;
  value: number;
  /** Aide contextuelle sous l'option (facultatif). */
  help?: string;
}

/** Champ « à boutons » (une valeur parmi N) ou saisie numérique. */
export type ScoreField =
  | {
      kind: 'choice';
      id: string;
      label: string;
      help?: string;
      options: ScoreOption[];
    }
  | {
      kind: 'number';
      id: string;
      label: string;
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
      /** Valeur pré-remplie (ex. borne normale d'un paramètre). */
      default?: number;
      placeholder?: string;
      help?: string;
    };

export interface ScoreInterpretation {
  level: RiskLevel;
  /** Libellé court (badge), ex. « Risque élevé ». */
  label: string;
  /** Phrase d'interprétation clinique. */
  detail: string;
}

export interface ComputedScore {
  /** Valeur numérique brute (NaN si champs insuffisants). */
  value: number;
  /** Affichage formaté, ex. « 4 points », « 72 mL/min/1,73 m² ». */
  display: string;
  interpretation: ScoreInterpretation;
  /** true si des champs numériques requis manquent (résultat non fiable). */
  incomplete?: boolean;
}

export interface ScoreDefinition {
  id: string;
  /** Nom complet en français. */
  name: string;
  /** Sigle affiché (ex. « CHA₂DS₂-VASc »). */
  acronym?: string;
  category: ScoreCategory;
  /** À quoi sert le score (affiché + indexé pour la recherche par fonction). */
  purpose: string;
  /** Autres noms / orthographes (recherche par nom). */
  aliases?: string[];
  /** Mots-clés « fonction / indication » : recherche quand on oublie le nom. */
  keywords: string[];
  fields: ScoreField[];
  /** Calcul déterministe. `v` = valeurs de tous les champs (choix + nombres). */
  compute: (v: Record<string, number>) => ComputedScore;
  /** Source / référence (ligne courte). */
  reference?: string;
  /** Mise en garde clinique éventuelle. */
  caution?: string;
}

// ── Fabriques et utilitaires partagés ───────────────────────────────────────

/** Bande d'un score additif : seuil inférieur INCLUS + interprétation. */
export interface Band {
  min: number;
  level: RiskLevel;
  label: string;
  detail: string;
}

/** Bande retenue = celle de plus haut `min` encore ≤ total (bandes croissantes). */
export function bandFor(total: number, bands: Band[]): Band {
  let chosen = bands[0];
  for (const b of bands) if (total >= b.min) chosen = b;
  return chosen;
}

/** Format nombre FR (virgule décimale, pas de décimale inutile). */
export function fmt(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—';
  const r = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
  return r.replace('.', ',');
}

/**
 * Fabrique un score ADDITIF : la valeur = somme des valeurs de tous les champs,
 * l'interprétation = bande correspondante. Couvre la majorité des scores à points
 * (CHA₂DS₂-VASc, HAS-BLED, CURB-65…). Les champs `choice` ont toujours une valeur
 * (option par défaut) ; un champ `number` non renseigné rend le score `incomplete`.
 */
export function additiveScore(
  base: Omit<ScoreDefinition, 'compute'>,
  bands: Band[],
  opts: { unit?: string; format?: (total: number) => string } = {},
): ScoreDefinition {
  const fieldIds = base.fields.map((f) => f.id);
  return {
    ...base,
    compute: (v) => {
      let total = 0;
      let incomplete = false;
      for (const id of fieldIds) {
        const x = v[id];
        if (Number.isFinite(x)) total += x;
        else incomplete = true;
      }
      const band = bandFor(total, bands);
      const unit = opts.unit ?? (total <= 1 ? 'point' : 'points');
      return {
        value: total,
        display: opts.format ? opts.format(total) : `${fmt(total)} ${unit}`,
        interpretation: { level: band.level, label: band.label, detail: band.detail },
        incomplete,
      };
    },
  };
}

/** Champ oui/non valant `points` si « oui », 0 sinon. */
export function yesNo(id: string, label: string, points = 1, help?: string): ScoreField {
  return {
    kind: 'choice',
    id,
    label,
    help,
    options: [
      { label: 'Non', value: 0 },
      { label: 'Oui', value: points },
    ],
  };
}

/** Champ oui/non INVERSÉ : vaut `points` si « non », 0 si « oui » (items « positifs » du GDS). */
export function noYes(id: string, label: string, points = 1, help?: string): ScoreField {
  return {
    kind: 'choice',
    id,
    label,
    help,
    options: [
      { label: 'Oui', value: 0 },
      { label: 'Non', value: points },
    ],
  };
}
