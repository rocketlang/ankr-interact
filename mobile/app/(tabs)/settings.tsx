/**
 * Settings Screen — profile, sync config, language, tier, about
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { settings, documents, bundles, flashcardCards } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { useSyncStore } from '../../src/offline/sync-engine';
import { useNetworkStore } from '../../src/offline/network-monitor';

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'हिंदी' },
  { code: 'ta', name: 'தமிழ்' }, { code: 'te', name: 'తెలుగు' },
  { code: 'bn', name: 'বাংলা' }, { code: 'mr', name: 'मराठी' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('en');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [stats, setStats] = useState({ docs: 0, bundles: 0, cards: 0 });
  const { lastSyncedAt, pendingCount } = useSyncStore();
  const { isOnline, connectionType } = useNetworkStore();

  useEffect(() => {
    Promise.all([
      db.select({ c: documents.id }).from(documents).all(),
      db.select({ c: bundles.id }).from(bundles).all(),
      db.select({ c: flashcardCards.id }).from(flashcardCards).all(),
    ]).then(([d, b, c]) => setStats({ docs: d.length, bundles: b.length, cards: c.length }));

    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'language')).all()
      .then(r => r[0] && setLang(r[0].value));
  }, []);

  const saveLang = async (code: string) => {
    setLang(code);
    await db.insert(settings).values({ key: 'language', value: code })
      .onConflictDoUpdate({ target: settings.key, set: { value: code } });
  };

  const clearVault = () => Alert.alert('Clear Vault', 'This will delete all local documents. Synced data will remain on the server.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: async () => { await db.delete(documents); setStats(s => ({ ...s, docs: 0 })); } },
  ]);

  return (
    <ScrollView style={styles.container}>
      {/* Status */}
      <View style={styles.statusCard}>
        <View style={[styles.dot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
        <Text style={styles.statusText}>{isOnline ? `Online (${connectionType || 'wifi'})` : 'Offline'}</Text>
        {pendingCount > 0 && <Text style={styles.pendingBadge}>{pendingCount} pending</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Stat label="Documents" value={stats.docs} emoji="📄" />
        <Stat label="Bundles" value={stats.bundles} emoji="📦" />
        <Stat label="Flashcards" value={stats.cards} emoji="🃏" />
      </View>

      {/* Sync */}
      <Section title="Sync">
        <Row label="Cloud Sync" right={<Switch value={syncEnabled} onValueChange={setSyncEnabled} trackColor={{ true: '#3b82f6' }} />} />
        {syncEnabled && (
          <Row label="Sync Status" right={
            <TouchableOpacity onPress={() => router.push('/sync')}>
              <Text style={styles.linkText}>{lastSyncedAt ? `Last: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Never synced'} →</Text>
            </TouchableOpacity>
          } />
        )}
      </Section>

      {/* Language */}
      <Section title="Language">
        <View style={styles.langGrid}>
          {LANGUAGES.map(l => (
            <TouchableOpacity key={l.code} style={[styles.langBtn, lang === l.code && styles.langBtnActive]} onPress={() => saveLang(l.code)}>
              <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Row label="Flashcard Reminders" right={<Switch value={notificationsOn} onValueChange={setNotificationsOn} trackColor={{ true: '#3b82f6' }} />} />
        <Row label="Assignment Deadlines" right={<Switch value={notificationsOn} onValueChange={setNotificationsOn} trackColor={{ true: '#3b82f6' }} />} />
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Dark Mode" right={<Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#3b82f6' }} />} />
      </Section>

      {/* Data */}
      <Section title="Data">
        <TouchableOpacity style={styles.dangerBtn} onPress={clearVault}>
          <Text style={styles.dangerText}>🗑  Clear Local Vault</Text>
        </TouchableOpacity>
      </Section>

      {/* About */}
      <Section title="About">
        <Row label="Version" right={<Text style={styles.muted}>1.0.0 (Phase C)</Text>} />
        <Row label="License" right={<Text style={styles.muted}>Apache 2.0</Text>} />
        <Row label="Made by" right={<Text style={styles.muted}>ANKR Labs, Gurgaon 🇮🇳</Text>} />
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Stat({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  statusCard: { margin: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 12, padding: 12, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#9ca3af', fontSize: 13, flex: 1 },
  pendingBadge: { backgroundColor: '#f97316', color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: '#111118', borderRadius: 12, padding: 12, alignItems: 'center', gap: 3 },
  statValue: { color: '#e5e7eb', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 10 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  sectionBody: { backgroundColor: '#111118', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  rowLabel: { color: '#e5e7eb', fontSize: 13 },
  muted: { color: '#6b7280', fontSize: 13 },
  linkText: { color: '#3b82f6', fontSize: 12 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1f1f2e', borderRadius: 20 },
  langBtnActive: { backgroundColor: '#1d4ed8' },
  langText: { color: '#9ca3af', fontSize: 13 },
  langTextActive: { color: '#fff', fontWeight: '600' },
  dangerBtn: { margin: 12, padding: 12, backgroundColor: '#1f1f2e', borderRadius: 10, alignItems: 'center' },
  dangerText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
});
