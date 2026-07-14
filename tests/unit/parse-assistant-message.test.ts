/**
 * Tests du parseur de réponses des 3 chatbots (src/ai/chat/parseAssistantMessage.ts).
 * Couvre les formats imposés par les prompts v3 : SOURCES, APPROFONDISSEMENTS,
 * QUESTIONS_PATIENT, INTERACTION (public + pro), AUTO-RÉFLEXION, CALC, [1]+[2]+[3].
 */
import { describe, expect, it } from 'vitest';
import {
  assistantTextForExport,
  formatInlineCitations,
  parseAssistantMessage,
  sourceIdFromSuperscript,
  splitBodySections,
  isUppercaseHeading,
} from '@/ai/chat/parseAssistantMessage';

const PUBLIC_ANSWER = `MAUX DE TÊTE FRÉQUENTS

RÉSUMÉ EXPRESS
Vos maux de tête sont probablement des céphalées de tension (environ 70% des cas).
Sans examen, on ne peut pas être certain de la cause.

QUE FAIRE MAINTENANT
- ⚠️ Urgences si : céphalée brutale en coup de tonnerre
- Hydratation régulière

SOURCES

SRC1 :: [OFFICIEL] HAS :: HAS :: Prise en charge des céphalées chez l'adulte :: 2024
https://www.has-sante.fr/jcms/p_3309676
Justification : recommandation française de référence sur les céphalées.

SRC2 :: [GUIDELINE] NICE :: NICE :: Diagnostic des céphalées :: 2021
https://www.nice.org.uk/guidance/cg150
Justification : guideline internationale reconnue.

SRC3 :: [ÉTUDE] Smith et al., Lancet :: Smith et al. :: Efficacité du paracétamol :: 2019
https://doi.org/10.1016/example
Justification : méta-analyse de référence.

APPROFONDISSEMENTS
1. COMPRENDRE LA MIGRAINE :: Différencier migraine et céphalée de tension :: Quelle est la différence entre une migraine et une céphalée de tension ?
2. QUAND CONSULTER :: Les signes qui doivent alerter :: Quels signes de gravité doivent amener à consulter en urgence pour un mal de tête ?
3. PRÉPARER MA CONSULTATION :: Organiser ses informations :: Comment préparer ma consultation pour des maux de tête répétés ?

QUESTIONS_PATIENT
Q1 : Depuis combien de temps avez-vous ces maux de tête ?
- Moins de 24 heures
- 1 à 3 jours
- 4 à 7 jours
- Plus d'une semaine

Q2 : Avez-vous d'autres symptômes ?
- Fièvre
- Nausées
- Troubles de la vision
- Aucun autre symptôme

Q3 : Prenez-vous des médicaments ?
- Oui, régulièrement
- Oui, occasionnellement
- Non
- Je ne sais pas

INTERACTION
[Décrire mes symptômes]
[M'aider à décider si je consulte]
[Que surveiller à la maison]

AUTO-RÉFLEXION
- Niveau de preuve global : Forte
- Complétude estimée : 80%
- Limites principales : chronologie inconnue
- Données manquantes : antécédents
- Points non sourcés : aucun`;

