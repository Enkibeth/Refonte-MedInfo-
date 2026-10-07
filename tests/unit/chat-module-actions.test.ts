import { describe, expect, it } from 'vitest';

import {
  MODULE_ACTIONS_MAX,
  MODULE_ACTION_PARAM_MAX,
  MODULE_ACTION_TOOLS,
  buildModuleActionsSection,
  cleanModuleActionParam,
  isModuleActionMarkerLine,
  isolateModuleActionMarkers,
  mergeModuleActions,
  moduleActionCard,
  coerceClientCapabilities,
  moduleActionCounts,
  moduleActionToolsFor,
  moduleToolsForRequest,
  parseModuleActionMarker,
  scoreIdForCalc,
  stripInterfaceComments,
} from '@/ai/chat/moduleActions';
import { assistantTextForExport, parseAssistantMessage } from '@/ai/chat/parseAssistantMessage';
import { advanceStreamingBody, EMPTY_STREAMING_BODY, visibleStreamingTail } from '@/chat/streamingBody';
import { APP_FEATURES } from '@/ai/routing/featureVisibility';
import { getScore } from '@/scores';

describe('cartes d’action : marqueur', () => {
  it('lit un outil sans paramètre et un outil avec paramètre', () => {
    expect(parseModuleActionMarker('<!--OUTIL:partiel-->')).toEqual({ tool: 'partiel', param: null });
    expect(parseModuleActionMarker('<!--OUTIL:ecos|Cardiologie-->')).toEqual({ tool: 'ecos', param: 'Cardiologie' });
    expect(parseModuleActionMarker('  <!-- OUTIL : scores | CHA2DS2-VASc -->  ')).toEqual({
      tool: 'scores',
      param: 'CHA2DS2-VASc',
    });
  });

  it('ignore le paramètre d’un outil qui n’en prend pas', () => {
    expect(parseModuleActionMarker('<!--OUTIL:revision|15 juin-->')).toEqual({ tool: 'revision', param: null });
  });

  it('refuse un outil inconnu, le chat lui-même et une ligne qui n’est pas un marqueur', () => {
    expect(parseModuleActionMarker('<!--OUTIL:admin-->')).toBeNull();
    expect(parseModuleActionMarker('<!--OUTIL:chat-->')).toBeNull();
    expect(parseModuleActionMarker('Ouvre <!--OUTIL:ecos--> maintenant')).toBeNull();
    expect(parseModuleActionMarker('<!--CALC:chads-->')).toBeNull();
  });

  it('nettoie et borne le paramètre (une ligne, sans balisage)', () => {
    expect(cleanModuleActionParam('  **Fibrillation**   atriale `x` ')).toBe('Fibrillation atriale x');
    expect(cleanModuleActionParam('   ')).toBeNull();
    expect(cleanModuleActionParam('a'.repeat(500))!.length).toBe(MODULE_ACTION_PARAM_MAX);
    const parsed = parseModuleActionMarker(`<!--OUTIL:presentation|${'b'.repeat(400)}-->`);
    expect(parsed!.param!.length).toBeLessThanOrEqual(MODULE_ACTION_PARAM_MAX);
  });

  it('reconnaît une ligne-marqueur, même d’un outil inconnu (jamais affichée)', () => {
    expect(isModuleActionMarkerLine('<!--OUTIL:inconnu-->')).toBe(true);
    expect(isModuleActionMarkerLine('<!--OUTIL:ecos|Cardio')).toBe(false);
    expect(isModuleActionMarkerLine('Texte')).toBe(false);
  });

  it('dédoublonne et borne les actions', () => {
    const a = { tool: 'ecos' as const, param: 'Cardiologie' };
    const merged = mergeModuleActions([a], [
      { tool: 'ecos', param: 'cardiologie' },
      { tool: 'scores', param: null },
      { tool: 'revision', param: null },
      { tool: 'article', param: null },
    ]);
    expect(merged).toHaveLength(MODULE_ACTIONS_MAX);
    expect(merged[0]).toBe(a);
    expect(merged.map((m) => m.tool)).toEqual(['ecos', 'scores', 'revision']);
  });
});

