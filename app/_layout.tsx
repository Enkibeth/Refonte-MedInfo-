import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/auth/AuthProvider';
import { MedInfoThemeProvider } from '@/ui/MedInfoThemeProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <MedInfoThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(chat)" />
          <Stack.Screen name="(account)" />
        </Stack>
        <StatusBar style="auto" />
      </MedInfoThemeProvider>
    </AuthProvider>
  );
}
