import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { isAdminUserId } from '@/admin/index';
import type { Persona } from '@/ai/prompts/_schema';
import { APP_FEATURES, visibleFeatures } from '@/ai/routing/featureVisibility';
import { INTENDED_PURPOSE, getAiDisclosure } from '@/compliance/disclosures';
import { PAGE_SEO, faqPageJsonLd, organizationJsonLd, webSiteJsonLd, type FaqItem } from '@/seo/meta';
import { Button } from '@/ui/Button';
import { HeroBackdrop } from '@/ui/HeroBackdrop';
import { Icon, type IconName } from '@/ui/icons';
import { LandingHeader } from '@/ui/LandingHeader';
import { PersonaCard, type PersonaId } from '@/ui/PersonaCard';
import { Reveal } from '@/ui/Reveal';
import { SeoHead } from '@/ui/SeoHead';
import { SiteFooter } from '@/ui/SiteFooter';
import { tokens } from '@/ui/tokens';

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
    text: 'Réponses appuyées sur HAS, ANSM, VIDAL, Thériaque, PubMed et les sociétés savantes.',
  },
  {
    icon: 'shieldCheck',
    title: 'Liens vérifiés un à un',
    text: 'Chaque lien cité est testé avant la rédaction de la réponse : zéro lien mort dans les sources.',
  },
  {
    icon: 'sparkles',
    title: 'Transparence',
    text: 'Chaque échange rappelle qu’il s’agit d’une IA ; les citations sont cliquables, avec le niveau de preuve.',
  },
  {
    icon: 'bookOpen',
    title: 'Références gratuites',
    text: 'Les sources restent accessibles à tous, abonné ou non.',
  },
];

/** Workflow agentique du chat (ADR-0030) — raconté côté produit. */
const WORKFLOW_STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'messageCircle',
    title: 'Vous posez votre question',
    text: 'Dans le chatbot adapté à votre profil (grand public, étudiant ou professionnel), au clavier ou à la voix.',
  },
  {
    icon: 'search',
    title: 'L’IA recherche de vraies sources',
    text: 'Recommandations HAS/ANSM/ESC, études via Europe PMC, essais cliniques ClinicalTrials.gov, et PubMed pour le chatbot professionnel.',
  },
  {
    icon: 'shieldCheck',
    title: 'Chaque lien est vérifié',
    text: 'Avant de rédiger, l’assistant teste un à un les liens qu’il va citer : les sources affichées existent réellement.',
  },
  {
    icon: 'fileText',
    title: 'Réponse claire et exploitable',
    text: 'Citations cliquables avec niveau de preuve, questions de suivi à cocher, historique privé et export PDF.',
  },
];

/** Libellé d'audience des outils (section « Une plateforme complète »). */
const PERSONA_LABEL: Record<Persona, string> = {
  public: 'Grand public',
  student: 'Étudiants',
  professional: 'Professionnels',
};

/**
 * FAQ de la landing — texte visible ET données structurées FAQPage (JSON-LD).
 * Information générale uniquement, jamais un avis médical individuel.
 */
