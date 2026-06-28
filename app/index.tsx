import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { visibleFeatures } from '@/ai/routing/featureVisibility';
import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/primitives/Button';
import { HeroBackdrop } from '@/ui/primitives/HeroBackdrop';
import { Icon, type IconName } from '@/ui/icons/icons';
import { LandingHeader } from '@/ui/components/LandingHeader';
import { PersonaCard, type PersonaId } from '@/ui/components/PersonaCard';
import { Reveal } from '@/ui/primitives/Reveal';
import { tokens } from '@/ui/theme/tokens';

/** Persona « santé » ciblée par une carte d'accueil (la carte `pro` → 'professional'). */
const CARD_PERSONA: Record<PersonaId, Persona> = {
  pro: 'professional',
  student: 'student',
  public: 'public',
};

const TRUST_POINTS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'shield',
    title: 'Sources officielles',
    text: 'Réponses appuyées sur HAS, ANSM, VIDAL, Thériaque, PubMed.',
  },
  {
    icon: 'sparkles',
    title: 'Transparence',
    text: 'Chaque échange rappelle qu’il s’agit d’une IA et reste vérifiable.',
  },
  {
    icon: 'bookOpen',
    title: 'Références gratuites',
    text: 'Les sources restent accessibles à tous, abonné ou non.',
  },
];

