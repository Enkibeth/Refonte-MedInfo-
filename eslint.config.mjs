/**
 * ESLint — règles à fort signal uniquement (pas de style : le code suit déjà ses conventions).
 *
 * - `rules-of-hooks` (erreur) : un hook appelé conditionnellement casse l'état de l'écran.
 * - `exhaustive-deps` (erreur) : une dépendance oubliée fige une valeur périmée dans un effet
 *   ou un rappel. Une omission VOLONTAIRE se justifie en commentaire au-dessus d'un
 *   `eslint-disable-next-line` (voir app/(chat)/chat.tsx).
 * Le plugin TypeScript est enregistré pour que les directives existantes qui le citent
 * restent valides ; ses règles ne sont pas activées.
 */
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'public/**', 'benchmarks/**', 'supabase/**'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
