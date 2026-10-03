/**
 * Sélecteur de chatbot (refonte 2026-06) : les comptes étudiant / professionnel (et admins)
 * basculent librement entre les 3 chats. Le grand public ne voit pas ce sélecteur.
 * L'autorisation réelle reste vérifiée côté serveur (/api/chat → allowedChatbotsFor).
 */
import { StyleSheet, Text, View } from 'react-native';

import type { ChatbotId } from '@/ai/chat/chatContext';
import { Icon, type IconName } from '@/ui/icons';
import { tokens } from '@/ui/tokens';
import { Touchable } from '@/ui/Touchable';

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
          <Touchable
            key={id}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(id)}
            disabled={disabled}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={`Chat ${meta.label}`}
          >
            <Icon
              name={meta.icon}
              size={15}
              color={active ? tokens.colors.accent : tokens.colors.textMuted}
            />
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{meta.shortLabel}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderRadius: 0,
    padding: 0,
    alignSelf: 'flex-start',
  },
  pill: {
    minHeight: tokens.size.controlMd,
    borderBottomWidth: tokens.size.stroke,
    borderBottomColor: tokens.colors.transparent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 0,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    ...tokens.motion.transitionWeb,
  },
  pillActive: { borderBottomColor: tokens.colors.accent, backgroundColor: tokens.colors.surface },
  pillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.caption.fontSize + 0.5,
    fontWeight: tokens.weight.semibold,
  },
  pillTextActive: { color: tokens.colors.accent },
});