const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'MedInfo AI est-il gratuit ?',
    answer:
      'Oui pour commencer : le premier message est gratuit, sans inscription, sur les trois chatbots. ' +
      'Un compte gratuit permet de continuer ; les abonnements lèvent seulement les limites de volume ' +
      'et débloquent des fonctions avancées. Les sources officielles (HAS, ANSM…) restent gratuites pour tous.',
  },
  {
    question: 'MedInfo AI remplace-t-il un médecin ou un pharmacien ?',
    answer:
      "Non. MedInfo AI fournit de l'information médicale générale, jamais un diagnostic ni un avis " +
      "individuel. En cas de symptôme inquiétant, consultez un professionnel de santé ; en cas d'urgence, " +
      'composez le 15 (SAMU) ou le 112.',
  },
  {
    question: "D'où viennent les réponses ?",
    answer:
      "L'assistant recherche en direct dans des sources réelles : recommandations HAS, ANSM et sociétés " +
      'savantes, littérature scientifique via Europe PMC et PubMed, essais cliniques ClinicalTrials.gov. ' +
      'Chaque lien cité est vérifié avant la rédaction, et chaque réponse affiche ses sources avec leur niveau de preuve.',
  },
  {
    question: 'Quelle différence entre les trois chatbots ?',
    answer:
      'Le chat grand public explique sans jargon ; le chat étudiant s’appuie sur les référentiels des ' +
      'Collèges (EDN/R2C) ; le chat professionnel cible la synthèse fondée sur les preuves, avec recherche ' +
      'PubMed et essais cliniques. Les comptes étudiants et professionnels vérifiés accèdent aux trois.',
  },
  {
    question: 'Quels outils au-delà du chat ?',
    answer:
      'Analyse de document médical avec citations ancrées (grand public), simulation ECOS, planning de ' +
      'révisions et analyse des partiels (étudiants), compte rendu de consultation dicté (professionnels), ' +
      'générateur de présentations et créateur de CV médical (étudiants et professionnels).',
  },
  {
    question: 'Mes conversations sont-elles privées ?',
    answer:
      'Oui : votre historique de conversations n’est visible que par vous (isolation stricte par compte) ' +
      'et vous pouvez l’exporter en PDF ou le supprimer. Les documents analysés ne sont jamais stockés.',
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
    description: 'Recommandations HAS/ESC, recherche PubMed et essais cliniques, interactions, synthèses fondées sur les preuves.',
    cta: 'Lancer une recherche',
    icon: 'stethoscope',
    route: '/(account)/choose-role',
  },
  {
    id: 'student',
    eyebrow: 'Étudiant',
    title: 'Comprendre et réviser',
    description: 'Cours fondés sur les Collèges (EDN/R2C), cas cliniques, ECOS, révisions, avec un raisonnement guidé pas à pas.',
    cta: 'Poser ma question',
    icon: 'brain',
    route: '/(account)/choose-role',
  },
  {
    id: 'public',
    eyebrow: 'Grand public',
    title: 'Vos questions de santé, en clair',
    description: "Comprenez votre traitement ou vos résultats d'analyses, sans jargon. Information générale, jamais un avis individuel.",
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
      <SeoHead
        title={PAGE_SEO.home.title}
        description={PAGE_SEO.home.description}
        path={PAGE_SEO.home.path}
        jsonLd={[organizationJsonLd(), webSiteJsonLd(), faqPageJsonLd(FAQ_ITEMS)]}
      />
      {/* Header de navigation (audit 2026-06) : logo + Tarifs / connexion / CTA,
          hors du ScrollView → reste visible pendant le défilement. */}
      <LandingHeader />
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero plein écran, fort contraste (bleu nuit profond / blanc).
          Fond : grille millimétrée + tracé ECG dessiné au chargement (HeroBackdrop). */}
      <View style={styles.hero}>
        <HeroBackdrop />
        <View style={styles.heroInner}>
          <Reveal>
            <Text style={styles.eyebrowText}>Information médicale de référence</Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger}>
            <Text style={styles.headline}>
              Des réponses santé sourcées,{'\n'}vérifiées lien par lien.
            </Text>
          </Reveal>
          <Reveal delay={tokens.motion.revealStagger * 2}>
            <Text style={styles.subhead}>
              Posez vos questions médicales et pharmacologiques. MedInfo AI recherche les
              recommandations et études en direct (HAS, ANSM, Europe PMC, ClinicalTrials.gov),
              vérifie chaque lien cité et répond avec ses sources. Information générale, jamais
              un avis individuel.
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
                Le premier message est gratuit, sans créer de compte.
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

      {/* Comment MedInfo AI répond — workflow agentique du chat (ADR-0030) :
          recherche de sources réelles + vérification des liens avant rédaction. */}
      <View style={styles.section}>
        <Reveal style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Comment MedInfo AI répond
          </Text>
          <Text style={styles.sectionSubtitle}>
            L’assistant recherche ses sources et les vérifie avant de rédiger.
          </Text>
        </Reveal>
        <View style={styles.workflowGrid}>
          {WORKFLOW_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={tokens.motion.revealStagger * i} style={styles.workflowCell}>
              <View style={styles.workflowCard}>
                <View style={styles.workflowTopRow}>
                  <View style={styles.toolIcon}>
                    <Icon name={step.icon} size={20} color={tokens.colors.accent} />
                  </View>
                  <Text style={styles.workflowIndex}>{String(i + 1).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.workflowTitle}>{step.title}</Text>
                <Text style={styles.workflowText}>{step.text}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>

      {/* Une plateforme complète — tous les outils par audience (visiteurs / découverte).
          Les comptes connectés ont déjà « Mes outils » ci-dessus, filtrés par rôle. */}
      {!isAuthed ? (
        <View style={styles.section}>
          <Reveal style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Les outils, au-delà du chat
            </Text>
            <Text style={styles.sectionSubtitle}>
              Simulation ECOS, analyse de document, présentations, CV médical : chaque rôle
              vérifié débloque les siens, inclus avec le compte.
            </Text>
          </Reveal>
          <View style={styles.toolsGridWide}>
            {APP_FEATURES.filter((f) => f.id !== 'chat').map((f, i) => (
              <Reveal key={f.id} delay={tokens.motion.revealStagger * (i % 3)} style={styles.toolCell}>
                <View style={styles.toolCard}>
                  <View style={styles.toolIcon}>
                    <Icon name={f.icon} size={20} color={tokens.colors.accent} />
                  </View>
                  <View style={styles.toolTextBlock}>
                    <View style={styles.toolTitleRow}>
                      <Text style={styles.toolTitle}>{f.label}</Text>
                      {f.personas.map((p) => (
                        <View key={p} style={styles.audiencePill}>
                          <Text style={styles.audiencePillText}>{PERSONA_LABEL[p]}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.toolText}>{f.description}</Text>
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        </View>
      ) : null}

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

      {/* FAQ — texte visible, miroir exact du JSON-LD FAQPage injecté dans <SeoHead>. */}
      <View style={styles.section}>
        <Reveal style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Questions fréquentes
          </Text>
        </Reveal>
        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={item.question} delay={tokens.motion.revealStagger * (i % 3)}>
              <View style={[styles.faqRow, i > 0 && styles.faqRowDivided]}>
                <Text style={styles.faqQuestion} accessibilityRole="header">
                  {item.question}
                </Text>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>

      <SiteFooter />
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
  // Titre en Source Serif 4 (serif éditoriale) : signature typographique de la marque.
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

  // ── Workflow du chat ──
  workflowGrid: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  workflowCell: { flexGrow: 1, flexBasis: 220, flexDirection: 'row' },
  workflowCard: {
    flex: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  workflowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workflowIndex: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.accentVivid,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.bold,
  },
  workflowTitle: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  workflowText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },

  // ── Outils du rôle ──
  toolsBlock: { width: '100%', maxWidth: 960, marginTop: tokens.space['2xl'], gap: tokens.space.md },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.md },
  toolsGridWide: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.md,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.space.xs,
  },
  audiencePill: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 1,
  },
  audiencePillText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.weight.semibold,
  },
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

  // ── FAQ ──
  faqList: {
    width: '100%',
    maxWidth: 720,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.xl,
    ...tokens.elevation.sm,
  },
  faqRow: { paddingVertical: tokens.space.lg, gap: tokens.space.xs },
  faqRowDivided: { borderTopWidth: 1, borderTopColor: tokens.colors.border },
  faqQuestion: {
    fontFamily: tokens.font.display,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    letterSpacing: tokens.type.h3.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  faqAnswer: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
    lineHeight: tokens.type.label.lineHeight,
  },
});
