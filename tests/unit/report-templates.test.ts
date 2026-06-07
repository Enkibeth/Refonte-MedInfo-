import { describe, it, expect } from 'vitest';

import {
  REPORT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getReportTemplate,
  buildTemplateInstruction,
} from '@/lib/reportTemplates';

describe('reportTemplates — registre', () => {
  it('expose des modèles avec des id uniques et des champs non vides', () => {
    const ids = REPORT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of REPORT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.instruction.length).toBeGreaterThan(20);
    }
  });

  it('contient le modèle par défaut', () => {
    expect(REPORT_TEMPLATES.some((t) => t.id === DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it('le modèle ordonnance porte le garde-fou « ne modifie aucun médicament »', () => {
    const ordo = getReportTemplate('ordonnance');
    expect(ordo.id).toBe('ordonnance');
    expect(ordo.instruction.toLowerCase()).toContain('ne modifie');
  });
});

describe('reportTemplates — getReportTemplate', () => {
  it('renvoie le modèle demandé', () => {
    expect(getReportTemplate('consultation').id).toBe('consultation');
  });

  it('retombe sur le modèle par défaut si id inconnu ou nul', () => {
    expect(getReportTemplate('inexistant').id).toBe(DEFAULT_TEMPLATE_ID);
    expect(getReportTemplate(null).id).toBe(DEFAULT_TEMPLATE_ID);
    expect(getReportTemplate(undefined).id).toBe(DEFAULT_TEMPLATE_ID);
  });
});

describe('reportTemplates — buildTemplateInstruction', () => {
  it('renvoie l\'instruction du modèle', () => {
    expect(buildTemplateInstruction('courrier')).toContain('confrère');
  });
});
