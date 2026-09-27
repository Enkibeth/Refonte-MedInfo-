/** Variante native, statique également sous réduction des mouvements. */
import { StyleSheet, Text, View } from 'react-native';
import { chatPhaseView, type ChatPhase } from '@/ai/chat/statusPhases';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/tokens';

export function ChatStatusRing({ phase, label, elapsed }: { phase: ChatPhase; label: string; elapsed?: string | null }) {
  const color = phase === 'recovering' ? tokens.colors.textMuted : tokens.colors.accent;
  return (
    <View style={styles.root}>
      <View style={[styles.ring, { borderTopColor: color, borderRightColor: color }]} importantForAccessibility="no-hide-descendants">
        <Icon name={chatPhaseView(phase).icon} size={tokens.size.iconSm} color={color} />
      </View>
      <View style={styles.text}>
        <Text accessibilityLiveRegion="polite" style={styles.label}>{label}</Text>
        {elapsed ? <Text accessible={false} importantForAccessibility="no" style={styles.elapsed}>{elapsed}</Text> : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md, minHeight: tokens.size.controlMd },
  ring: { width: tokens.size.ring, height: tokens.size.ring, borderRadius: tokens.radius.pill, borderWidth: tokens.size.stroke, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  label: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.label },
  elapsed: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.caption },
});