const PERSONAS: {
  id: PersonaId;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  icon: IconName;
  route: string;
}[] = [
  {
    id: 'pro',
    eyebrow: 'Professionnel',
    title: 'Support à la décision clinique',
    description: 'Calculateurs, recommandations HAS/ESC, interactions, synthèses fondées sur les preuves.',
    cta: 'Lancer une recherche',
    icon: 'stethoscope',
    route: '/(account)/choose-role',
  },
  {
    id: 'student',
    eyebrow: 'Étudiant',
    title: 'Apprendre, comprendre, réviser',
    description: 'Cas cliniques, physiopathologie, questions EDN, raisonnement guidé pas à pas.',
    cta: 'Poser ma question',
    icon: 'brain',
    route: '/(account)/choose-role',
  },
  {
    id: 'public',
    eyebrow: 'Grand public',
    title: 'Vos questions de santé, simplement',
    description: 'Comprenez votre traitement, vos symptômes, vos résultats — sans jargon, jamais un avis individuel.',
    cta: 'Commencer à parler ici',
    icon: 'users',
    route: '/(chat)/chat',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, persona } = useSession();

  const isAuthed = !!user;
  const isAdmin = user ? isAdminUserId(user.id) : false;

  // Refonte 2026-06 : étudiants, professionnels et admins accèdent aux 3 chats
  // (bascule libre dans l'écran chat) ; le grand public au chat public uniquement.
  const canSwitch = isAdmin || persona === 'student' || persona === 'professional';
  const availableChats: Persona[] = canSwitch ? ['public', 'student', 'professional'] : ['public'];

  const visiblePersonas = isAuthed
    ? PERSONAS.filter((p) => availableChats.includes(CARD_PERSONA[p.id]))
    : PERSONAS;

  const myTools = isAuthed ? visibleFeatures(persona, { isAdmin }) : [];

  function openPersonaChat(id: PersonaId) {
    router.push(`/(chat)/chat?bot=${CARD_PERSONA[id]}` as never);
  }

  return (
    <View style={styles.screen}>
      {/* Header de navigation (audit 2026-06) : logo + Tarifs / connexion / CTA,
          hors du ScrollView → reste visible pendant le défilement. */}
      <LandingHeader />
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero plein écran, fort contraste (petrol profond / blanc).
          Fond : grille millimétrée + tracé ECG dessiné au chargement (HeroBackdrop). */}
      <View style={styles.hero}>
        <HeroBackdrop />
        <View style={styles.heroInner}>
          <Reveal>
            <Text style={styles.eyebrowText}>Information médicale de référence</Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger}>
            <Text style={styles.headline}>
              Des réponses santé claires,{'\n'}sourcées et sans détour.
            </Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger * 2}>
            <Text style={styles.subhead}>
              Posez vos questions médicales et pharmacologiques. MedInfo AI répond à partir de la
              littérature française et européenne — information générale, jamais un avis individuel.
            </Text>
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 3} style={styles.actions}>
            <Button
              label={isAuthed ? 'Ouvrir le chat' : 'Essayer sans inscription'}
              variant="inverse"
              onPress={() => router.push('/(chat)/chat')}
            />
            {isAuthed ? (
              <Button
                label="Mon compte"
                variant="outlineLight"
                onPress={() => router.push('/(account)/account')}
              />
            ) : (
              <Button
                label="Se connecter"
                variant="outlineLight"
                onPress={() => router.push('/(auth)/sign-in')}
              />
            )}
          </Reveal>
          {!isAuthed ? (
            <Reveal delay={tokens.motion.revealStagger * 4}>
              <Text style={styles.trialHint}>
                Testez et envoyez votre premier message sans inscription — 1 message gratuit.
              </Text>
            </Reveal>
          ) : null}
        </View>
      </View>

      {/* Trois audiences — cartes persona */}
      <View style={styles.section}>
        <Reveal style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>
            {isAuthed ? 'Tes chats disponibles' : 'Une IA médicale, trois usages'}
          </Text>
          {isAuthed ? (
            <Text style={styles.sectionSubtitle}>
              Seuls les chats de tes rôles vérifiés sont affichés. Valide un nouveau rôle depuis
              ton compte pour débloquer les autres.
            </Text>
          ) : null}
        </Reveal>
        <View style={styles.personaGrid}>
          {visiblePersonas.map((p, i) => (
            <Reveal key={p.id} delay={tokens.motion.revealStagger * (i + 1)} style={styles.personaCell}>
              <PersonaCard
                persona={p.id}
                eyebrow={p.eyebrow}
                title={p.title}
                description={p.description}
                cta={isAuthed ? 'Ouvrir ce chat' : p.cta}
                icon={p.icon}
                // Essai sans inscription : les cartes ouvrent directement le chat sur le
                // bon onglet, connecté ou non (1 message gratuit pour les visiteurs).
                onPress={() => openPersonaChat(p.id)}
              />
            </Reveal>
          ))}
        </View>

        {/* Outils du rôle (connecté) : ECOS / Classement / Audio / Document selon le profil */}
        {isAuthed && myTools.length > 1 ? (
          <View style={styles.toolsBlock}>
            <Reveal style={styles.sectionHead}>
              <Text style={styles.sectionTitleSm}>Mes outils</Text>
            </Reveal>
            <View style={styles.toolsGrid}>
              {myTools
                .filter((t) => t.id !== 'chat')
                .map((t, i) => (
                  <Reveal key={t.id} delay={tokens.motion.revealStagger * i} style={styles.toolCell}>
                    <TouchableOpacity
                      style={styles.toolCard}
                      onPress={() => router.push(t.route as never)}
                      accessibilityRole="button"
                      accessibilityLabel={t.label}
                    >
                      <View style={styles.toolIcon}>
                        <Icon name={t.icon} size={20} color={tokens.colors.accent} />
                      </View>
                      <View style={styles.toolTextBlock}>
                        <Text style={styles.toolTitle}>{t.label}</Text>
                        <Text style={styles.toolText} numberOfLines={2}>
                          {t.description}
                        </Text>
                      </View>
                      <Icon name="arrowRight" size={16} color={tokens.colors.accent} />
                    </TouchableOpacity>
                  </Reveal>
                ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Bloc confiance sur fond alterné : un seul panneau, trois rangées
          (icône à côté du titre — pas une grille de cartes identiques). */}
      <View style={styles.sectionAlt}>
        <Reveal style={styles.trustPanel}>
          <Text style={styles.trustPanelTitle}>Conçu pour être vérifié</Text>
          {TRUST_POINTS.map((p, i) => (
            <View key={p.title} style={[styles.trustRow, i > 0 && styles.trustRowDivided]}>
              <View style={styles.trustIcon}>
                <Icon name={p.icon} size={20} color={tokens.colors.accent} />
              </View>
              <View style={styles.trustTextBlock}>
                <Text style={styles.trustTitle}>{p.title}</Text>
                <Text style={styles.trustText}>{p.text}</Text>
              </View>
            </View>
          ))}
        </Reveal>

        <Reveal style={styles.purpose}>
          <Text style={styles.purposeLabel}>Finalité prévue</Text>
          <Text style={styles.purposeText}>{INTENDED_PURPOSE}</Text>
        </Reveal>

        <Reveal style={styles.notice}>
          <View style={styles.noticeAccent} />
          <Text style={styles.noticeText}>{getAiDisclosure()}</Text>
        </Reveal>

        <View style={styles.footerActions}>
          <Button
            label="Accéder à mon compte"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push('/(account)/account')}
          />
          <Button
            label="Informations légales"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push('/(legal)/legal')}
          />
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },

  // ── Hero ──
  hero: {
    backgroundColor: tokens.colors.accentDarker,
    overflow: 'hidden',
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space['3xl'],
    alignItems: 'center',
  },
  heroInner: { width: '100%', maxWidth: 720, gap: tokens.space.md },
  // Kicker unique du hero : petites capitales sans pastille (sobre, une seule fois).
  eyebrowText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentSurfaceStrong,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
    letterSpacing: tokens.tracking.capsWide,
    textTransform: 'uppercase',
  },
  // Titre en Fraunces (serif éditoriale) : signature typographique de la marque.
  headline: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.hero.fontSize,
    lineHeight: tokens.type.hero.lineHeight,
    letterSpacing: tokens.type.hero.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  subhead: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.82)',
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
    maxWidth: 600,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space.lg,
    maxWidth: 420,
  },
  trialHint: {
    fontFamily: tokens.font.sans,
    color: 'rgba(255,255,255,0.72)',
    fontSize: tokens.type.caption.fontSize,
    marginTop: tokens.space.sm,
  },
  // ── Section personas ──
  section: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['3xl'],
    paddingBottom: tokens.space.xl,
    alignItems: 'center',
  },
  sectionHead: { width: '100%', maxWidth: 960, gap: tokens.space.xs, marginBottom: tokens.space.xl },
  sectionTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h1.fontSize,
    lineHeight: tokens.type.h1.lineHeight,
    letterSpacing: tokens.type.h1.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  sectionTitleSm: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
  },
  sectionSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
    marginTop: tokens.space.xs,
    maxWidth: 560,
  },
  personaGrid: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.lg,
  },
  personaCell: { flexGrow: 1, flexBasis: 260, flexDirection: 'row' },

  // ── Outils du rôle ──
  toolsBlock: { width: '100%', maxWidth: 960, marginTop: tokens.space['2xl'], gap: tokens.space.md },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  toolCell: { flexGrow: 1, flexBasis: 280, flexDirection: 'row' },
  toolCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.lg,
    ...tokens.elevation.sm,
    ...tokens.motion.transitionWeb,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTextBlock: { flex: 1, gap: 2 },
  toolTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.bold,
  },
  toolText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 17,
  },

  // ── Section claire alternée ──
  sectionAlt: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['2xl'],
    paddingBottom: tokens.space['3xl'],
    alignItems: 'center',
  },
  trustPanel: {
    width: '100%',
    maxWidth: 720,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    ...tokens.elevation.sm,
  },
  trustPanelTitle: {
    fontFamily: tokens.font.serif,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    lineHeight: tokens.type.h2.lineHeight,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.semibold,
    marginBottom: tokens.space.lg,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  trustRowDivided: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  trustIcon: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTextBlock: { flex: 1, gap: 2 },
  trustTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  trustText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
  purpose: {
    width: '100%',
    maxWidth: 720,
    marginTop: tokens.space.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
  },
  purposeLabel: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: tokens.tracking.caps,
  },
  purposeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 21,
  },
  notice: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    marginTop: tokens.space.md,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    backgroundColor: tokens.colors.warningBackground,
  },
  noticeAccent: { width: 4, backgroundColor: tokens.colors.warningText },
  noticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.warningText,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 19,
    padding: tokens.space.lg,
  },
  footerActions: {
    marginTop: tokens.space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
});
