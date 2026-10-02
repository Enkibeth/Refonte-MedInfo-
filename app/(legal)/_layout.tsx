import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { LandingHeader } from '@/ui/LandingHeader';

/**
 * Pages légales : sur le web, l'en-tête du site (logo, navigation, connexion) remplace la
 * barre grise native « Informations légales » — même cadre que les pages marketing
 * (recette 2026-10-02 : seule rupture de thème restante sur les pages publiques).
 * Le natif garde l'en-tête de pile (retour).
 */
export default function LegalLayout() {
  return (
    <Stack
      screenOptions={
        Platform.OS === 'web'
          ? { header: () => <LandingHeader /> }
          : { title: 'Informations légales' }
      }
    />
  );
}