describe('cartes d’action : cloisonnement par persona', () => {
  it('visiteur : aucun outil', () => {
    expect(moduleActionToolsFor({ persona: null, isGuest: true })).toEqual([]);
    expect(buildModuleActionsSection([])).toBe('');
  });

  it('grand public : seulement l’analyse de document', () => {
    expect(moduleActionToolsFor({ persona: 'public' })).toEqual(['document']);
  });

  it('étudiant : ses outils, jamais l’audio ni le document grand public', () => {
    const tools = moduleActionToolsFor({ persona: 'student' });
    expect(tools).toEqual(expect.arrayContaining(['partiel', 'ecos', 'scores', 'revision', 'presentation', 'article', 'cv-builder']));
    expect(tools).not.toContain('audio');
    expect(tools).not.toContain('document');
  });

  it('professionnel : audio et outils partagés, jamais Partiels ni ECOS', () => {
    const tools = moduleActionToolsFor({ persona: 'professional' });
    expect(tools).toEqual(expect.arrayContaining(['audio', 'presentation', 'article', 'cv-builder', 'scores']));
    expect(tools).not.toContain('partiel');
    expect(tools).not.toContain('ecos');
  });

  it('admin : tous les outils', () => {
    expect(moduleActionToolsFor({ persona: 'public', isAdmin: true })).toEqual(MODULE_ACTION_TOOLS);
  });

  it('chaque outil de l’app (hors chat) a sa carte', () => {
    expect([...MODULE_ACTION_TOOLS].sort()).toEqual(APP_FEATURES.filter((f) => f.id !== 'chat').map((f) => f.id).sort());
  });
});

describe('cartes d’action : consigne au modèle', () => {
  it('ne liste que les outils de l’utilisateur et rappelle les règles', () => {
    const section = buildModuleActionsSection(moduleActionToolsFor({ persona: 'professional' }));
    expect(section).toContain('<!--OUTIL:identifiant-->');
    expect(section).toContain('- audio :');
    expect(section).not.toContain('- partiel :');
    expect(section).not.toContain('- ecos :');
    expect(section).toMatch(/au plus 2 lignes OUTIL/);
    expect(section).toMatch(/jamais que tu as ouvert ou exécuté/);
    expect(section).toMatch(/jamais de donnée personnelle/);
    expect(section).toMatch(/sans les recalculer ni en inventer/);
  });

  it('Partiels : interdit de demander les notes de la promo dans la conversation', () => {
    const section = buildModuleActionsSection(['partiel']);
    expect(section).toMatch(/ne demande JAMAIS de coller les notes/);
  });
});

describe('cartes d’action : contenu affiché', () => {
  it('titre précisé par le paramètre, route et icône de l’outil', () => {
    const card = moduleActionCard({ tool: 'ecos', param: 'Cardiologie' });
    expect(card.title).toBe('Station ECOS : Cardiologie');
    expect(card.route).toBe('/(chat)/ecos');
    expect(card.icon).toBe('stethoscope');
    expect(moduleActionCard({ tool: 'ecos', param: null }).title).toBe('S’entraîner sur une station ECOS');
  });

  it('aucun tiret cadratin dans les textes de carte', () => {
    for (const tool of MODULE_ACTION_TOOLS) {
      const card = moduleActionCard({ tool, param: 'X' });
      expect(`${card.title} ${card.description}`).not.toContain('—');
    }
  });
});

describe('puces CALC → calculateur déterministe', () => {
  it('chaque correspondance pointe vers un score réel du catalogue', () => {
    const calcIds = ['chads', 'hasbled', 'timi', 'rcri', 'heart', 'wells', 'wellstvp', 'pesi', 'curb65', 'geneva', 'news2', 'qsofa', 'sofa', 'glasgow', 'nihss', 'abcd2', 'mrs', 'gbs', 'childpugh', 'meld', 'centor'];
    for (const id of calcIds) {
      const scoreId = scoreIdForCalc(id);
      expect(scoreId, id).not.toBeNull();
      expect(getScore(scoreId!), `${id} → ${scoreId}`).toBeDefined();
    }
  });

  it('un score absent du catalogue n’a pas de lien', () => {
    expect(scoreIdForCalc('grace')).toBeNull();
    expect(scoreIdForCalc('apgar')).toBeNull();
  });
});

