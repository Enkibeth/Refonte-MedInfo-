/**
 * En-tête du chat sur téléphone (< 640 px) — refonte 2026-09, retour Hugo « trop de boutons ».
 *
 * Avant : 7 boutons encadrés sur une ligne qui débordait (le pays était coupé), puis une
 * ligne entière d'onglets Public / Étudiant / Pro. Désormais UNE barre, sur le modèle des
 * apps de chat mobiles :
 *
 *   [☰]            [🩺 Pro ▾]            [＋]
 *
 * - ☰ ouvre une feuille en bas d'écran : historique, export PDF, sources, plein écran,
 *   pays des sources, outils et compte (tout ce qui encombrait la barre).
 * - Le titre central EST le sélecteur de chatbot (remplace la ligne d'onglets).
 * - ＋ démarre une nouvelle conversation (seulement quand il y en a une en cours).
 *
 * Pure ergonomie : l'autorisation des chatbots reste serveur (allowedChatbotsFor).
 */
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatbotId } from '@/ai/chat/chatContext';
import { getCountry, type CountryCode } from '@/ai/chat/country';
import { CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { CountryFlag } from '@/ui/chat/CountryFlag';
import { CountrySelector } from '@/ui/chat/CountrySelector';
import { Icon, type IconName } from '@/ui/icons';
import { ToolsMenu } from '@/ui/ToolsMenu';
import { tokens } from '@/ui/tokens';

export interface ChatMobileHeaderProps {
  chatbot: ChatbotId;
  chatbots: ChatbotId[];
  onSwitchChatbot: (id: ChatbotId) => void;
  switchDisabled?: boolean;
  /** Nouvelle conversation (absent = rien à réinitialiser : bouton masqué). */
  onNew?: () => void;
  /** Historique (comptes connectés seulement). */
  onHistory?: () => void;
  /** Export PDF (conversation non vide). */
  onExport?: () => void;
  sourcesCount: number;
  onSources: () => void;
  onFullscreen: () => void;
  country: CountryCode | null;
  onCountryChange: (code: CountryCode) => void;
  topInset: number;
}

export function ChatMobileHeader(props: ChatMobileHeaderProps) {
  const { chatbot, chatbots, onSwitchChatbot, switchDisabled, onNew, topInset } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const meta = CHATBOT_META[chatbot];
  const canPick = chatbots.length > 1;
  const insets = useSafeAreaInsets();

  // Action à lancer APRÈS la fermeture de la feuille (pays, outils, historique ouvrent
  // chacun leur propre fenêtre). Sur iOS natif, une fenêtre ne peut pas s'ouvrir pendant
  // que la précédente se ferme : elle ne s'afficherait pas, sans erreur. On attend donc
  // `onDismiss` (iOS seulement) ; ailleurs, l'ouverture immédiate fonctionne.
  const afterClose = useRef<(() => void) | null>(null);
  const closeMenuThen = (action: () => void) => {
    if (Platform.OS === 'ios') {
      afterClose.current = action;
      setMenuOpen(false);
    } else {
      setMenuOpen(false);
      action();
    }
  };
  const runAfterClose = () => {
    const action = afterClose.current;
    afterClose.current = null;
    action?.();
  };

  return (
    <View style={[styles.bar, { paddingTop: tokens.space.xs + topInset }]}>
      {/* Titre de page pour les lecteurs d'écran (l'en-tête d'ordinateur, qui le porte, est masqué ici). */}
      <Text style={styles.srOnly} accessibilityRole="header" aria-level={1}>
        Chat {meta.label.toLowerCase()}
      </Text>
      <IconButton icon="menu" label="Menu du chat" onPress={() => setMenuOpen(true)} />

      <Pressable
        onPress={() => canPick && setPickerOpen(true)}
        disabled={!canPick || switchDisabled}
        accessibilityRole={canPick ? 'button' : 'header'}
        accessibilityLabel={canPick ? `Chatbot : ${meta.label}. Changer de chatbot` : `Chat ${meta.label}`}
        aria-expanded={canPick ? pickerOpen : undefined}
        style={({ pressed }: { pressed: boolean }) => [styles.titleButton, pressed && styles.pressed]}
      >
        <Icon name={meta.icon} size={17} color={tokens.colors.accentDeep} />
        <Text style={styles.titleText} numberOfLines={1}>
          {canPick ? meta.shortLabel : 'Chat santé'}
        </Text>
        {canPick ? <Icon name="chevronDown" size={16} color={tokens.colors.textMuted} /> : null}
      </Pressable>

      {onNew ? (
        <IconButton icon="plus" label="Nouvelle conversation" onPress={onNew} />
      ) : (
        <View style={styles.iconSlot} />
      )}

      {/* ── Choix du chatbot ── */}
      <Modal visible={pickerOpen} transparent animationType="none" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.picker, { marginTop: topInset + 56 }]} onPress={(e) => e.stopPropagation()}>
            {chatbots.map((id) => {
              const m = CHATBOT_META[id];
              const active = id === chatbot;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setPickerOpen(false);
                    if (!active) onSwitchChatbot(id);
                  }}
                  accessibilityRole="radio"
                  aria-checked={active}
                  style={({ pressed }: { pressed: boolean }) => [styles.pickerItem, active && styles.pickerItemActive, pressed && styles.pressed]}
                >
                  <View style={styles.pickerIcon}>
                    <Icon name={m.icon} size={18} color={active ? tokens.colors.accentDeep : tokens.colors.textMuted} />
                  </View>
                  <View style={styles.pickerText}>
                    <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{m.label}</Text>
                    <Text style={styles.pickerHint} numberOfLines={2}>{m.description}</Text>
                  </View>
                  {active ? <Icon name="check" size={16} color={tokens.colors.accentDeep} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Menu (feuille en bas d'écran) ── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        onRequestClose={() => setMenuOpen(false)}
        onDismiss={runAfterClose}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: tokens.space['2xl'] + insets.bottom }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.grabber} />
            <MenuSection title="Conversation">
              {props.onHistory ? (
                <MenuRow icon="clock" label="Historique des conversations" onPress={() => closeMenuThen(() => props.onHistory?.())} />
              ) : null}
              {props.sourcesCount > 0 ? (
                <MenuRow
                  icon="bookOpen"
                  label="Sources de la réponse"
                  value={String(props.sourcesCount)}
                  onPress={() => closeMenuThen(props.onSources)}
                />
              ) : null}
              {props.onExport ? (
                <MenuRow icon="download" label="Exporter en PDF" onPress={() => closeMenuThen(() => props.onExport?.())} />
              ) : null}
              <MenuRow icon="maximize" label="Plein écran" onPress={() => closeMenuThen(props.onFullscreen)} />
            </MenuSection>
            <MenuSection title="Réglages">
              <MenuRow
                icon="globe"
                label="Pays des sources"
                value={props.country ? getCountry(props.country)?.name : 'Choisir'}
                valueFlag={props.country}
                chevron
                onPress={() => closeMenuThen(() => setCountryOpen(true))}
              />
            </MenuSection>
            <MenuSection title="Navigation">
              <MenuRow icon="layoutGrid" label="Outils et mon compte" chevron onPress={() => closeMenuThen(() => setToolsOpen(true))} />
            </MenuSection>
          </Pressable>
        </Pressable>
      </Modal>

      <CountrySelector
        value={props.country}
        onChange={props.onCountryChange}
        open={countryOpen}
        onOpenChange={setCountryOpen}
        hideTrigger
      />
      <ToolsMenu open={toolsOpen} onOpenChange={setToolsOpen} hideTrigger />
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(Platform.OS === 'web' ? { title: label } : {})}
      style={({ pressed }: { pressed: boolean }) => [styles.iconSlot, styles.iconButton, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={tokens.colors.text} />
    </Pressable>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  value,
  valueFlag,
  chevron,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  valueFlag?: CountryCode | null;
  chevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label} : ${value}` : label}
      style={({ pressed }: { pressed: boolean }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Icon name={icon} size={19} color={tokens.colors.accentDeep} />
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      {valueFlag ? <CountryFlag code={valueFlag} size={15} /> : null}
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {chevron ? <Icon name="chevronRight" size={16} color={tokens.colors.textMuted} /> : null}
    </Pressable>
  );
}

const ICON_SLOT = 44;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.xs,
    paddingBottom: tokens.space.xs,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  iconSlot: { width: ICON_SLOT, height: ICON_SLOT },
  // Masqué à l'écran, lu par les lecteurs d'écran.
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.pill },
  pressed: { opacity: 0.6 },
  titleButton: {
    flexShrink: 1,
    minHeight: ICON_SLOT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
  },
  titleText: {
    fontFamily: tokens.font.sans,
    fontSize: 17,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.text,
  },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', paddingHorizontal: tokens.space.md },
  picker: {
    width: '100%',
    maxWidth: 380,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xs,
    ...tokens.elevation.lg,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
  },
  pickerItemActive: { backgroundColor: tokens.colors.accentSurface },
  pickerIcon: { width: 24, alignItems: 'center' },
  pickerText: { flex: 1, gap: 2 },
  pickerLabel: { fontFamily: tokens.font.sans, fontSize: 16, fontWeight: tokens.weight.semibold, color: tokens.colors.text },
  pickerLabelActive: { color: tokens.colors.accentDeep },
  pickerHint: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.fontSize, lineHeight: 18, color: tokens.colors.textMuted },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tokens.colors.background,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    gap: tokens.space.md,
    ...tokens.elevation.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: tokens.colors.borderStrong,
    marginBottom: tokens.space.xs,
  },
  section: { gap: tokens.space.xs },
  sectionTitle: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    color: tokens.colors.textMuted,
    paddingHorizontal: tokens.space.sm,
  },
  sectionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.md,
  },
  rowPressed: { backgroundColor: tokens.colors.surfaceAlt },
  rowLabel: { flex: 1, fontFamily: tokens.font.sans, fontSize: 16, color: tokens.colors.text },
  rowValue: { fontFamily: tokens.font.sans, fontSize: 15, color: tokens.colors.textMuted, maxWidth: 140 },
});
