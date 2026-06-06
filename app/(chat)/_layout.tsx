import { Tabs } from 'expo-router';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { tokens } from '@/ui/tokens';

function TabIcon({ label, emoji }: { label: string; emoji: string }) {
  return (
    <View style={tabStyles.iconWrap}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
    </View>
  );
}

export default function ChatLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarActiveTintColor: tokens.colors.accent,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarLabelStyle: tabStyles.label,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💬" label="Chat" />
          ),
        }}
      />
      <Tabs.Screen
        name="document"
        options={{
          title: 'Document',
          tabBarIcon: () => <TabIcon emoji="📄" label="Document" />,
        }}
      />
      <Tabs.Screen
        name="audio"
        options={{
          title: 'Audio',
          tabBarIcon: () => <TabIcon emoji="🎤" label="Audio" />,
        }}
      />
      <Tabs.Screen
        name="ecos"
        options={{
          title: 'ECOS',
          tabBarIcon: () => <TabIcon emoji="🩺" label="ECOS" />,
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    ...Platform.select({
      web: { boxShadow: '0 -1px 0 ' + tokens.colors.border } as any,
      default: {},
    }),
  },
  label: {
    fontFamily: tokens.font.sans,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
});
