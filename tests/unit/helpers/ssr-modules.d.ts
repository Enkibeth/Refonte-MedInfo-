// Types minimaux du rendu serveur utilisé par les tests de composants
// (tests/unit/chat-answer-render.test.ts) : ni @types/react-dom ni types de
// react-native-web ne sont installés, et ce test n'en justifie pas l'ajout.
declare module 'react-native-web';
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';
  export function renderToStaticMarkup(element: ReactElement): string;
}
