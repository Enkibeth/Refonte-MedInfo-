import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import type { Persona } from '@/ai/prompts/_schema';
import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/icons';
import { Logo } from '@/ui/Logo';
import { PersonaCard, type PersonaId } from '@/ui/PersonaCard';
import { Reveal } from '@/ui/Reveal';
import { tokens } from '@/ui/tokens';

/** Persona « santé » ciblée par une carte d'accueil (la carte `pro` → 'professional'). */
const CARD_PERSONA: Record<PersonaId, Persona> = {
  pro: 'professional',
  student: 'student',
  public: 'public',
};

const SOURCES = ['HAS', 'ANSM', 'VIDAL', 'THÉRIAQUE', 'PUBMED'];

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
    title: 'Décision clinique',
    description: 'Calculateurs, recommandations HAS/ESC, interactions, synthèses fondées sur les preuves.',
    cta: 'Lancer une recherche',
    icon: 'stethoscope',
    route: '/(account)/choose-role',
  },
  {
    id: 'student',
    eyebrow: 'Étudiant',
    title: 'Apprendre & réviser',
    description: 'Cas cliniques, physiopathologie, questions EDN, raisonnement guidé pas à pas.',
    cta: 'Poser ma question',
    icon: 'brain',
    route: '/(account)/choose-role',
  },
  {
    id: 'public',
    eyebrow: 'Grand public',
    title: 'Vos questions, simplement',
    description: 'Comprenez votre traitement, vos symptômes, vos résultats — sans jargon, jamais un avis individuel.',
    cta: 'Commencer à parler',
    icon: 'users',
    route: '/(chat)/chat',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, verifiedPersonas, persona, requestRole } = useSession();
  const [switching, setSwitching] = useState<PersonaId | null>(null);

  const isAuthed = !!user;

  const visiblePersonas = isAuthed
    ? PERSONAS.filter((p) => verifiedPersonas.includes(CARD_PERSONA[p.id]))
    : PERSONAS;

  async function openPersonaChat(id: PersonaId) {
    const target = CARD_PERSONA[id];
    if (target !== persona) {
      setSwitching(id);
      const res = await requestRole(target);
      setSwitching(null);
      if (res.error) return;
    }
    router.push('/(chat)/chat');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* ── Masthead ── */}
      <View style={styles.masthead}>
        <View style={styles.mastheadInner}>
          <Logo size="sm" />
          <View style={styles.mastheadMeta}>
            <Text style={styles.metaMono}>INFORMATION MÉDICALE</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaMono}>FR · 2026</Text>
          </View>
        </View>
      </View>

      {/* ── Hero : bloc encre, typographie massive empilée ── */}
      <View style={styles.hero}>
        <View style={styles.heroInner}>
          <Reveal>
            <Text style={styles.heroKicker}>RÉFÉRENCE MÉDICALE — / 01</Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger}>
            <Text style={styles.heroHeadline}>
              Des réponses{'\n'}santé sourcées.{'\n'}Sans détour.
            </Text>
          </Reveal>
          <View style={styles.heroDivider} />
          <Reveal delay={tokens.motion.revealStagger * 2}>
            <Text style={styles.heroSub}>
              Posez vos questions médicales et pharmacologiques. MedInfo AI répond à partir de la
              littérature française et européenne — information générale, jamais un avis individuel.
            </Text>
          </Reveal>

          <Reveal delay={tokens.motion.revealStagger * 3} style={styles.heroActions}>
            <Button label="Ouvrir le chat" variant="inverse" fullWidth={false} onPress={() => router.push('/(chat)/chat')} />
            {isAuthed ? (
              <Button label="Mon compte" variant="outlineLight" fullWidth={false} onPress={() => router.push('/(account)/account')} />
            ) : (
              <Button label="Se connecter" variant="outlineLight" fullWidth={false} onPress={() => router.push('/(auth)/sign-in')} />
            )}
          </Reveal>
        </View>

        {/* Bandeau sources — mono, séparé par un filet */}
        <View style={styles.ticker}>
          <Text style={styles.tickerLabel}>SOURCES</Text>
          {SOURCES.map((s) => (
            <View key={s} style={styles.tickerCell}>
              <Text style={styles.tickerText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Personas ── */}
      <View style={styles.section}>
        <Reveal style={styles.sectionHead}>
          <Text style={styles.sectionIndex}>/ 02 — {isAuthed ? 'MES ACCÈS' : 'POUR QUI ?'}</Text>
          <Text style={styles.sectionTitle}>
            {isAuthed ? 'Tes chats disponibles' : 'Une IA, trois usages.'}
          </Text>
          {isAuthed ? (
            <Text style={styles.sectionSub}>
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
                index={i}
                eyebrow={p.eyebrow}
                title={p.title}
                description={p.description}
                cta={isAuthed ? (switching === p.id ? 'Ouverture…' : 'Ouvrir ce chat') : p.cta}
                icon={p.icon}
                onPress={() => (isAuthed ? openPersonaChat(p.id) : router.push(p.route as never))}
              />
            </Reveal>
          ))}
        </View>
      </View>

      {/* ── Confiance ── */}
      <View style={styles.sectionAlt}>
        <Reveal style={styles.sectionHead}>
          <Text style={styles.sectionIndex}>/ 03 — POURQUOI NOUS FAIRE CONFIANCE</Text>
        </Reveal>
        <View style={styles.trustGrid}>
          {TRUST_POINTS.map((p, i) => (
            <Reveal key={p.title} delay={tokens.motion.revealStagger * i} style={styles.trustCell}>
              <View style={styles.trustCard}>
                <View style={styles.trustTop}>
                  <Text style={styles.trustNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={styles.trustIcon}>
                    <Icon name={p.icon} size={20} color={tokens.colors.onAccent} />
                  </View>
                </View>
                <Text style={styles.trustTitle}>{p.title}</Text>
                <Text style={styles.trustText}>{p.text}</Text>
              </View>
            </Reveal>
          ))}
        </View>

        <Reveal style={styles.purpose}>
          <Text style={styles.purposeLabel}>FINALITÉ PRÉVUE</Text>
          <Text style={styles.purposeText}>{INTENDED_PURPOSE}</Text>
        </Reveal>

        <Reveal style={styles.notice}>
          <View style={styles.noticeBar}>
            <Text style={styles.noticeBarText}>AVIS IA</Text>
          </View>
          <Text style={styles.noticeText}>{getAiDisclosure()}</Text>
        </Reveal>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>MEDINFO AI</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink} onPress={() => router.push('/(account)/account')}>
            Mon compte
          </Text>
          <Text style={styles.footerSep}>·</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(legal)/legal')}>
            Informations légales
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const MAXW = 1000;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { flexGrow: 1 },

  // ── Masthead ──
  masthead: {
    borderBottomWidth: tokens.border.bold,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.space.xl,
    alignItems: 'center',
  },
  mastheadInner: {
    width: '100%',
    maxWidth: MAXW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space.md,
  },
  mastheadMeta: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  metaMono: {
    fontFamily: tokens.font.mono,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    color: tokens.colors.textMuted,
  },
  metaDot: { width: 4, height: 4, backgroundColor: tokens.colors.accent },

  // ── Hero ──
  hero: {
    backgroundColor: tokens.colors.ink,
    borderBottomWidth: tokens.border.bold,
    borderBottomColor: tokens.colors.border,
    alignItems: 'center',
  },
  heroInner: {
    width: '100%',
    maxWidth: MAXW,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['4xl'],
    paddingBottom: tokens.space['3xl'],
  },
  heroKicker: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentSurfaceStrong,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
    marginBottom: tokens.space.xl,
  },
  heroHeadline: {
    fontFamily: tokens.font.display,
    color: tokens.colors.onInk,
    fontSize: tokens.type.hero.fontSize,
    lineHeight: tokens.type.hero.lineHeight,
    letterSpacing: tokens.type.hero.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  heroDivider: {
    height: tokens.border.bold,
    backgroundColor: tokens.colors.accent,
    width: 96,
    marginTop: tokens.space.xl,
    marginBottom: tokens.space.lg,
  },
  heroSub: {
    fontFamily: tokens.font.sans,
    color: 'rgba(235,231,220,0.78)',
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
    maxWidth: 560,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
    marginTop: tokens.space['2xl'],
  },

  // ── Ticker sources ──
  ticker: {
    width: '100%',
    maxWidth: MAXW,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    borderTopWidth: tokens.border.bold,
    borderTopColor: 'rgba(235,231,220,0.18)',
  },
  tickerLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentSurfaceStrong,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    borderRightWidth: tokens.border.hairline,
    borderRightColor: 'rgba(235,231,220,0.18)',
  },
  tickerCell: {
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    borderRightWidth: tokens.border.hairline,
    borderRightColor: 'rgba(235,231,220,0.18)',
    justifyContent: 'center',
  },
  tickerText: {
    fontFamily: tokens.font.mono,
    color: 'rgba(235,231,220,0.72)',
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
  },

  // ── Section générique ──
  section: {
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['4xl'],
    paddingBottom: tokens.space['3xl'],
    alignItems: 'center',
  },
  sectionHead: { width: '100%', maxWidth: MAXW, marginBottom: tokens.space['2xl'], gap: tokens.space.md },
  sectionIndex: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accent,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  sectionTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.display.fontSize,
    lineHeight: tokens.type.display.lineHeight,
    letterSpacing: tokens.type.display.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  sectionSub: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    maxWidth: 560,
  },
  personaGrid: {
    width: '100%',
    maxWidth: MAXW,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.lg,
  },
  personaCell: { flexGrow: 1, flexBasis: 260, flexDirection: 'row' },

  // ── Section alternée (confiance) ──
  sectionAlt: {
    backgroundColor: tokens.colors.surfaceAlt,
    borderTopWidth: tokens.border.bold,
    borderTopColor: tokens.colors.border,
    paddingHorizontal: tokens.space.xl,
    paddingTop: tokens.space['4xl'],
    paddingBottom: tokens.space['4xl'],
    alignItems: 'center',
  },
  trustGrid: {
    width: '100%',
    maxWidth: MAXW,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.lg,
  },
  trustCell: { flexGrow: 1, flexBasis: 240, flexDirection: 'row' },
  trustCard: {
    flex: 1,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.surfacePure,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    gap: tokens.space.sm,
  },
  trustTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.space.xs,
  },
  trustNum: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: -0.5,
  },
  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.none,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    lineHeight: tokens.type.h3.lineHeight,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  trustText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },

  // ── Finalité ──
  purpose: {
    width: '100%',
    maxWidth: MAXW,
    marginTop: tokens.space.xl,
    backgroundColor: tokens.colors.accent,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    padding: tokens.space.xl,
    gap: tokens.space.sm,
  },
  purposeLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentSurfaceStrong,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  purposeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.body.fontSize,
    lineHeight: 22,
  },

  // ── Avis IA ──
  notice: {
    width: '100%',
    maxWidth: MAXW,
    flexDirection: 'row',
    marginTop: tokens.space.md,
    borderWidth: tokens.border.bold,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.warningBackground,
  },
  noticeBar: {
    backgroundColor: tokens.colors.warningText,
    paddingHorizontal: tokens.space.md,
    justifyContent: 'center',
    borderRightWidth: tokens.border.bold,
    borderRightColor: tokens.colors.border,
  },
  noticeBarText: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.monoSm.fontSize,
    letterSpacing: tokens.type.monoSm.letterSpacing,
  },
  noticeText: {
    flex: 1,
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: 19,
    padding: tokens.space.lg,
  },

  // ── Footer ──
  footer: {
    borderTopWidth: tokens.border.bold,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.ink,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.md,
  },
  footerBrand: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.onInk,
    fontSize: tokens.type.mono.fontSize,
    letterSpacing: tokens.type.mono.letterSpacing,
  },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.md },
  footerLink: {
    fontFamily: tokens.font.sans,
    color: 'rgba(235,231,220,0.82)',
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  footerSep: { color: 'rgba(235,231,220,0.4)' },
});
