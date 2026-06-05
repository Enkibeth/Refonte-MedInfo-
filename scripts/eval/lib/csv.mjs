// Parseur/sérialiseur CSV maison (aucune dépendance npm).
// Gère les champs entre guillemets doubles contenant virgules, retours ligne et
// guillemets échappés ("" → "). Conçu pour le golden set MedInfo qui contient
// des prompts avec virgules internes.

/**
 * Parse un texte CSV en tableau d'objets.
 * La première ligne non vide est l'en-tête (noms de colonnes).
 * @param {string} text Contenu CSV brut.
 * @returns {Array<Record<string,string>>} Lignes sous forme d'objets.
 */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const row = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = cells[i] ?? '';
    }
    return row;
  });
}

/**
 * Découpe un texte CSV en tableau de tableaux de cellules (sans interprétation d'en-tête).
 * Machine à états gérant guillemets, séparateurs et fins de ligne.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseRows(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  // Indique si la ligne courante a au moins commencé (évite une ligne vide finale).
  let started = false;

  while (i < n) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // Guillemet échappé.
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      started = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      started = true;
      i += 1;
      continue;
    }
    if (char === '\r') {
      // Géré avec le \n suivant ; on ignore le \r isolé.
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      started = false;
      i += 1;
      continue;
    }
    field += char;
    started = true;
    i += 1;
  }

  // Dernière cellule / dernière ligne sans saut final.
  if (started || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // On retire d'éventuelles lignes totalement vides (ex. saut final déjà capté).
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ''));
}

/**
 * Échappe une valeur de cellule selon RFC 4180 si nécessaire.
 * @param {unknown} value
 * @returns {string}
 */
function escapeCell(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sérialise un tableau d'objets en chaîne CSV.
 * @param {Array<Record<string,unknown>>} rows
 * @param {string[]} columns Ordre et sélection des colonnes.
 * @returns {string} CSV avec en-tête, lignes séparées par \n, saut final inclus.
 */
export function toCsv(rows, columns) {
  const lines = [columns.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCell(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
