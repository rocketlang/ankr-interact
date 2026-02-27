/**
 * Settings Screen — profile, sync config, language, tier, about
 */

import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native';
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

  // H5: BYOK state
  const [byokKey, setByokKey] = useState('');
  const [byokEnabled, setByokEnabled] = useState(false);
  const [byokLoading, setByokLoading] = useState(false);
  const [tierInfo, setTierInfo] = useState<{ tier: string; vaultUsedMB: number; vaultLimitMB: number } | null>(null);

  useEffect(() => {
    Promise.all([
      db.select({ c: documents.id }).from(documents).all(),
      db.select({ c: bundles.id }).from(bundles).all(),
      db.select({ c: flashcardCards.id }).from(flashcardCards).all(),
    ]).then(([d, b, c]) => setStats({ docs: d.length, bundles: b.length, cards: c.length }));

    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'language')).all()
      .then(r => r[0] && setLang(r[0].value));

    // Load BYOK status and tier info from server
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all().then(rows => {
      const serverUrl = rows[0]?.value;
      if (!serverUrl) return;
      fetch(`${serverUrl}/api/studio/byok`).then(r => r.json()).then(d => setByokEnabled(!!d.enabled)).catch(() => {});
      fetch(`${serverUrl}/api/studio/usage`).then(r => r.json()).then(d => {
        setTierInfo({ tier: d.tier ?? 'free', vaultUsedMB: d.vaultUsedMB ?? 0, vaultLimitMB: d.vaultLimitMB ?? 500 });
      }).catch(() => {});
    });
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

      {/* AI — On-Device Model */}
      <Section title="AI — On-Device">
        <Row label="On-device AI" right={<Text style={styles.muted}>Llama 3.2 1B</Text>} />
        <TouchableOpacity style={styles.downloadModelBtn} onPress={async () => {
          const { isOnline: online } = useNetworkStore.getState();
          if (!online) { Alert.alert('Offline', 'Connect to download the AI model (~700 MB).'); return; }
          const serverUrlRow = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all();
          const serverUrl = serverUrlRow[0]?.value;
          if (!serverUrl) { Alert.alert('No Server', 'Set your ANKR Interact server URL first.'); return; }
          Alert.alert('Download AI Model',
            'Download Llama 3.2 1B (~700 MB) for fully offline AI — flashcard generation, quiz creation, and Q&A without any server.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Download', onPress: () => router.push('/ai-model-download' as any) },
            ]
          );
        }}>
          <Text style={styles.downloadModelText}>📥 Download On-Device Model</Text>
        </TouchableOpacity>
        <Text style={styles.aiNote}>Once downloaded, AI works fully offline — no server needed for flashcards, quizzes, and Q&A.</Text>
      </Section>

      {/* H5: Plan & AI Key (BYOK) */}
      <Section title="Plan & AI Key">
        {/* Tier badge */}
        {tierInfo && (
          <View style={styles.tierCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.tierLabel}>{
                tierInfo.tier === 'free' ? '🆓 Free Plan' :
                tierInfo.tier === 'pro' ? '⭐ Pro Plan' :
                tierInfo.tier === 'teams' ? '👥 Teams Plan' : '🏠 Self-Hosted'
              }</Text>
              {tierInfo.tier === 'free' && (
                <Text style={styles.upgradeText}>Upgrade →</Text>
              )}
            </View>
            {/* Vault bar */}
            {tierInfo.vaultLimitMB > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={styles.muted}>Vault</Text>
                  <Text style={styles.muted}>{tierInfo.vaultUsedMB.toFixed(0)} / {tierInfo.vaultLimitMB} MB</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, {
                    width: `${Math.min((tierInfo.vaultUsedMB / tierInfo.vaultLimitMB) * 100, 100)}%`,
                    backgroundColor: tierInfo.vaultUsedMB / tierInfo.vaultLimitMB > 0.85 ? '#ef4444' : '#6366f1',
                  }]} />
                </View>
              </>
            )}
          </View>
        )}

        {/* BYOK */}
        <Text style={[styles.sectionHint, { marginTop: 12, marginBottom: 6 }]}>
          {byokEnabled
            ? '✅ Your Anthropic API key is active — unlimited AI, no credits used.'
            : 'Use your own Anthropic API key (sk-ant-…) for unlimited Studio AI with no monthly limits.'}
        </Text>
        <TextInput
          style={styles.keyInput}
          placeholder="sk-ant-api03-…"
          placeholderTextColor="#4b5563"
          value={byokKey}
          onChangeText={setByokKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.byokBtn, { flex: 1 }]}
            disabled={byokLoading || !byokKey}
            onPress={async () => {
              const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all();
              const serverUrl = rows[0]?.value;
              if (!serverUrl) { Alert.alert('No Server', 'Set your server URL first.'); return; }
              setByokLoading(true);
              try {
                const r = await fetch(`${serverUrl}/api/studio/byok`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ apiKey: byokKey }),
                });
                const d = await r.json();
                if (!r.ok) { Alert.alert('Error', d.error ?? 'Failed'); return; }
                setByokEnabled(true);
                setByokKey('');
                Alert.alert('BYOK Active', 'Your API key is saved. Studio AI is now unlimited.');
              } catch (e) {
                Alert.alert('Error', String(e));
              } finally {
                setByokLoading(false);
              }
            }}
          >
            {byokLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.byokBtnText}>Save Key</Text>}
          </TouchableOpacity>
          {byokEnabled && (
            <TouchableOpacity
              style={[styles.byokBtn, { backgroundColor: '#374151' }]}
              onPress={async () => {
                const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all();
                const serverUrl = rows[0]?.value;
                if (!serverUrl) return;
                await fetch(`${serverUrl}/api/studio/byok`, { method: 'DELETE' });
                setByokEnabled(false);
                Alert.alert('Key Removed', 'Your BYOK key has been deleted.');
              }}
            >
              <Text style={styles.byokBtnText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </Section>

      {/* About */}
      <Section title="About">
        <Row label="Version" right={<Text style={styles.muted}>1.0.0 (Phase H)</Text>} />
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
  downloadModelBtn: { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  downloadModelText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  aiNote: { color: '#4b5563', fontSize: 11, marginTop: 6, lineHeight: 16 },
  // H5 styles
  tierCard: { margin: 12, marginTop: 4, backgroundColor: '#1e1b4b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#4338ca33' },
  tierLabel: { color: '#a5b4fc', fontWeight: '700', fontSize: 13 },
  upgradeText: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  progressBg: { height: 4, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  sectionHint: { color: '#6b7280', fontSize: 12, lineHeight: 17, marginHorizontal: 12 },
  keyInput: { marginHorizontal: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', borderRadius: 10, padding: 10, color: '#e5e7eb', fontSize: 13, fontFamily: 'monospace' },
  byokBtn: { backgroundColor: '#4f46e5', borderRadius: 8, padding: 10, alignItems: 'center' },
  byokBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