describe('parseAssistantMessage — format grand public', () => {
  const parsed = parseAssistantMessage(PUBLIC_ANSWER);

  it('extrait les sources avec badge, titre, année, URL et justification', () => {
    expect(parsed.sources).toHaveLength(3);
    const [src1, , src3] = parsed.sources;
    expect(src1.id).toBe('SRC1');
    expect(src1.badge).toBe('OFFICIEL');
    expect(src1.org).toBe('HAS');
    expect(src1.title).toContain('céphalées');
    expect(src1.year).toBe('2024');
    expect(src1.url).toBe('https://www.has-sante.fr/jcms/p_3309676');
    expect(src1.justification).toContain('recommandation');
    expect(src3.badge).toBe('ÉTUDE');
  });

  it('extrait les 3 approfondissements (titre :: description :: question)', () => {
    const block = parsed.blocks.find((b) => b.type === 'deepening');
    expect(block).toBeDefined();
    if (block?.type !== 'deepening') return;
    expect(block.items).toHaveLength(3);
    expect(block.items[0].title).toBe('COMPRENDRE LA MIGRAINE');
    expect(block.items[0].question).toMatch(/^Quelle est la différence/);
  });

  it('extrait le formulaire QUESTIONS_PATIENT (3 questions × 4 options)', () => {
    const block = parsed.blocks.find((b) => b.type === 'questionsPatient');
    expect(block).toBeDefined();
    if (block?.type !== 'questionsPatient') return;
    expect(block.questions).toHaveLength(3);
    expect(block.questions[0].text).toMatch(/Depuis combien de temps/);
    expect(block.questions[0].options).toHaveLength(4);
    expect(block.questions[2].options).toContain('Je ne sais pas');
  });

  it('extrait les boutons INTERACTION (format public)', () => {
    const block = parsed.blocks.find((b) => b.type === 'interaction');
    expect(block).toBeDefined();
    if (block?.type !== 'interaction') return;
    expect(block.groups).toHaveLength(1);
    expect(block.groups[0].options).toEqual([
      'Décrire mes symptômes',
      "M'aider à décider si je consulte",
      'Que surveiller à la maison',
    ]);
  });

  it("extrait l'AUTO-RÉFLEXION en bloc dédié (jamais dans le corps)", () => {
    const block = parsed.blocks.find((b) => b.type === 'reflection');
    expect(block).toBeDefined();
    if (block?.type !== 'reflection') return;
    expect(block.markdown).toContain('Niveau de preuve global');
    const bodies = parsed.blocks.filter((b) => b.type === 'body');
    for (const body of bodies) {
      if (body.type !== 'body') continue;
      expect(body.markdown).not.toContain('Complétude estimée');
    }
  });

  it('garde le corps avant les sections structurées', () => {
    const first = parsed.blocks[0];
    expect(first.type).toBe('body');
    if (first.type !== 'body') return;
    expect(first.markdown).toContain('MAUX DE TÊTE FRÉQUENTS');
    expect(first.markdown).toContain('RÉSUMÉ EXPRESS');
  });
});

const PRO_ANSWER = `FIBRILLATION ATRIALE — ANTICOAGULATION

RESUME EXECUTIF
L'anticoagulation orale est recommandée dès CHA2DS2-VA ≥ 2. (Classe I · SRC1)

<!--CALC:chads,hasbled-->

SOURCES

SRC1 :: ESC AF 2024 :: ESC :: Atrial fibrillation guidelines :: 2024
https://doi.org/10.1093/eurheartj/ehae176
Justification : recommandation européenne la plus récente.

APPROFONDISSEMENTS
1. CHOIX DU DOAC :: Comparer les anticoagulants directs :: Quel anticoagulant direct privilégier chez le sujet âgé insuffisant rénal ?
2. RELAIS PERI-OPERATOIRE :: Gérer l'interruption :: Comment gérer l'interruption d'un DOAC avant chirurgie programmée ?
3. SCORE HAS-BLED :: Évaluer le risque hémorragique :: Comment interpréter un score HAS-BLED élevé chez un patient en FA ?

AUTO-REFLEXION
- Niveau de preuve global : A
- Complétude : 90%

INTERACTION
1. Souhaitez-vous la stratégie chez l'insuffisant rénal ?
[DFG 30-50]+[DFG 15-30]+[Dialyse]+[Non]
2. Faut-il détailler le relais péri-opératoire ?
[Oui]+[Non]`;

describe('parseAssistantMessage — format professionnel', () => {
  const parsed = parseAssistantMessage(PRO_ANSWER);

  it('extrait le marqueur CALC en puces de scores', () => {
    const block = parsed.blocks.find((b) => b.type === 'calc');
    expect(block).toBeDefined();
    if (block?.type !== 'calc') return;
    expect(block.ids).toEqual(['chads', 'hasbled']);
  });

  it('extrait les sources sans badge (format pro)', () => {
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0].badge).toBeNull();
    expect(parsed.sources[0].shortLabel).toBe('ESC AF 2024');
    expect(parsed.sources[0].url).toContain('doi.org');
  });

  it('extrait les questions INTERACTION numérotées avec options [A]+[B]', () => {
    const block = parsed.blocks.find((b) => b.type === 'interaction');
    expect(block).toBeDefined();
    if (block?.type !== 'interaction') return;
    expect(block.groups).toHaveLength(2);
    expect(block.groups[0].question).toMatch(/insuffisant rénal/);
    expect(block.groups[0].options).toEqual(['DFG 30-50', 'DFG 15-30', 'Dialyse', 'Non']);
    expect(block.groups[1].options).toEqual(['Oui', 'Non']);
  });

  it('accepte AUTO-REFLEXION sans accent', () => {
    expect(parsed.blocks.some((b) => b.type === 'reflection')).toBe(true);
  });
});

