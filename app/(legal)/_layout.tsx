import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { LandingHeader } from '@/ui/LandingHeader';
import { screenMainLayout } from '@/ui/landmarks';

/**
 * Pages légales : sur le web, l'en-tête du site (logo, navigation, connexion) remplace la
 * barre grise native « Informations légales » — même cadre que les pages marketing
 * (recette 2026-10-02 : seule rupture de thème restante sur les pages publiques).
 * Le natif garde l'en-tête de pile (retour).
 */
export default function LegalLayout() {
  return (
    <Stack
      // L'en-tête du site (bannière) est rendu par la pile, hors du <main> de l'écran.
      screenLayout={screenMainLayout}
      screenOptions={
        Platform.OS === 'web'
          ? { header: () => <LandingHeader /> }
          : { title: 'Informations légales' }
      }
    />
  );
}