describe('cartes d’action : réponse complète et flux', () => {
  const answer = [
    'Pour t’entraîner, une station de cardiologie est le meilleur exercice.',
    '',
    '<!--OUTIL:ecos|Cardiologie-->',
    '<!--OUTIL:scores|CHA2DS2-VASc-->',
    '<!--OUTIL:inconnu-->',
    '',
    'SOURCES',
    'SRC1 :: [OFFICIEL] HAS :: HAS :: Titre :: 2024',
    'https://www.has-sante.fr/x',
  ].join('\n');

  it('les marqueurs consécutifs forment une rangée de cartes, avant les sources', () => {
    const { blocks } = parseAssistantMessage(answer);
    expect(blocks.map((b) => b.type)).toEqual(['body', 'actions', 'sources']);
    const actions = blocks[1] as Extract<(typeof blocks)[number], { type: 'actions' }>;
    expect(actions.actions).toEqual([
      { tool: 'ecos', param: 'Cardiologie' },
      { tool: 'scores', param: 'CHA2DS2-VASc' },
    ]);
  });

  it('un marqueur glissé en milieu de phrase devient une carte, le texte est conservé', () => {
    const { blocks } = parseAssistantMessage('Ouvre l’outil dédié <!--OUTIL:partiel--> pour ton rang.');
    expect(blocks.map((b) => b.type)).toEqual(['body', 'actions', 'body']);
    expect(blocks.some((b) => b.type === 'body' && b.markdown.includes('<!--'))).toBe(false);
  });

  it('copie et export : aucun marqueur', () => {
    const text = assistantTextForExport(answer);
    expect(text).not.toContain('OUTIL');
    expect(text).not.toContain('<!--');
    expect(text).toContain('station de cardiologie');
  });

  it('flux : le marqueur reporte la suite au rendu final, jamais affiché en cours de route', () => {
    const partial = 'Intro complète.\n\n<!--OUTIL:ecos|Card';
    expect(visibleStreamingTail('Intro <!--OUTIL:ec')).toBe('Intro ');
    expect(visibleStreamingTail('Intro <!-')).toBe('Intro ');
    let state = advanceStreamingBody(EMPTY_STREAMING_BODY, partial, false);
    expect(state.deferred).toBeNull();
    state = advanceStreamingBody(state, `${partial}iologie-->\nSuite`, false);
    expect(state.deferred).toContain('<!--OUTIL:ecos|Cardiologie-->');
    expect(state.chunks.join('')).not.toContain('<!--');
  });

  it('flux puis fin, marqueur en milieu de phrase : corps sans marqueur une fois rendu, carte conservée', () => {
    const text = 'Ouvre l’outil dédié <!--OUTIL:partiel--> pour ton rang.\n\nBon courage.';
    let state = EMPTY_STREAMING_BODY;
    for (let n = 1; n <= text.length; n++) state = advanceStreamingBody(state, text.slice(0, n), false);
    state = advanceStreamingBody(state, text, true);
    // Chemin incrémental de AssistantBlocks : morceaux affichés (commentaires retirés au rendu)
    // + blocs structurés du texte entier (les corps y sont ignorés, les cartes rendues).
    expect(state.deferred).toBeNull();
    expect(stripInterfaceComments(state.chunks.join(''))).not.toContain('<!--');
    const { blocks } = parseAssistantMessage(state.deferred ?? text);
    expect(blocks.filter((b) => b.type === 'actions')).toHaveLength(1);
  });

  it('rendu : un commentaire resté dans le corps est retiré', () => {
    expect(stripInterfaceComments('Texte <!--OUTIL:ecos--> fin')).toBe('Texte  fin');
    expect(isolateModuleActionMarkers('a <!--OUTIL:ecos--> b')).toBe('a\n<!--OUTIL:ecos-->\nb');
  });
});

