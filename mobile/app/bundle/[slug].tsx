/**
 * Bundle Player v2 — mobile
 * v1: docs + flashcards + SM-2 progress
 * v2: + character avatar, TTS narration (expo-speech), comic strips, audio player
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { db } from '../../src/db/client';
import { bundles, bundleProgress } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as Speech from 'expo-speech';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Module { id: string; title: string; type: string; ref?: string; estimated_minutes?: number; required?: boolean; unlocks_after?: string[]; }
interface Course { title: string; modules: Module[]; }
interface CharacterConfig { name: string; style: string; primaryColor: string; voice?: { lang: string; pitch: number; rate: number }; catchphrases?: string[]; }
interface ComicPanel { id: string; character: string; expression: string; dialogue: string; backgroundDescription: string; action?: string; }
interface ComicStrip { title: string; panels: ComicPanel[]; }
interface AudioEpisode { file: string; title: string; duration: number; }
interface BundleManifest {
  version?: number;
  name: string;
  contents?: { docs?: string[] };
  character?: CharacterConfig;
  comics?: { strips: string[] };
  audio?: { episodes: AudioEpisode[] };
  features?: Record<string, boolean>;
}

type SpriteState = 'idle' | 'talking' | 'explaining' | 'celebrating' | 'thinking';
type ContentTab = 'content' | 'comics';

const EXPR_EMOJI: Record<SpriteState, string> = {
  idle: '😊', talking: '💬', explaining: '🤓', celebrating: '🎉', thinking: '🤔',
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BundlePlayerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  // Core
  const [course, setCourse] = useState<Course | null>(null);
  const [bundle, setBundle] = useState<{ name: string; description: string | null } | null>(null);
  const [manifest, setManifest] = useState<BundleManifest | null>(null);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState<JSZip | null>(null);
  const startTime = useRef(Date.now());

  // v2 state
  const [isV2, setIsV2] = useState(false);
  const [charState, setCharState] = useState<SpriteState>('idle');
  const [narrating, setNarrating] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentTab>('content');
  const [comicStrips, setComicStrips] = useState<ComicStrip[]>([]);
  const [comicStripIdx, setComicStripIdx] = useState(0);
  const [comicPanelIdx, setComicPanelIdx] = useState(0);
  const charPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!slug) return;
    load();
  }, [slug]);

  const load = async () => {
    if (!slug) return;
    const b = await db.select().from(bundles).where(eq(bundles.slug, slug)).all();
    if (!b[0]) { setLoading(false); return; }
    setBundle({ name: b[0].name, description: b[0].description });

    const filePath = b[0].filePath || `${FileSystem.documentDirectory}bundles/${slug}.ib`;
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      const z = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
      setZip(z);

      // Parse manifest
      const mf = z.file('manifest.json');
      const manifestData: BundleManifest = mf ? JSON.parse(await mf.async('string')) : {};
      setManifest(manifestData);

      const docs: string[] = manifestData?.contents?.docs || [];
      const syntheticCourse: Course = {
        title: manifestData?.name || slug,
        modules: docs.map((p: string, i: number) => ({
          id: `mod-${String(i + 1).padStart(2, '0')}`,
          title: p.replace('docs/', '').replace('.md', '').replace(/-/g, ' '),
          type: 'doc', ref: p, estimated_minutes: 20, required: true,
          unlocks_after: i > 0 ? [`mod-${String(i).padStart(2, '0')}`] : undefined,
        })),
      };
      setCourse(syntheticCourse);

      // v2 detection
      if (manifestData.version === 2) {
        setIsV2(true);
        // Load comic strips from zip
        if (manifestData.comics?.strips?.length) {
          const strips: ComicStrip[] = [];
          for (const stripPath of manifestData.comics.strips) {
            const f = z.file(stripPath);
            if (f) {
              try {
                const data = JSON.parse(await f.async('string'));
                strips.push(data);
              } catch { /* skip corrupt strip */ }
            }
          }
          setComicStrips(strips);
        }
      }

      // Progress
      const prog = await db.select().from(bundleProgress).where(eq(bundleProgress.bundleSlug, slug)).all();
      const progMap: Record<string, boolean> = {};
      prog.forEach(p => { progMap[p.moduleId] = p.completed ?? false; });
      setProgress(progMap);

      const firstUnfinished = syntheticCourse.modules.findIndex(m => !progMap[m.id]);
      setModuleIdx(firstUnfinished >= 0 ? firstUnfinished : 0);
    } catch (e) {
      console.error('Bundle load error:', e);
    }
    setLoading(false);
  };

  // Load module content
  useEffect(() => {
    if (!course || !zip) return;
    loadModuleContent(course.modules[moduleIdx]);
    startTime.current = Date.now();
    setCharState('explaining');
    stopNarration();
  }, [moduleIdx, course, zip]);

  const loadModuleContent = async (mod: Module) => {
    if (!zip || !mod.ref) return;
    const f = zip.file(mod.ref);
    if (f) setContent(await f.async('string'));
    else setContent(`# ${mod.title}\n\n*Content not available offline.*`);
  };

  // Character pulse animation when narrating
  useEffect(() => {
    if (narrating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(charPulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(charPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      charPulse.stopAnimation();
      Animated.timing(charPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [narrating]);

  const markComplete = async () => {
    if (!slug || !course) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const mod = course.modules[moduleIdx];
    const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
    const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, slug + mod.id);

    await db.insert(bundleProgress).values({
      id: id.slice(0, 36), bundleSlug: slug, moduleId: mod.id,
      completed: true, timeSpentSeconds: timeSpent,
      completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [bundleProgress.bundleSlug, bundleProgress.moduleId],
      set: { completed: true, completedAt: new Date().toISOString(), timeSpentSeconds: timeSpent },
    });

    setProgress(p => ({ ...p, [mod.id]: true }));
    setCharState('celebrating');
    setTimeout(() => setCharState('idle'), 3000);
    if (moduleIdx + 1 < course.modules.length) setModuleIdx(i => i + 1);
  };

  // TTS
  const toggleNarration = async () => {
    if (narrating) { stopNarration(); return; }
    if (!content) return;

    const text = content.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').slice(0, 2000);
    const voice = manifest?.character?.voice;
    setNarrating(true);
    setCharState('talking');

    Speech.speak(text, {
      language: voice?.lang ?? 'en-IN',
      pitch: voice?.pitch ?? 1.0,
      rate: voice?.rate ?? 0.9,
      onDone: () => { setNarrating(false); setCharState('idle'); },
      onStopped: () => { setNarrating(false); setCharState('idle'); },
    });
  };

  const stopNarration = () => {
    Speech.stop();
    setNarrating(false);
    setCharState('idle');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;
  if (!course || !bundle) return <View style={styles.center}><Text style={styles.errText}>Bundle not found</Text></View>;

  const mod = course.modules[moduleIdx];
  const completedCount = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedCount / course.modules.length) * 100);
  const isCurrentDone = progress[mod?.id];
  const char = manifest?.character;
  const hasComics = isV2 && comicStrips.length > 0;
  const strip = comicStrips[comicStripIdx];
  const panel = strip?.panels[comicPanelIdx];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stopNarration(); router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{bundle.name}</Text>
          <Text style={styles.headerSub}>{completedCount}/{course.modules.length} · {pct}%</Text>
        </View>
        {isV2 && <Text style={styles.v2Badge}>v2</Text>}
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
      </View>

      {/* v2 Character strip */}
      {isV2 && char && (
        <View style={styles.charStrip}>
          <Animated.View style={[styles.charAvatar, { transform: [{ scale: charPulse }], backgroundColor: char.primaryColor + 'cc', borderColor: char.primaryColor }]}>
            <Text style={styles.charInitial}>{char.name[0]}</Text>
          </Animated.View>
          <View style={styles.charInfo}>
            <Text style={styles.charName}>{char.name}</Text>
            <Text style={styles.charState}>{EXPR_EMOJI[charState]} {charState}</Text>
          </View>
          <TouchableOpacity
            onPress={toggleNarration}
            style={[styles.narrateBtn, narrating && styles.narrateBtnActive]}
          >
            <Text style={styles.narrateBtnText}>{narrating ? '⏹' : '🔊'}</Text>
          </TouchableOpacity>
          {narrating && (
            <View style={styles.narratingDot}>
              <Text style={styles.narratingText}>Narrating...</Text>
            </View>
          )}
        </View>
      )}

      {/* Tab bar (v2 with comics) */}
      {hasComics && (
        <View style={styles.tabBar}>
          {(['content', 'comics'] as ContentTab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                {t === 'content' ? '📄 Content' : `📖 Comics (${comicStrips.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Module scroll (content tab only) */}
      {activeTab === 'content' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleScroll} contentContainerStyle={styles.moduleList}>
          {course.modules.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modBtn, i === moduleIdx && styles.modBtnActive, progress[m.id] && styles.modBtnDone]}
              onPress={() => { stopNarration(); setModuleIdx(i); }}
            >
              <Text style={styles.modBtnText} numberOfLines={1}>{progress[m.id] ? '✓ ' : ''}{m.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content area */}
      {activeTab === 'content' && (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentPad}>
          <Markdown style={markdownStyle}>{content}</Markdown>
          {/* Character catchphrase on celebration */}
          {isV2 && char && charState === 'celebrating' && char.catchphrases?.[0] && (
            <View style={styles.catchphrase}>
              <Text style={styles.catchphraseText}>"{char.catchphrases[0]}"</Text>
              <Text style={styles.catchphraseName}>— {char.name}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Comic viewer */}
      {activeTab === 'comics' && strip && panel && (
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentPad}>
          {/* Strip selector */}
          {comicStrips.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {comicStrips.map((s, i) => (
                <TouchableOpacity key={i} onPress={() => { setComicStripIdx(i); setComicPanelIdx(0); }}
                  style={[styles.modBtn, comicStripIdx === i && styles.modBtnActive]}>
                  <Text style={styles.modBtnText}>Strip {i + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.comicTitle}>{strip.title}</Text>
          <Text style={styles.comicPanelMeta}>Panel {comicPanelIdx + 1} of {strip.panels.length} · {panel.expression}</Text>

          {/* Character circle */}
          <View style={[styles.comicCharCircle, { backgroundColor: (char?.primaryColor ?? '#6366f1') + 'cc', borderColor: char?.primaryColor ?? '#6366f1' }]}>
            <Text style={styles.comicCharInitial}>{panel.character[0]?.toUpperCase()}</Text>
          </View>

          {/* Speech bubble */}
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>{panel.dialogue}</Text>
            <View style={styles.speechTail} />
          </View>

          {/* Scene description */}
          <Text style={styles.sceneDesc}>📍 {panel.backgroundDescription}</Text>
          {panel.action && <Text style={styles.sceneAction}>✋ {panel.action}</Text>}

          {/* Panel navigation */}
          <View style={styles.panelNav}>
            <TouchableOpacity
              onPress={() => setComicPanelIdx(i => Math.max(0, i - 1))}
              disabled={comicPanelIdx === 0}
              style={[styles.navBtn, comicPanelIdx === 0 && { opacity: 0.3 }]}
            >
              <Text style={styles.navBtnText}>← Prev</Text>
            </TouchableOpacity>
            {/* Panel dots */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {strip.panels.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setComicPanelIdx(i)}>
                  <View style={[styles.panelDot, comicPanelIdx === i && styles.panelDotActive]} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setComicPanelIdx(i => Math.min(strip.panels.length - 1, i + 1))}
              disabled={comicPanelIdx === strip.panels.length - 1}
              style={[styles.navBtn, comicPanelIdx === strip.panels.length - 1 && { opacity: 0.3 }]}
            >
              <Text style={styles.navBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Bottom bar (content tab) */}
      {activeTab === 'content' && (
        <View style={styles.bottomBar}>
          {moduleIdx > 0 && (
            <TouchableOpacity style={styles.navBtn} onPress={() => { stopNarration(); setModuleIdx(i => i - 1); }}>
              <Text style={styles.navBtnText}>← Prev</Text>
            </TouchableOpacity>
          )}
          {!isCurrentDone
            ? <TouchableOpacity style={styles.completeBtn} onPress={markComplete}>
                <Text style={styles.completeBtnText}>Mark Complete ✓</Text>
              </TouchableOpacity>
            : <Text style={styles.doneBadge}>✓ Completed</Text>
          }
          {moduleIdx < course.modules.length - 1 && (
            <TouchableOpacity style={styles.navBtn} onPress={() => { stopNarration(); if (!isCurrentDone) markComplete(); else setModuleIdx(i => i + 1); }}>
              <Text style={styles.navBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  errText: { color: '#9ca3af' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  backBtn: { paddingRight: 12 },
  backText: { color: '#6366f1', fontSize: 20 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 11 },
  v2Badge: { fontSize: 10, color: '#818cf8', backgroundColor: '#1e1b4b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#3730a3' },

  progressTrack: { height: 2, backgroundColor: '#1f2937' },
  progressFill: { height: '100%', backgroundColor: '#6366f1' },

  // Character strip
  charStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', paddingHorizontal: 12, paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  charAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  charInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  charInfo: { flex: 1 },
  charName: { color: '#e5e7eb', fontSize: 12, fontWeight: '600' },
  charState: { color: '#6b7280', fontSize: 10 },
  narrateBtn: { backgroundColor: '#1f1f2e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  narrateBtnActive: { backgroundColor: '#7f1d1d' },
  narrateBtnText: { fontSize: 14 },
  narratingDot: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  narratingText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { color: '#6b7280', fontSize: 12 },
  tabTextActive: { color: '#e5e7eb', fontWeight: '600' },

  // Module scroll
  moduleScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  moduleList: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  modBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
  modBtnActive: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  modBtnDone: { borderColor: '#065f46', backgroundColor: '#064e3b' },
  modBtnText: { color: '#9ca3af', fontSize: 11, maxWidth: 110 },

  // Content
  contentScroll: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 40 },

  // Catchphrase
  catchphrase: { marginTop: 24, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: '#6366f1' },
  catchphraseText: { color: '#a5b4fc', fontSize: 14, fontStyle: 'italic', lineHeight: 22 },
  catchphraseName: { color: '#6366f1', fontSize: 11, fontWeight: '600', marginTop: 6 },

  // Comic
  comicTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  comicPanelMeta: { color: '#6b7280', fontSize: 11, marginBottom: 16, textTransform: 'capitalize' },
  comicCharCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16, borderWidth: 3 },
  comicCharInitial: { color: '#fff', fontSize: 28, fontWeight: '700' },
  speechBubble: { backgroundColor: '#fff', borderRadius: 16, borderBottomLeftRadius: 4, padding: 14, marginBottom: 20, position: 'relative', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  speechText: { color: '#111827', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  speechTail: { position: 'absolute', bottom: -10, left: 16, width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 0, borderTopWidth: 10, borderLeftColor: 'transparent', borderTopColor: '#fff' },
  sceneDesc: { color: '#6b7280', fontSize: 12, fontStyle: 'italic', textAlign: 'center', marginBottom: 6 },
  sceneAction: { color: '#4b5563', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  panelNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  panelDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#374151' },
  panelDotActive: { backgroundColor: '#6366f1' },

  // Bottom bar
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#111118', borderTopWidth: 1, borderTopColor: '#1f1f2e' },
  navBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  navBtnText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  completeBtn: { backgroundColor: '#065f46', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  completeBtnText: { color: '#6ee7b7', fontSize: 13, fontWeight: '700' },
  doneBadge: { color: '#6ee7b7', fontSize: 13 },
});

const markdownStyle = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 26, backgroundColor: 'transparent' },
  heading1: { color: '#f9fafb', fontSize: 22, fontWeight: '700' as const, marginBottom: 12, marginTop: 20 },
  heading2: { color: '#f3f4f6', fontSize: 18, fontWeight: '700' as const, marginBottom: 8, marginTop: 16 },
  heading3: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' as const, marginBottom: 6, marginTop: 12 },
  paragraph: { color: '#d1d5db', lineHeight: 24, marginBottom: 12 },
  code_inline: { color: '#a5b4fc', backgroundColor: '#1e1b4b', borderRadius: 4, paddingHorizontal: 4 },
  code_block: { backgroundColor: '#111118', padding: 12, borderRadius: 8, marginBottom: 12 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#6366f1', paddingLeft: 12, marginBottom: 12 },
  list_item: { color: '#d1d5db', marginBottom: 6 },
};