const STUDENT_ANSWER = `## Pyélonéphrite aiguë

La pyélonéphrite aiguë simple se traite par fluoroquinolone (CMIT · Item 161 · p.186).

Trois questions pour approfondir :
1. Quels sont les critères d'hospitalisation d'une pyélonéphrite aiguë ?
2. Comment adapter l'antibiothérapie aux résultats de l'ECBU ?
3. Quelle est la prise en charge d'une pyélonéphrite sur obstacle ?

[1] + [2] + [3]

🎯 SCORE DE FIABILITÉ
• Couverture par les Collèges fournis : 85 %
• Nombre de chunks d'embedding mobilisés : 6`;

describe('parseAssistantMessage — format étudiant', () => {
  const parsed = parseAssistantMessage(STUDENT_ANSWER);

  it('transforme [1] + [2] + [3] en boutons portant les 3 questions', () => {
    const block = parsed.blocks.find((b) => b.type === 'followups');
    expect(block).toBeDefined();
    if (block?.type !== 'followups') return;
    expect(block.questions).toHaveLength(3);
    expect(block.questions[0]).toMatch(/critères d'hospitalisation/);
    expect(block.questions[2]).toMatch(/obstacle/);
  });

  it('retire le marqueur et les questions numérotées du corps', () => {
    const bodies = parsed.blocks.filter((b) => b.type === 'body');
    const all = bodies.map((b) => (b.type === 'body' ? b.markdown : '')).join('\n');
    expect(all).not.toContain('[1] + [2] + [3]');
    expect(all).toContain('Pyélonéphrite aiguë');
    expect(all).toContain('SCORE DE FIABILITÉ');
  });
});

describe('splitBodySections — titres MAJUSCULES', () => {
  it('découpe le corps public/pro en sections', () => {
    const sections = splitBodySections(
      'TITRE PRINCIPAL\nintro\n\nRÉSUMÉ EXPRESS\ncontenu du résumé\n\nQUE FAIRE MAINTENANT\n- action',
    );
    expect(sections.map((s) => s.heading)).toEqual([
      'TITRE PRINCIPAL',
      'RÉSUMÉ EXPRESS',
      'QUE FAIRE MAINTENANT',
    ]);
  });

  it('laisse le markdown étudiant intact (pas de titres MAJUSCULES)', () => {
    const sections = splitBodySections('## Titre markdown\nDu texte normal.');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
  });
});

describe('isUppercaseHeading', () => {
  it('reconnaît les titres en majuscules accentuées', () => {
    expect(isUppercaseHeading('RÉSUMÉ EXPRESS')).toBe(true);
    expect(isUppercaseHeading('CE QUE CELA PEUT ÉVOQUER')).toBe(true);
    expect(isUppercaseHeading('POINTS CLES FORMAT DECISIONNEL')).toBe(true);
  });
  it('rejette le texte normal et les URLs', () => {
    expect(isUppercaseHeading('Une phrase normale')).toBe(false);
    expect(isUppercaseHeading('https://www.has-sante.fr')).toBe(false);
    expect(isUppercaseHeading('')).toBe(false);
  });
});

describe('formatInlineCitations — (SRCx) → appels de note en exposant', () => {
  it('remplace une référence simple collée au mot précédent', () => {
    expect(formatInlineCitations('Red flag : dysphagie progressive. (SRC1)')).toBe(
      'Red flag : dysphagie progressive.¹',
    );
  });

  it('remplace une référence multiple', () => {
    expect(formatInlineCitations('plan de contrôle à court terme. (SRC1, SRC2)')).toBe(
      'plan de contrôle à court terme.¹ ²',
    );
  });

  it('conserve le badge de grade et ajoute l’exposant après la parenthèse', () => {
    expect(
      formatInlineCitations('L’anticoagulation est recommandée. (Classe I · SRC1)'),
    ).toBe('L’anticoagulation est recommandée. (Classe I)¹');
    expect(formatInlineCitations('La cible est < 7%. (grade A · SRC5)')).toBe(
      'La cible est < 7%. (grade A)⁵',
    );
  });

  it('remplace une référence SRCn isolée hors parenthèses', () => {
    expect(formatInlineCitations('ou signes de sténose. SRC3')).toBe('ou signes de sténose. ³');
  });

  it('numérote la légende SRCn :: sans casser son contenu (export PDF)', () => {
    expect(formatInlineCitations('SRC1 :: ESC AF 2024 :: ESC :: Guidelines :: 2024')).toBe(
      '¹ ESC AF 2024 :: ESC :: Guidelines :: 2024',
    );
  });

  it('laisse intact un texte sans référence', () => {
    const text = 'Réponse normale (avec parenthèses) et **du gras**.';
    expect(formatInlineCitations(text)).toBe(text);
  });
});

describe('sourceIdFromSuperscript — clic sur une référence inline → source', () => {
  it('retrouve le SRCn depuis un exposant simple', () => {
    expect(sourceIdFromSuperscript('¹')).toBe('SRC1');
    expect(sourceIdFromSuperscript('⁵')).toBe('SRC5');
  });

  it('retrouve un SRCn à plusieurs chiffres', () => {
    expect(sourceIdFromSuperscript('¹²')).toBe('SRC12');
  });

  it('reste cohérent avec formatInlineCitations pour un round-trip', () => {
    const rendered = formatInlineCitations('Point clé. (SRC5)');
    const superscript = rendered.slice(-1);
    expect(sourceIdFromSuperscript(superscript)).toBe('SRC5');
  });

  it("renvoie null si le texte n'est pas un exposant valide", () => {
    expect(sourceIdFromSuperscript('abc')).toBeNull();
  });
});

describe('streaming partiel', () => {
  it('ne plante pas sur un texte tronqué en pleine section', () => {
    const partial = 'RÉSUMÉ\nDébut de réponse…\n\nSOURCES\n\nSRC1 :: [OFFICIEL] HAS :: HAS :: Tit';
    const parsed = parseAssistantMessage(partial);
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0].title).toBe('Tit');
  });
});