describe('cartes d’action : mesure', () => {
  it('compte les cartes proposées par outil, noms seuls, dédoublonnées et bornées', () => {
    const text = 'a <!--OUTIL:ecos|Cardio--> b\n<!--OUTIL:ecos|cardio-->\n<!--OUTIL:scores|HAS-BLED-->\n<!--OUTIL:inconnu-->';
    expect(moduleActionCounts(text)).toEqual({ 'carte:ecos': 1, 'carte:scores': 1 });
    expect(moduleActionCounts('Pas de carte.')).toEqual({});
    expect(JSON.stringify(moduleActionCounts(text))).not.toContain('Cardio');
  });
});

describe('cartes d’action : robustesse (incident iPhone 2026-10)', () => {
  it('marqueur à la typographie « corrigée » par le modèle : toujours une carte, jamais du texte', () => {
    for (const marker of ['<!--OUTIL:cv-builder—>', '<!--OUTIL:cv-builder–>', '<!--OUTIL:cv-builder→', '<!—OUTIL:cv-builder—>', '<!--OUTIL:cv-builder ⟶']) {
      expect(parseModuleActionMarker(marker), marker).toEqual({ tool: 'cv-builder', param: null });
      expect(isModuleActionMarkerLine(marker), marker).toBe(true);
      expect(stripInterfaceComments(`Texte ${marker} fin`), marker).toBe('Texte  fin');
    }
    expect(parseModuleActionMarker('<!--OUTIL:scores|CURB-65—>')).toEqual({ tool: 'scores', param: 'CURB-65' });
  });

  it('cas réel : réponse CV du chatbot pro, carte en fin de réponse', () => {
    const text =
      "Oui. Envoie ton CV actuel et précise le type de poste visé. Je peux retravailler la structure et la mise en valeur de ton parcours médical.\n\n<!--OUTIL:cv-builder-->";
    const { blocks } = parseAssistantMessage(text);
    expect(blocks.map((b) => b.type)).toEqual(['body', 'actions']);
    expect(assistantTextForExport(text)).not.toContain('OUTIL');
  });

  it('cas réel : CURB-65, puce CALC et carte sur le même score', () => {
    const text =
      'Triage avec les seules informations disponibles : red flags non renseignés.\n\n<!--CALC:curb65-->\n<!--OUTIL:scores|CURB-65-->\n\nPOINTS CLÉS\n- Confusion, urée, fréquence respiratoire.';
    const types = parseAssistantMessage(text).blocks.map((b) => b.type);
    expect(types).toContain('calc');
    expect(types).toContain('actions');
  });

  it('requête d’un onglet resté sur l’ancien code (sans capacité) : aucune consigne de cartes', () => {
    const base = { persona: 'professional' as const, isAdmin: false, verified: true };
    expect(moduleToolsForRequest({ ...base, capabilities: undefined })).toEqual([]);
    expect(buildModuleActionsSection(moduleToolsForRequest({ ...base, capabilities: undefined }))).toBe('');
    expect(moduleToolsForRequest({ ...base, capabilities: ['module-actions'] })).toContain('scores');
    expect(moduleToolsForRequest({ persona: 'student', isAdmin: false, verified: false, capabilities: ['module-actions'] })).toEqual([]);
  });

  it('capacités du client : seules les valeurs connues, jamais un droit', () => {
    expect(coerceClientCapabilities(['module-actions', 'admin'])).toEqual(['module-actions']);
    expect(coerceClientCapabilities('module-actions')).toEqual([]);
    expect(coerceClientCapabilities(undefined)).toEqual([]);
  });

  it('consigne : score nommé d’emblée, outil CV plutôt que le CV collé dans le chat', () => {
    const section = buildModuleActionsSection(['scores', 'cv-builder']);
    expect(section).toMatch(/nomme-le dès la première phrase/);
    expect(section).toMatch(/plutôt que de demander de coller ou d'envoyer le CV/);
  });
});

