/**
 * En-tête de pile (Stack) rendu dans un repère `banner` — web, groupes sans en-tête du site.
 *
 * L'en-tête par défaut de la pile (titre + bouton retour) restait hors de tout repère : axe
 * signalait son contenu (« region ») sur les écrans du compte en mobile. Même rendu que
 * l'en-tête par défaut de React Navigation sur le web (NativeStackView), seulement enveloppé.
 */
import type { ComponentProps, ReactNode } from 'react';
import { View } from 'react-native';
import { Header, HeaderBackButton, getHeaderTitle } from 'expo-router/react-navigation';

type HeaderProps = ComponentProps<typeof Header>;

type HeaderArgs = {
  back?: { title: string | undefined; href: string | undefined };
  options: Record<string, unknown> & { title?: string; headerTitle?: unknown };
  route: { name: string };
  navigation: { goBack: () => void };
};

/** Options propres à la pile, sans équivalent dans le composant `Header`. */
const STACK_ONLY_OPTIONS = [
  'header',
  'headerShown',
  'headerBackIcon',
  'headerBackImageSource',
  'headerLeft',
  'headerTransparent',
  'headerBackTitle',
  'presentation',
  'contentStyle',
];

export function bannerStackHeader({ back, options, route, navigation }: HeaderArgs): ReactNode {
  const headerOptions = Object.fromEntries(
    Object.entries(options).filter(([key]) => !STACK_ONLY_OPTIONS.includes(key)),
  );
  return (
    <View role="banner">
      <Header
        {...(headerOptions as object)}
        back={back}
        title={getHeaderTitle(options as Parameters<typeof getHeaderTitle>[0], route.name)}
        headerLeft={
          back
            ? (props: Parameters<NonNullable<HeaderProps['headerLeft']>>[0]) => (
                <HeaderBackButton {...props} onPress={navigation.goBack} />
              )
            : undefined
        }
      />
    </View>
  );
}
