/**
 * Home Screen — recent docs, today's flashcards due, active bundle progress
 */

import { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { documents, flashcardCards, bundles, bundleProgress, streaks } from '../../src/db/schema';
import { desc, eq, lte, sql } from 'drizzle-orm';
import { useSyncStore } from '../../src/offline/sync-engine';
import { useNetworkStore } from '../../src/offline/network-monitor';
import OfflineBanner from '../../src/components/OfflineBanner';
import SyncStatus from '../../src/components/SyncStatus';

export default function HomeScreen() {
  const router = useRouter();
  const [recentDocs, setRecentDocs] = useState<Array<{ id: string; title: string; slug: string; updatedAt: string }>>([]);
  const [dueCards, setDueCards] = useState(0);
  const [activeBundles, setActiveBundles] = useState<Array<{ slug: string; name: string; percent: number }>>([]);
  const [streak, setStreak] = useState({ current: 0, totalXP: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const isOnline = useNetworkStore(s => s.isOnline);
  const pendingCount = useSyncStore(s => s.pendingCount);

  const load = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [docs, cards, allBundles, strk] = await Promise.all([
      db.select({ id: documents.id, title: documents.title, slug: documents.slug, updatedAt: documents.updatedAt })
        .from(documents).orderBy(desc(documents.updatedAt)).limit(5).all(),
      db.select({ id: flashcardCards.id }).from(flashcardCards)
        .where(lte(flashcardCards.dueDate, today)).all(),
      db.select().from(bundles).limit(10).all(),
      db.select().from(streaks).where(eq(streaks.id, 'default')).all(),
    ]);

    setRecentDocs(docs);
    setDueCards(cards.length);
    setStreak({ current: strk[0]?.currentStreak || 0, totalXP: strk[0]?.totalXP || 0 });

    // Compute bundle progress
    const bundleData = await Promise.all(allBundles.map(async (b) => {
      const prog = await db.select().from(bundleProgress).where(eq(bundleProgress.bundleSlug, b.slug)).all();
      const completed = prog.filter(p => p.completed).length;
      const total = prog.length;
      return { slug: b.slug, name: b.name, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }));
    setActiveBundles(bundleData.filter(b => b.percent < 100 && b.percent > 0).slice(0, 3));
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
    >
      <OfflineBanner />

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <StatCard emoji="🔥" label="Streak" value={`${streak.current}d`} color="#f59e0b" />
        <StatCard emoji="⚡" label="XP" value={`${streak.totalXP}`} color="#3b82f6" />
        <StatCard emoji="🃏" label="Due" value={`${dueCards}`} color="#8b5cf6"
          onPress={() => router.push('/(tabs)/flashcards')} />
        {pendingCount > 0 && (
          <StatCard emoji="↑" label="Pending" value={`${pendingCount}`} color="#f97316"
            onPress={() => router.push('/sync')} />
        )}
      </View>

      {/* Due today CTA */}
      {dueCards > 0 && (
        <TouchableOpacity style={styles.studyCTA} onPress={() => router.push('/(tabs)/flashcards')}>
          <Text style={styles.studyCTAText}>📚 {dueCards} flashcard{dueCards > 1 ? 's' : ''} due today — Study now</Text>
          <Text style={styles.studyCTAArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Active bundles */}
      {activeBundles.length > 0 && (
        <Section title="Continue Learning">
          {activeBundles.map(b => (
            <TouchableOpacity key={b.slug} style={styles.bundleCard} onPress={() => router.push(`/bundle/${b.slug}`)}>
              <View style={styles.bundleInfo}>
                <Text style={styles.bundleName} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.bundlePercent}>{b.percent}% complete</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${b.percent}%` as `${number}%` }]} />
              </View>
            </TouchableOpacity>
          ))}
        </Section>
      )}

      {/* Recent docs */}
      <Section title="Recent Documents" action={{ label: 'All →', onPress: () => router.push('/(tabs)/vault') }}>
        {recentDocs.length === 0
          ? <Text style={styles.empty}>No documents yet. Import a bundle or sync your vault.</Text>
          : recentDocs.map(doc => (
            <TouchableOpacity key={doc.id} style={styles.docItem} onPress={() => router.push(`/doc/${doc.slug}`)}>
              <Text style={styles.docIcon}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                <Text style={styles.docDate}>{new Date(doc.updatedAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.docArrow}>›</Text>
            </TouchableOpacity>
          ))
        }
      </Section>

      {/* Quick actions */}
      <Section title="Quick Actions">
        <View style={styles.actionsGrid}>
          <ActionBtn emoji="📦" label="Import Bundle" onPress={() => router.push('/(tabs)/bundles')} />
          <ActionBtn emoji="🤖" label="AI Chat" onPress={() => router.push('/ai-chat')} />
          <ActionBtn emoji="🏫" label="Classroom" onPress={() => router.push('/classroom')} />
          <ActionBtn emoji="↕️" label="Sync" onPress={() => router.push('/sync')} />
        </View>
      </Section>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({ emoji, label, value, color, onPress }: {
  emoji: string; label: string; value: string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} disabled={!onPress}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && <TouchableOpacity onPress={action.onPress}><Text style={styles.sectionAction}>{action.label}</Text></TouchableOpacity>}
      </View>
      {children}
    </View>
  );
}

function ActionBtn({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Text style={{ fontSize: 24, marginBottom: 4 }}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  statCard: { flex: 1, backgroundColor: '#111118', borderRadius: 12, padding: 12, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 10, color: '#6b7280' },
  studyCTA: { margin: 16, backgroundColor: '#1e3a5f', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  studyCTAText: { color: '#93c5fd', fontSize: 13, fontWeight: '600', flex: 1 },
  studyCTAArrow: { color: '#3b82f6', fontSize: 18, fontWeight: '700' },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#e5e7eb', fontSize: 15, fontWeight: '700' },
  sectionAction: { color: '#3b82f6', fontSize: 13 },
  bundleCard: { backgroundColor: '#111118', borderRadius: 10, padding: 14, marginBottom: 8 },
  bundleInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bundleName: { color: '#e5e7eb', fontSize: 13, fontWeight: '600', flex: 1 },
  bundlePercent: { color: '#6b7280', fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  docIcon: { fontSize: 20 },
  docTitle: { color: '#e5e7eb', fontSize: 13, fontWeight: '500' },
  docDate: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  docArrow: { color: '#374151', fontSize: 18 },
  empty: { color: '#4b5563', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flex: 1, minWidth: '45%', backgroundColor: '#111118', borderRadius: 12, padding: 16, alignItems: 'center' },
  actionLabel: { color: '#9ca3af', fontSize: 11, textAlign: 'center', fontWeight: '500' },
});
