/**
 * ECOS — Examen Clinique Objectif Structuré.
 * Simulation patient–étudiant avec évaluation IA sur grille de correction.
 * Accès réservé aux étudiants en santé (persona student).
 */
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';

import { useSession } from '@/auth/AuthProvider';
import { tokens } from '@/ui/tokens';
import { MarkdownRenderer } from '@/ui/MarkdownRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EcosCase {
  id: string;
  titre: string;
  specialite: string;
  duree: number;
  consigneCandidat: string;
  briefPatient: string;
  grilleCorrection: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Cas cliniques intégrés ─────────────────────────────────────────────────

const ECOS_CASES: EcosCase[] = [
  {
    id: 'douleur-thoracique',
    titre: 'Douleur thoracique aiguë',
    specialite: 'Cardiologie · Urgences',
    duree: 10,
    consigneCandidat:
      'M. Bernard, 58 ans, consulte aux urgences pour une douleur thoracique depuis 2 heures. Réalisez l\'interrogatoire et proposez votre démarche diagnostique.',
    briefPatient: `Tu joues le rôle du patient M. Bernard, 58 ans, cadre stressé.
SYMPTÔMES : douleur thoracique rétrosternale en étau depuis 2h, irradiant dans le bras gauche et la mâchoire, 8/10. Sueurs, nausées. Pas de dyspnée au repos.
ATCD : HTA traitée (amlodipine), dyslipidémie (statine), tabagisme actif 30 PA, père décédé d'un IDM à 62 ans.
COMPORTEMENT : tu es anxieux, tu penses à une crise cardiaque. Tu réponds aux questions précisément mais n'offres pas spontanément les infos. Tu nies la consommation d'alcool.
Ne révèle pas le diagnostic. Réponds naturellement comme un patient, sans termes médicaux.`,
    grilleCorrection: `## Grille d'évaluation — Douleur thoracique

**Interrogatoire (6 pts)**
- Caractéristiques de la douleur : siège, type, irradiations, intensité /2
- Facteurs déclenchants / calmants /1
- Signes associés : sueurs, nausées, dyspnée /1
- ATCD cardiovasculaires personnels et familiaux /1
- Facteurs de risque : tabac, HTA, dyslipidémie /1

**Diagnostic (4 pts)**
- Évoque SCA en premier /2
- Diagnostics différentiels (EP, dissection aortique) /1
- Urgence reconnue, appel SAMU /1

**Examens complémentaires (3 pts)**
- ECG en urgence /1
- Troponines (×2 à 3h) /1
- Bilan biologique (NFS, ionogramme, bilan de coagulation) /1

**Communication (3 pts)**
- Empathie, ton rassurant /1
- Explication claire au patient /1
- Appel de l'équipe médicale / organisation /1`,
  },
  {
    id: 'cephalees-febriles',
    titre: 'Céphalées aiguës fébriles',
    specialite: 'Neurologie · Infectiologie',
    duree: 10,
    consigneCandidat:
      'Mme Léa, 24 ans, étudiante, consulte pour des céphalées intenses depuis 24h avec de la fièvre. Évaluez la situation et orientez votre diagnostic.',
    briefPatient: `Tu joues le rôle de Léa, 24 ans, étudiante en droit, fiancée, sans ATCD.
SYMPTÔMES : céphalée diffuse très intense (10/10) apparue brutalement hier soir, fièvre à 39°C, photophobie, nausées, nuque raide. Ce matin tu as remarqué de petites taches rouges sur les jambes.
COMPORTEMENT : tu es effrayée, la lumière te fait mal (grimace si on te parle de lumière), tu parles doucement car la voix résonne dans ta tête.
ENTOURAGE : ta coloc a eu une grippe la semaine passée mais elle va bien.
Ne révèle pas le diagnostic. Réponds naturellement, sans termes médicaux. Montre ta détresse.`,
    grilleCorrection: `## Grille d'évaluation — Céphalées fébriles

**Interrogatoire (5 pts)**
- Caractère brutal du début (en coup de tonnerre ?) /1
- Fièvre, frissons /1
- Signes méningés : photophobie, phonophobie, raideur de nuque /1
- Purpura (taches cutanées) /1
- Contage récent, vie en collectivité /1

**Diagnostic (4 pts)**
- Méningite bactérienne évoquée en premier /2
- Purpura fulminans reconnu comme urgence absolue /1
- Diagnostics différentiels (méningite virale, HSA) /1

**Prise en charge (4 pts)**
- Appel du SAMU 15 immédiat /2
- Ceftriaxone IV sans attendre (si purpura) /1
- Isolement / protection /1

**Communication (3 pts)**
- Rassure sans minimiser la gravité /1
- Explique la démarche /1
- Prévient l'entourage pour antibioprophylaxie /1`,
  },
  {
    id: 'dyspnee-aigue',
    titre: 'Dyspnée aiguë',
    specialite: 'Cardiologie · Pneumologie',
    duree: 10,
    consigneCandidat:
      'M. Dumont, 72 ans, est amené par son épouse pour une dyspnée progressive depuis 6h. Évaluez et prenez en charge.',
    briefPatient: `Tu joues le rôle de M. Dumont, 72 ans, retraité, avec son épouse présente.
SYMPTÔMES : tu es très essoufflé (tu parles par petites phrases), tu as du mal à t'allonger (orthopnée 3 oreillers), tu toussotes une mousse rosée. Œdème des chevilles depuis 3 jours.
ATCD : insuffisance cardiaque (FE 35%), fibrillation auriculaire, HTA. Médicaments : furosémide, bisoprolol, ramipril, apixaban.
AVEU IMPORTANT : tu as arrêté le furosémide il y a 5 jours car tu avais "trop envie d'uriner". Tu le diras seulement si on te pose la question sur tes médicaments.
COMPORTEMENT : anxieux, tu transpires, tu restes assis, tu t'exprimes avec peine.`,
    grilleCorrection: `## Grille d'évaluation — Dyspnée aiguë

**Interrogatoire (5 pts)**
- Délai et mode d'installation /1
- Orthopnée, DPN /1
- Toux, expectoration rosée /1
- ATCD : IC, FA, traitements /1
- Observance médicamenteuse (arrêt furosémide) /1

**Diagnostic (3 pts)**
- Œdème aigu pulmonaire sur IC décompensée /2
- Facteur déclenchant identifié (non-observance) /1

**Prise en charge (4 pts)**
- Position demi-assise, O2 /1
- Diurétiques IV (furosémide) /1
- Monitorage (SaO2, TA, ECG) /1
- Appel réanimation si aggravation /1

**Communication (4 pts)**
- Réassurance du patient et de l'épouse /1
- Explication simple de la situation /1
- Importance de l'observance expliquée /1
- Pas de jargon médical /1`,
  },
  {
    id: 'douleur-abdominale',
    titre: 'Douleur abdominale aiguë',
    specialite: 'Chirurgie · Gastroentérologie',
    duree: 10,
    consigneCandidat:
      'Mme Sophie, 32 ans, consulte pour une douleur abdominale aiguë en fosse iliaque droite. Réalisez l\'interrogatoire et proposez une démarche.',
    briefPatient: `Tu joues le rôle de Sophie, 32 ans, secrétaire, enceinte de 8 semaines (test positif il y a 3 semaines, grossesse non suivie).
SYMPTÔMES : douleur en FID depuis 12h, de plus en plus intense (7/10), à bascule. Nausées. Pas de fièvre (37,2°C). Dernières règles il y a 8 semaines. Saignements vaginaux légers depuis ce matin.
COMPORTEMENT : tu révèles la grossesse seulement si on te demande directement si tu peux être enceinte. Tu as peur. Tu n'as pas encore dit à ton compagnon.
POINT CLÉ : tu ne sais pas si c'est une grossesse intra-utérine, tu as juste fait un test urinaire.`,
    grilleCorrection: `## Grille d'évaluation — Douleur abdominale

**Interrogatoire (6 pts)**
- Caractéristiques de la douleur /1
- Signes digestifs associés /1
- Recherche active de grossesse (INTERROGATOIRE SYSTÉMATIQUE) /2
- Méno-métrorragies /1
- ATCD gynécologiques (GEU, salpingite, DIU, chirurgie) /1

**Diagnostic (4 pts)**
- GEU évoquée en priorité /2
- Appendicite en diagnostic différentiel /1
- Conscience de l'urgence /1

**Examens (3 pts)**
- β-hCG quantitatif /1
- Échographie pelvienne en urgence /1
- NFS, groupe sanguin, rhésus /1

**Communication (3 pts)**
- Annonce bienveillante de la situation /1
- Urgence expliquée sans créer de panique /1
- Confidentialité respectée /1`,
  },
];

