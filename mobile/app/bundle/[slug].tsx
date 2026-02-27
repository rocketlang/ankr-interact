/**
 * Bundle Player — linear course reader for .ib bundles (mobile)
 * Route: /bundle/:slug
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
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

interface Module { id: string; title: string; type: string; ref?: string; estimated_minutes?: number; required?: boolean; unlocks_after?: string[]; }
interface Course { title: string; modules: Module[]; }

export default function BundlePlayerScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [bundle, setBundle] = useState<{ name: string; description: string | null } | null>(null);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState<JSZip | null>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!slug) return;
    load();
  }, [slug]);

  const load = async () => {
    if (!slug) return;
    const b = await db.select().from(bundles).where(eq(bundles.slug, slug)).all();
    if (!b[0]) { setLoading(false); return; }
    setBundle({ name: b[0].name, description: b[0].description });

    // Load .ib file
    const filePath = b[0].filePath || `${FileSystem.documentDirectory}bundles/${slug}.ib`;
    try {
      const base64 = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      const z = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
      setZip(z);

      const mf = z.file('manifest.json');
      const manifest = mf ? JSON.parse(await mf.async('string')) : null;
      const docs: string[] = manifest?.contents?.docs || [];

      const syntheticCourse: Course = {
        title: manifest?.name || slug,
        modules: docs.map((p: string, i: number) => ({
          id: `mod-${String(i + 1).padStart(2, '0')}`,
          title: p.replace('docs/', '').replace('.md', '').replace(/-/g, ' '),
          type: 'doc',
          ref: p,
          estimated_minutes: 20,
          required: true,
          unlocks_after: i > 0 ? [`mod-${String(i).padStart(2, '0')}`] : undefined,
        })),
      };
      setCourse(syntheticCourse);

      // Load saved progress
      const prog = await db.select().from(bundleProgress).where(eq(bundleProgress.bundleSlug, slug)).all();
      const progMap: Record<string, boolean> = {};
      prog.forEach(p => { progMap[p.moduleId] = p.completed ?? false; });
      setProgress(progMap);

      // Resume from last unfinished module
      const firstUnfinished = syntheticCourse.modules.findIndex(m => !progMap[m.id]);
      setModuleIdx(firstUnfinished >= 0 ? firstUnfinished : 0);
    } catch (e) {
      console.error('Bundle load error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!course || !zip) return;
    loadModuleContent(course.modules[moduleIdx]);
    startTime.current = Date.now();
  }, [moduleIdx, course, zip]);

  const loadModuleContent = async (mod: Module) => {
    if (!zip || !mod.ref) return;
    const f = zip.file(mod.ref);
    if (f) setContent(await f.async('string'));
    else setContent(`# ${mod.title}\n\n*Content not available offline.*`);
  };

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
    }).onConflictDoUpdate({ target: [bundleProgress.bundleSlug, bundleProgress.moduleId], set: { completed: true, completedAt: new Date().toISOString(), timeSpentSeconds: timeSpent } });

    setProgress(p => ({ ...p, [mod.id]: true }));
    if (moduleIdx + 1 < course.modules.length) setModuleIdx(i => i + 1);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>;
  if (!course || !bundle) return <View style={styles.center}><Text style={styles.errText}>Bundle not found</Text></View>;

  const mod = course.modules[moduleIdx];
  const completedCount = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedCount / course.modules.length) * 100);
  const isCurrentDone = progress[mod?.id];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{bundle.name}</Text>
          <Text style={styles.headerSub}>{completedCount}/{course.modules.length} · {pct}%</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
      </View>

      {/* Module list (horizontal scroll) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleScroll} contentContainerStyle={styles.moduleList}>
        {course.modules.map((m, i) => (
          <TouchableOpacity key={m.id} style={[styles.modBtn, i === moduleIdx && styles.modBtnActive, progress[m.id] && styles.modBtnDone]} onPress={() => setModuleIdx(i)}>
            <Text style={styles.modBtnText} numberOfLines={1}>{progress[m.id] ? '✓ ' : ''}{m.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentPad}>
        <Markdown style={markdownStyle}>{content}</Markdown>
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {moduleIdx > 0 && (
          <TouchableOpacity style={styles.navBtn} onPress={() => setModuleIdx(i => i - 1)}>
            <Text style={styles.navBtnText}>← Prev</Text>
          </TouchableOpacity>
        )}
        {!isCurrentDone
          ? <TouchableOpacity style={styles.completeBtn} onPress={markComplete}><Text style={styles.completeBtnText}>Mark Complete ✓</Text></TouchableOpacity>
          : <Text style={styles.doneBadge}>✓ Completed</Text>
        }
        {moduleIdx < course.modules.length - 1 && (
          <TouchableOpacity style={styles.navBtn} onPress={() => { if (!isCurrentDone) markComplete(); else setModuleIdx(i => i + 1); }}>
            <Text style={styles.navBtnText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  errText: { color: '#9ca3af' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  backBtn: { paddingRight: 12 },
  backText: { color: '#3b82f6', fontSize: 16 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 11 },
  progressTrack: { height: 2, backgroundColor: '#1f2937' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6' },
  moduleScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  moduleList: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  modBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#111118', borderRadius: 20, borderWidth: 1, borderColor: '#374151' },
  modBtnActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a5f' },
  modBtnDone: { borderColor: '#065f46', backgroundColor: '#064e3b' },
  modBtnText: { color: '#9ca3af', fontSize: 11, maxWidth: 120 },
  contentScroll: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 40 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#111118', borderTopWidth: 1, borderTopColor: '#1f1f2e' },
  navBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  navBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  completeBtn: { backgroundColor: '#065f46', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  completeBtnText: { color: '#6ee7b7', fontSize: 13, fontWeight: '700' },
  doneBadge: { color: '#6ee7b7', fontSize: 13 },
});

const markdownStyle = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 26, backgroundColor: 'transparent' },
  heading1: { color: '#f9fafb', fontSize: 22, fontWeight: '700' as const, marginBottom: 12, marginTop: 20 },
  heading2: { color: '#f3f4f6', fontSize: 18, fontWeight: '700' as const, marginBottom: 8, marginTop: 16 },
  heading3: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' as const, marginBottom: 6, marginTop: 12 },
  paragraph: { color: '#d1d5db', marginBottom: 12 },
  code_inline: { backgroundColor: '#1f2937', color: '#60a5fa', borderRadius: 4, padding: 2, fontFamily: 'monospace' },
  fence: { backgroundColor: '#111827', borderRadius: 8, padding: 12, marginVertical: 8 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#3b82f6', paddingLeft: 12, marginLeft: 0, backgroundColor: '#111827' },
  strong: { color: '#f9fafb', fontWeight: '700' as const },
  link: { color: '#60a5fa', textDecorationLine: 'underline' as const },
};
