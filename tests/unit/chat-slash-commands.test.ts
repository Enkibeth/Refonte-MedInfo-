import { describe, expect, it } from 'vitest';

import { MODULE_ACTION_TOOLS, moduleActionToolsFor } from '@/ai/chat/moduleActions';
import {
  parseSlashCommand,
  slashCommandsFor,
  slashCompletion,
  slashExamples,
  slashLabel,
  slashSuggestions,
  splitSlashInput,
} from '@/ai/chat/slashCommands';

const student = moduleActionToolsFor({ persona: 'student' });
const pro = moduleActionToolsFor({ persona: 'professional' });

describe('commandes « / » : exécution', () => {
  it('commande exacte, accents et casse ignorés, paramètre borné', () => {
    expect(parseSlashCommand('/ecos Cardiologie', student)).toEqual({ tool: 'ecos', param: 'Cardiologie' });
    expect(parseSlashCommand('/Révisions', student)).toEqual({ tool: 'revision', param: null });
    expect(parseSlashCommand('/presentation  Insuffisance cardiaque ', student)).toEqual({
      tool: 'presentation',
      param: 'Insuffisance cardiaque',
    });
    expect(parseSlashCommand('/score', student)).toEqual({ tool: 'scores', param: null });
    expect(parseSlashCommand('/notes', student)).toEqual({ tool: 'partiel', param: null });
  });

  it('un outil sans paramètre ignore le texte qui suit', () => {
    expect(parseSlashCommand('/partiels S5 2026', student)).toEqual({ tool: 'partiel', param: null });
  });

  it('jamais un outil hors du rôle ; une saisie inconnue reste un message', () => {
    expect(parseSlashCommand('/ecos', pro)).toBeNull();
    expect(parseSlashCommand('/audio', student)).toBeNull();
    expect(parseSlashCommand('/bonjour', student)).toBeNull();
    expect(parseSlashCommand('/', student)).toBeNull();
    expect(parseSlashCommand('pas une commande', student)).toBeNull();
    expect(parseSlashCommand('/ecos', [])).toBeNull();
  });

  it('« // » n’est pas une commande (chemin, citation)', () => {
    expect(splitSlashInput('//ecos')).toBeNull();
  });
});

describe('commandes « / » : suggestions', () => {
  it('« / » seul : toutes les commandes du rôle, et seulement elles', () => {
    expect(slashSuggestions('/', pro).map((s) => s.tool).sort()).toEqual([...pro].sort());
    expect(slashSuggestions('/', [])).toEqual([]);
  });

  it('préfixe puis inclusion', () => {
    expect(slashSuggestions('/pr', student).map((s) => s.command)).toEqual(['présentation']);
    expect(slashSuggestions('/re', student).map((s) => s.command)).toContain('révisions');
    expect(slashSuggestions('/xyz', student)).toEqual([]);
  });

  it('argument en cours : rappelle la commande reconnue', () => {
    expect(slashSuggestions('/ecos card', student).map((s) => s.command)).toEqual(['ecos']);
    expect(slashSuggestions('/inconnu card', student)).toEqual([]);
  });

  it('complétion et libellé', () => {
    const [ecos] = slashCommandsFor(['ecos']);
    expect(slashCompletion(ecos)).toBe('/ecos ');
    expect(slashLabel(ecos)).toBe('S’entraîner sur une station ECOS');
  });

  it('chaque outil ouvrable depuis le chat a sa commande', () => {
    expect(slashCommandsFor(MODULE_ACTION_TOOLS).map((c) => c.tool).sort()).toEqual([...MODULE_ACTION_TOOLS].sort());
  });

  it('exemples de l’astuce : outils du rôle seulement', () => {
    expect(slashExamples(student)).toEqual(['/partiels', '/ecos cardiologie']);
    expect(slashExamples(pro)).toEqual(['/score HAS-BLED', '/présentation asthme']);
    expect(slashExamples([])).toEqual([]);
  });
});