// ── Composants ─────────────────────────────────────────────────────────────

function CaseCard({ cas, onSelect }: { cas: EcosCase; onSelect: () => void }) {
  return (
    <TouchableOpacity style={caseStyles.card} onPress={onSelect} accessibilityRole="button">
      <View style={caseStyles.cardHeader}>
        <Text style={caseStyles.cardTitle}>{cas.titre}</Text>
        <View style={caseStyles.badge}>
          <Text style={caseStyles.badgeText}>{cas.duree} min</Text>
        </View>
      </View>
      <Text style={caseStyles.cardSpecialite}>{cas.specialite}</Text>
      <Text style={caseStyles.cardConsigne} numberOfLines={2}>
        {cas.consigneCandidat}
      </Text>
    </TouchableOpacity>
  );
}

function Timer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expired = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (!expired.current) {
            expired.current = true;
            onExpire();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 60;

  return (
    <View style={[timerStyles.wrap, isLow && timerStyles.wrapLow]}>
      <Text style={[timerStyles.text, isLow && timerStyles.textLow]}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ── Écran ECOS ─────────────────────────────────────────────────────────────

type Phase = 'selection' | 'preparation' | 'simulation' | 'evaluation';

export default function EcosScreen() {
  const { persona } = useSession();
  const [phase, setPhase] = useState<Phase>('selection');
  const [selectedCase, setSelectedCase] = useState<EcosCase | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [evaluation, setEvaluation] = useState('');
  const [evalLoading, setEvalLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  if (persona !== 'student') {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateCard}>
          <Text style={styles.emoji}>🩺</Text>
          <Text style={styles.gateTitle}>Réservé aux étudiants</Text>
          <Text style={styles.gateText}>
            Le module ECOS est conçu pour les étudiants en santé. Changez votre profil en
            « Étudiant en santé » pour y accéder.
          </Text>
          <Link href="/(account)/choose-role" style={styles.gateLink}>
            Gérer mon profil
          </Link>
        </View>
      </View>
    );
  }

  function selectCase(cas: EcosCase) {
    setSelectedCase(cas);
    setMessages([]);
    setEvaluation('');
    setPhase('preparation');
  }

  function startSimulation() {
    setPhase('simulation');
    setMessages([{
      role: 'assistant',
      content: '*[L\'examinateur entre dans la salle]* Bonjour, vous pouvez commencer.',
    }]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || aiLoading || !selectedCase) return;
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setAiLoading(true);

    const systemPrompt = `${selectedCase.briefPatient}

RÈGLES :
- Tu joues uniquement le patient. Réponds en caractère de patient, jamais en tant qu'IA.
- Si l'étudiant sort du cadre médical, recentre sur le motif de consultation.
- Réponses courtes (2-4 phrases), naturelles, sans termes médicaux.`;

    try {
      const res = await fetch('/api/ecos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'simulate',
          systemPrompt,
          messages: newMessages,
        }),
      });

      if (!res.ok) throw new Error('Erreur de réponse.');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Flux indisponible.');

      const decoder = new TextDecoder();
      let reply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
      }

      if (reply.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply.trim() }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '[Erreur de communication. Réessayez.]' },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function finishEcos() {
    if (!selectedCase || messages.length < 2) return;
    setPhase('evaluation');
    setEvalLoading(true);

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'ÉTUDIANT' : 'PATIENT'}: ${m.content}`)
      .join('\n\n');

    const evalSystemPrompt = `Tu es un examinateur ECOS expert. Évalue l'étudiant en markdown structuré avec ces sections :

