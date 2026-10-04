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

import type { ChatbotId } from '@/ai/chat/chatContext';
import { getCountry, type CountryCode } from '@/ai/chat/country';
import { CHATBOT_META } from '@/ui/chat/ChatbotSwitcher';
import { CountrySelector } from '@/ui/chat/CountrySelector';
import { Icon } from '@/ui/icons';
import { HeaderIconButton as IconButton, MenuRow, MenuSection, MobileSheet, sheetStyles } from '@/ui/MobileSheet';
import { NavigationSheet } from '@/ui/AppMobileHeader';
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
  /** Visiteur non connecté : le menu de navigation mène à l'accueil et à la connexion. */
  isGuest?: boolean;
}

export function ChatMobileHeader(props: ChatMobileHeaderProps) {
  const { chatbot, chatbots, onSwitchChatbot, switchDisabled, onNew, topInset } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const meta = CHATBOT_META[chatbot];
  const canPick = chatbots.length > 1;

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
    <View style={[sheetStyles.bar, { paddingTop: tokens.space.xs + topInset }]}>
      {/* Titre de page pour les lecteurs d'écran (l'en-tête d'ordinateur, qui le porte, est masqué ici). */}
      <Text style={sheetStyles.srOnly} accessibilityRole="header" aria-level={1}>
        Chat {meta.label.toLowerCase()}
      </Text>
      <IconButton icon="menu" label="Menu du chat" expanded={menuOpen} onPress={() => setMenuOpen(true)} />

      <Pressable
        onPress={() => canPick && setPickerOpen(true)}
        disabled={!canPick || switchDisabled}
        // Un seul chatbot : simple libellé (le titre de page est porté par le h1 masqué).
        accessibilityRole={canPick ? 'button' : undefined}
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
        <View style={sheetStyles.iconSlot} />
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
      <MobileSheet visible={menuOpen} onClose={() => setMenuOpen(false)} onDismiss={runAfterClose} label="Menu du chat">
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
              <MenuRow
                icon={props.isGuest ? 'userRound' : 'layoutGrid'}
                label={props.isGuest ? 'Accueil et connexion' : 'Outils et mon compte'}
                chevron
                onPress={() => closeMenuThen(() => setToolsOpen(true))}
              />
            </MenuSection>
      </MobileSheet>

      <CountrySelector
        value={props.country}
        onChange={props.onCountryChange}
        open={countryOpen}
        onOpenChange={setCountryOpen}
        hideTrigger
      />
      <NavigationSheet visible={toolsOpen} onClose={() => setToolsOpen(false)} />
    </View>
  );
}

const ICON_SLOT = 44;

const styles = StyleSheet.create({
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

});
