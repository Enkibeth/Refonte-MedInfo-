/**
 * Sélecteur de chatbot (refonte 2026-06) : les comptes étudiant / professionnel (et admins)
 * basculent librement entre les 3 chats. Le grand public ne voit pas ce sélecteur.
 * L'autorisation réelle reste vérifiée côté serveur (/api/chat → allowedChatbotsFor).
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ChatbotId } from '@/chat/chatContext';
import { Icon, type IconName } from '@/ui/icons/icons';
import { tokens } from '@/ui/theme/tokens';

export const CHATBOT_META: Record<ChatbotId, { label: string; shortLabel: string; icon: IconName; description: string }> = {
  public: {
    label: 'Grand public',
    shortLabel: 'Public',
    icon: 'users',
    description: 'Information santé claire, sourcée et rassurante',
  },
  student: {
    label: 'Étudiant en santé',
    shortLabel: 'Étudiant',
    icon: 'graduationCap',
    description: 'Cours et raisonnement clinique fondés sur les Collèges (EDN/R2C)',
  },
  professional: {
    label: 'Professionnel de santé',
    shortLabel: 'Pro',
    icon: 'stethoscope',
    description: 'Aide à la décision sourcée sur les recommandations en vigueur',
  },
};

export function ChatbotSwitcher({
  chatbots,
  value,
  onChange,
  disabled,
}: {
  chatbots: ChatbotId[];
  value: ChatbotId;
  onChange: (c: ChatbotId) => void;
  disabled?: boolean;
}) {
  if (chatbots.length <= 1) return null;
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {chatbots.map((id) => {
        const meta = CHATBOT_META[id];
        const active = id === value;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(id)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Chat ${meta.label}`}
          >
            <Icon
              name={meta.icon}
              size={15}
              color={active ? tokens.colors.onAccent : tokens.colors.accentDeep}
            />
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{meta.shortLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.space.xs,
    backgroundColor: tokens.colors.surfaceSunken,
    borderRadius: tokens.radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 6,
    ...tokens.motion.transitionWeb,
  },
  pillActive: { backgroundColor: tokens.colors.accent },
  pillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize + 0.5,
    fontWeight: tokens.weight.semibold,
  },
  pillTextActive: { color: tokens.colors.onAccent },
});