## Résultat global
Note estimée sur 20 avec justification courte.

## Points forts
Éléments bien maîtrisés (référence à la grille).

## Axes d'amélioration
Points manquants ou insuffisants (référence à la grille).

## Feedback pédagogique
2-3 conseils pratiques pour progresser.

Sois précis, bienveillant et pédagogique.`;

    try {
      const res = await fetch('/api/ecos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'evaluate',
          systemPrompt: evalSystemPrompt,
          messages: [
            {
              role: 'user',
              content: `Grille de correction du cas "${selectedCase.titre}" :\n\n${selectedCase.grilleCorrection}\n\nTranscription de la simulation :\n\n${transcript}`,
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Erreur d\'évaluation.');
      const data = await res.json() as { evaluation?: string };
      setEvaluation(data.evaluation ?? 'Évaluation non disponible.');
    } catch {
      setEvaluation('Une erreur est survenue lors de l\'évaluation.');
    } finally {
      setEvalLoading(false);
    }
  }

  // ── Phase : sélection ──────────────────────────────────────────────────
  if (phase === 'selection') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.selectionContent}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>Simulation ECOS</Text>
          <Text style={styles.selectionSubtitle}>
            Choisissez un cas clinique pour simuler une consultation avec un patient IA et obtenir
            une évaluation sur grille.
          </Text>
        </View>
        {ECOS_CASES.map((cas) => (
          <CaseCard key={cas.id} cas={cas} onSelect={() => selectCase(cas)} />
        ))}
      </ScrollView>
    );
  }

  // ── Phase : préparation ────────────────────────────────────────────────
  if (phase === 'preparation' && selectedCase) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.prepContent}>
        <View style={styles.prepHeader}>
          <TouchableOpacity onPress={() => setPhase('selection')} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.prepTitle}>{selectedCase.titre}</Text>
          <View style={styles.prepBadge}>
            <Text style={styles.prepBadgeText}>{selectedCase.specialite}</Text>
          </View>
        </View>

        <View style={styles.consigneCard}>
          <Text style={styles.consigneLabel}>Consigne candidat</Text>
          <Text style={styles.consigneText}>{selectedCase.consigneCandidat}</Text>
        </View>

        <View style={styles.prepInfo}>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>⏱</Text>
            <Text style={styles.prepInfoText}>Durée : {selectedCase.duree} min</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>📋</Text>
            <Text style={styles.prepInfoText}>Évaluation sur grille à la fin</Text>
          </View>
          <View style={styles.prepInfoItem}>
            <Text style={styles.prepInfoEmoji}>🤖</Text>
            <Text style={styles.prepInfoText}>Le patient est joué par l'IA</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startSimulation}>
          <Text style={styles.startText}>Démarrer la simulation</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Phase : simulation ─────────────────────────────────────────────────
  if (phase === 'simulation' && selectedCase) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.simHeader}>
          <View>
            <Text style={styles.simTitle}>{selectedCase.titre}</Text>
            <Text style={styles.simSubtitle}>{selectedCase.specialite}</Text>
          </View>
          <Timer
            totalSeconds={selectedCase.duree * 60}
            onExpire={finishEcos}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.simMessages}
          contentContainerStyle={styles.simMessagesContent}
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.simBubble,
                m.role === 'user' ? styles.simBubbleUser : styles.simBubblePatient,
              ]}
            >
              <Text style={styles.simBubbleRole}>
                {m.role === 'user' ? 'Vous' : 'Patient'}
              </Text>
              <Text
                style={m.role === 'user' ? styles.simTextUser : styles.simTextPatient}
              >
                {m.content}
              </Text>
            </View>
          ))}
          {aiLoading && (
            <View style={styles.simTyping}>
              <ActivityIndicator color={tokens.colors.accent} size="small" />
              <Text style={styles.simTypingText}>Le patient répond…</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.simFooter}>
          <View style={styles.simInputRow}>
            <TextInput
              style={styles.simInput}
              value={input}
              onChangeText={setInput}
              placeholder="Votre question au patient…"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              editable={!aiLoading}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.simSend, (aiLoading || !input.trim()) && styles.simSendDisabled]}
              onPress={sendMessage}
              disabled={aiLoading || !input.trim()}
            >
              <Text style={styles.simSendText}>→</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.finishButton} onPress={finishEcos}>
            <Text style={styles.finishText}>Terminer et évaluer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Phase : évaluation ─────────────────────────────────────────────────
  if (phase === 'evaluation') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.evalContent}>
        <View style={styles.evalHeader}>
          <Text style={styles.evalTitle}>Évaluation</Text>
          <Text style={styles.evalSubtitle}>{selectedCase?.titre}</Text>
        </View>

        {evalLoading ? (
          <View style={styles.evalLoading}>
            <ActivityIndicator color={tokens.colors.accent} size="large" />
            <Text style={styles.evalLoadingText}>Évaluation en cours…</Text>
          </View>
        ) : (
          <View style={styles.evalResult}>
            <MarkdownRenderer text={evaluation} />
          </View>
        )}

        <TouchableOpacity
          style={styles.retryEcos}
          onPress={() => {
            setPhase('selection');
            setSelectedCase(null);
            setMessages([]);
            setEvaluation('');
          }}
        >
          <Text style={styles.retryEcosText}>Nouvelle simulation</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },

  // Selection
  selectionContent: { padding: tokens.space.lg, gap: tokens.space.md },
  selectionHeader: { marginBottom: tokens.space.sm },
  selectionTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
    lineHeight: tokens.type.h2.lineHeight,
  },
  selectionSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: 4,
  },

  // Preparation
  prepContent: { padding: tokens.space.lg, gap: tokens.space.md },
  prepHeader: { gap: tokens.space.xs },
  backButton: { marginBottom: tokens.space.xs },
  backText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accent,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },
  prepTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  prepBadge: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  prepBadgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  consigneCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  consigneLabel: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consigneText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.bodyLg.fontSize,
    lineHeight: tokens.type.bodyLg.lineHeight,
  },
  prepInfo: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceAlt,
    padding: tokens.space.lg,
    gap: tokens.space.sm,
  },
  prepInfoItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm },
  prepInfoEmoji: { fontSize: 18 },
  prepInfoText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
  },
  startButton: {
    height: 52,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.elevation.sm,
  },
  startText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: tokens.type.body.fontSize,
  },

  // Simulation
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  simTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  simSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.caption.fontSize,
    marginTop: 2,
  },
  simMessages: { flex: 1 },
  simMessagesContent: { padding: tokens.space.lg, gap: tokens.space.md },
  simBubble: { maxWidth: '88%', borderRadius: tokens.radius.lg, padding: tokens.space.md, gap: 4 },
  simBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colors.accent,
    borderBottomRightRadius: 6,
  },
  simBubblePatient: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderBottomLeftRadius: 6,
  },
  simBubbleRole: {
    fontFamily: tokens.font.mono,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: tokens.weight.medium,
  },
  simTextUser: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  simTextPatient: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  simTyping: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    padding: tokens.space.sm,
  },
  simTypingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  simFooter: {
    padding: tokens.space.md,
    gap: tokens.space.sm,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderColor: tokens.colors.border,
  },
  simInputRow: { flexDirection: 'row', gap: tokens.space.sm, alignItems: 'flex-end' },
  simInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceSunken,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.fontSize,
    color: tokens.colors.text,
  },
  simSend: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simSendDisabled: { opacity: 0.45 },
  simSendText: {
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.bold,
    fontSize: 20,
  },
  finishButton: {
    height: 40,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    fontWeight: tokens.weight.medium,
  },

  // Evaluation
  evalContent: { padding: tokens.space.lg, gap: tokens.space.md },
  evalHeader: { gap: 4 },
  evalTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h2.fontSize,
    letterSpacing: tokens.type.h2.letterSpacing,
    fontWeight: tokens.weight.bold,
  },
  evalSubtitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  evalLoading: { alignItems: 'center', gap: tokens.space.lg, padding: tokens.space['2xl'] },
  evalLoadingText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.label.fontSize,
  },
  evalResult: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    ...tokens.elevation.sm,
  },
  retryEcos: {
    height: 48,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tokens.space.sm,
    ...tokens.elevation.sm,
  },
  retryEcosText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
  },

  // Gate
  gateContainer: { flex: 1, justifyContent: 'center', padding: tokens.space.xl, backgroundColor: tokens.colors.background },
  gateCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.xl,
    alignItems: 'center',
    gap: tokens.space.md,
    ...tokens.elevation.md,
  },
  emoji: { fontSize: 40 },
  gateTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    letterSpacing: tokens.type.h3.letterSpacing,
    textAlign: 'center',
  },
  gateText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textMuted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlign: 'center',
    maxWidth: 340,
  },
  gateLink: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.onAccent,
    fontWeight: tokens.weight.semibold,
    fontSize: tokens.type.label.fontSize,
    backgroundColor: tokens.colors.accent,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.lg,
    overflow: 'hidden',
    marginTop: tokens.space.sm,
  },
});

const caseStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.space.lg,
    gap: tokens.space.xs,
    ...tokens.elevation.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.text,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
    flex: 1,
    marginRight: tokens.space.sm,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.accentSurface,
    borderWidth: 1,
    borderColor: tokens.colors.accentSurfaceStrong,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.accentDeep,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.weight.semibold,
  },
  cardSpecialite: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: tokens.weight.medium,
  },
  cardConsigne: {
    fontFamily: tokens.font.sans,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.label.fontSize,
    lineHeight: 20,
    marginTop: 2,
  },
});

const timerStyles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  wrapLow: { backgroundColor: tokens.colors.dangerBackground, borderColor: tokens.colors.danger },
  text: {
    fontFamily: tokens.font.mono,
    color: tokens.colors.textSubtle,
    fontSize: tokens.type.h3.fontSize,
    fontWeight: tokens.weight.bold,
  },
  textLow: { color: tokens.colors.danger },
});