describe('assistantTextForExport — texte propre (Copier / export PDF)', () => {
  it('convertit le corps + les sources en légende, et omet les blocs interactifs', () => {
    const out = assistantTextForExport(PUBLIC_ANSWER);
    // Corps conservé.
    expect(out).toContain('MAUX DE TÊTE FRÉQUENTS');
    expect(out).toContain('céphalées de tension');
    // Sources en légende numérotée lisible (exposant + badge + libellé + URL).
    expect(out).toContain('Sources');
    expect(out).toContain('¹ [OFFICIEL] HAS');
    expect(out).toContain('https://www.has-sante.fr/jcms/p_3309676');
    // Aucun marqueur technique brut.
    expect(out).not.toContain('SRC1 ::');
    expect(out).not.toContain('QUESTIONS_PATIENT');
    expect(out).not.toContain('APPROFONDISSEMENTS');
    expect(out).not.toMatch(/^\[.*\]$/m);
  });

  it('rend les références inline en exposant dans le corps exporté', () => {
    const out = assistantTextForExport(
      'Un fait établi. (SRC1)\n\nSOURCES\n\nSRC1 :: [OFFICIEL] HAS :: HAS :: Titre :: 2024\nhttps://exemple.fr/reco',
    );
    expect(out).toContain('Un fait établi.¹');
    expect(out).not.toContain('(SRC1)');
  });

  it("conserve l'auto-réflexion sous son titre", () => {
    const out = assistantTextForExport('Réponse.\n\nAUTO-RÉFLEXION\nPoints vérifiés : dosages.');
    expect(out).toContain('Auto-réflexion');
    expect(out).toContain('Points vérifiés : dosages.');
  });

  it('omet le marqueur CALC et les relances étudiant', () => {
    const out = assistantTextForExport(
      'Corps de réponse.\n\n<!--CALC:cha2ds2vasc-->\n\n1. Question A ?\n2. Question B ?\n3. Question C ?\n[1] + [2] + [3]',
    );
    expect(out).toContain('Corps de réponse.');
    expect(out).not.toContain('CALC');
    expect(out).not.toContain('[1] + [2] + [3]');
  });
});

describe('section SOURCES — robustesse (format étudiant historique)', () => {
  it("reconnaît l'en-tête « SOURCES UTILISÉES » (prompt étudiant v3 archivé)", () => {
    const text =
      'Réponse.\n\nSOURCES UTILISÉES\n\nSRC1 :: [OFFICIEL] HAS :: HAS :: Titre :: 2024\nhttps://exemple.fr/reco';
    const parsed = parseAssistantMessage(text);
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0].id).toBe('SRC1');
  });

  it('ne perd JAMAIS une bibliographie libre sans lignes SRCn (repart dans le corps)', () => {
    const text =
      'Réponse.\n\nSOURCES UTILISÉES\n• CMIT — Item EDN 161 : Infections urinaires — p.186 — Rang A\n• CNEC — Item EDN 230 : Fibrillation atriale — p.45 — Rang A';
    const parsed = parseAssistantMessage(text);
    expect(parsed.sources).toHaveLength(0);
    const bodyText = parsed.blocks
      .filter((b): b is { type: 'body'; markdown: string } => b.type === 'body')
      .map((b) => b.markdown)
      .join('\n');
    expect(bodyText).toContain('SOURCES UTILISÉES');
    expect(bodyText).toContain('CMIT — Item EDN 161');
    expect(bodyText).toContain('CNEC — Item EDN 230');
  });
});
