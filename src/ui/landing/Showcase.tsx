import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/ui/tokens';

import { SectionLabel } from './AudienceSwitcher';
import { SHOWCASE, type ShowcaseChapter } from './copy';
import { lx } from './lx';
import { useInView } from './MockParts';
import { SHOWCASE_MOCKS } from './ProductMocks';

/**
 * « Au-delà du chat » (ADR-0047) : défilement narratif ponctuel. Sur ordinateur, les chapitres
 * défilent à gauche et un écran collant, à droite, montre l'aperçu du chapitre en cours ;
 * l'aperçu change quand un chapitre passe le milieu de la fenêtre. Sous 1 024 px, chaque
 * chapitre porte son propre aperçu, joué à son entrée dans la fenêtre, et les chapitres
 * forment un carrousel horizontal à aimantation (la page mobile restait sinon très longue).
 *
 * Les deux mises en page sont dans le DOM et le CSS choisit (pré-rendu sans fenêtre) ; les
 * aperçus sont des images décrites, la lecture d'écran ne les rencontre qu'une fois.
 */
export function Showcase() {
  const [active, setActive] = useState<ShowcaseChapter['id']>('chat');
  const [stageRef, stageInView] = useInView<View>({ once: false, margin: '0px' });
  const chapterRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.chapter as ShowcaseChapter['id']);
        }
      },
      // Bande centrale de la fenêtre : un seul chapitre la traverse à la fois.
      { rootMargin: '-48% 0px -48% 0px' },
    );
    for (const node of Object.values(chapterRefs.current)) {
      if (node) observer.observe(node as unknown as Element);
    }
    return () => observer.disconnect();
  }, []);

  const ActiveMock = SHOWCASE_MOCKS[active];
  const activeChapter = SHOWCASE.find((c) => c.id === active)!;

  return (
    <View {...lx('lx-show')} style={styles.section}>
      <View {...lx('lx-container')} style={styles.page}>
        <View style={styles.head}>
          <SectionLabel index="02" label="Au-delà du chat" />
          <Text accessibilityRole="header" aria-level={2} style={styles.title}>
            Les outils qui suivent la conversation.
          </Text>
          <Text style={styles.intro}>
            Cinq écrans de MedInfo AI, tels qu’ils s’affichent. Les contenus des aperçus sont fictifs.
          </Text>
        </View>
        <View {...lx('lx-show-body')} style={styles.body}>
          {/* Sous 1 024 px : carrousel horizontal à aimantation (CSS), focalisable pour le défiler
              au clavier ; au-delà, colonne de chapitres face à l'écran collant. */}
          <View
            {...lx('lx-chapters')}
            role="region"
            aria-label="Cinq écrans de MedInfo AI"
            {...(Platform.OS === 'web' ? { tabIndex: 0 } : null)}
            style={styles.chapters}
          >
            {SHOWCASE.map((chapter) => (
              <Chapter
                key={chapter.id}
                chapter={chapter}
                active={chapter.id === active}
                register={(node) => {
                  chapterRefs.current[chapter.id] = node;
                }}
              />
            ))}
          </View>
          {/* Écran collant (ordinateur) : l'aperçu du chapitre en cours. */}
          <View {...lx(['lx-stage-col', 'ge1024'])} style={styles.stageCol}>
            <View ref={stageRef} {...lx('lx-stage')} style={styles.stage}>
              <View style={styles.stageMeta}>
                <Text style={styles.stageIndex}>{activeChapter.index}</Text>
                <View style={styles.stageDots}>
                  {SHOWCASE.map((c) => (
                    <View key={c.id} {...lx('lx-stage-dot', { on: c.id === active ? '1' : '0' })} style={[styles.stageDot, c.id === active && styles.stageDotOn]} />
                  ))}
                </View>
              </View>
              <View key={active} {...lx('lx-stage-mock')}>
                <ActiveMock on={stageInView} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function Chapter({ chapter, active, register }: { chapter: ShowcaseChapter; active: boolean; register: (node: View | null) => void }) {
  const [ref, inView] = useInView<View>();
  const Mock = SHOWCASE_MOCKS[chapter.id];
  return (
    <View
      ref={(node) => {
        register(node);
      }}
      {...lx('lx-chap', { chapter: chapter.id, active: active ? '1' : '0' })}
      style={styles.chapter}
    >
      <View style={styles.chapterHead}>
        <Text style={styles.chapterIndex}>{chapter.index}</Text>
        <Text style={styles.chapterAudience}>{chapter.audience}</Text>
      </View>
      <Text accessibilityRole="header" aria-level={3} style={styles.chapterTitle}>{chapter.title}</Text>
      <Text style={styles.chapterText}>{chapter.text}</Text>
      {/* Sous 1 024 px : l'aperçu suit son chapitre. */}
      <View ref={ref} {...lx(['lx-chap-mock', 'lt1024'])} style={styles.chapterMock}>
        <Mock on={inView} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: tokens.colors.background, paddingVertical: tokens.space['3xl'] },
  page: { width: '100%', maxWidth: tokens.layout.page, alignSelf: 'center', paddingHorizontal: tokens.space.lg, gap: tokens.space['2xl'] },
  head: { gap: tokens.space.md, maxWidth: 720 },
  title: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.display, fontWeight: tokens.weight.regular },
  intro: { fontFamily: tokens.font.sans, color: tokens.colors.textMuted, ...tokens.type.bodyLg },
  body: { gap: tokens.space['2xl'] },
  chapters: { gap: tokens.space['3xl'] },
  chapter: { gap: tokens.space.md },
  chapterHead: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.md },
  chapterIndex: { fontFamily: tokens.font.serif, fontStyle: 'italic', color: tokens.colors.accent, fontSize: 40, lineHeight: 44 },
  chapterAudience: { fontFamily: tokens.font.display, color: tokens.colors.textMuted, ...tokens.type.caption, fontWeight: tokens.weight.semibold },
  chapterTitle: { fontFamily: tokens.font.serif, color: tokens.colors.text, ...tokens.type.h1, fontWeight: tokens.weight.regular, maxWidth: 520 },
  chapterText: { fontFamily: tokens.font.sans, color: tokens.colors.textSubtle, ...tokens.type.bodyLg, maxWidth: 520 },
  chapterMock: { marginTop: tokens.space.md },
  stageCol: { flex: 1 },
  stage: { gap: tokens.space.md },
  stageMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stageIndex: { fontFamily: tokens.font.serif, fontStyle: 'italic', color: tokens.colors.accent, fontSize: 18, lineHeight: 22 },
  stageDots: { flexDirection: 'row', gap: 6 },
  stageDot: { width: 18, height: 3, borderRadius: 2, backgroundColor: tokens.colors.border },
  stageDotOn: { backgroundColor: tokens.colors.accentVivid, width: 32 },
});
