/**
 * Sync Screen — status, queue, manual sync trigger
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSyncStore, sync } from '../src/offline/sync-engine';
import { useNetworkStore } from '../src/offline/network-monitor';
import { getPendingMutations } from '../src/offline/mutation-queue';
import { db } from '../src/db/client';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default function SyncScreen() {
  const { isSyncing, lastSyncedAt, pendingCount, lastError } = useSyncStore();
  const { isOnline } = useNetworkStore();
  const [serverUrl, setServerUrl] = useState('');
  const [mutations, setMutations] = useState<Array<{ id: string; entityType: string; operation: string; createdAt: string; attempts: number }>>([]);

  useEffect(() => {
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all()
      .then(r => r[0] && setServerUrl(r[0].value));
    loadMutations();
  }, []);

  const loadMutations = async () => {
    const m = await getPendingMutations();
    setMutations(m.slice(0, 20));
  };

  const doSync = async () => {
    if (!serverUrl || !isOnline) return;
    const token = (await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'auth_token')).all())[0]?.value;
    await sync(serverUrl, token);
    await loadMutations();
  };

  return (
    <ScrollView style={styles.container}>
      {/* Status card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Network</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isOnline ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.value}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Last Synced</Text>
          <Text style={styles.value}>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Pending Changes</Text>
          <Text style={[styles.value, pendingCount > 0 && { color: '#f97316' }]}>{pendingCount}</Text>
        </View>
        {lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {lastError}</Text>
          </View>
        )}
      </View>

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.syncBtn, (!isOnline || isSyncing) && styles.syncBtnDisabled]}
        onPress={doSync}
        disabled={!isOnline || isSyncing}
      >
        {isSyncing
          ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.syncBtnText}>  Syncing...</Text></>
          : <Text style={styles.syncBtnText}>↕  Sync Now</Text>
        }
      </TouchableOpacity>

      {/* Pending mutations list */}
      {mutations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Queue ({mutations.length})</Text>
          {mutations.map(m => (
            <View key={m.id} style={styles.mutRow}>
              <View>
                <Text style={styles.mutType}>{m.operation} {m.entityType}</Text>
                <Text style={styles.mutDate}>{new Date(m.createdAt).toLocaleTimeString()}</Text>
              </View>
              {m.attempts > 0 && <Text style={styles.mutAttempts}>{m.attempts} attempts</Text>}
            </View>
          ))}
        </View>
      )}

      {mutations.length === 0 && !isSyncing && (
        <View style={styles.allGood}>
          <Text style={{ fontSize: 40 }}>✅</Text>
          <Text style={styles.allGoodText}>All changes synced</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 16 },
  card: { backgroundColor: '#111118', borderRadius: 14, padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  label: { color: '#6b7280', fontSize: 13 },
  value: { color: '#e5e7eb', fontSize: 13, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 8, padding: 10, marginTop: 10 },
  errorText: { color: '#fca5a5', fontSize: 12 },
  syncBtn: { backgroundColor: '#1d4ed8', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section: { backgroundColor: '#111118', borderRadius: 14, padding: 14 },
  sectionTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  mutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  mutType: { color: '#e5e7eb', fontSize: 12 },
  mutDate: { color: '#4b5563', fontSize: 10, marginTop: 2 },
  mutAttempts: { color: '#f97316', fontSize: 11 },
  allGood: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  allGoodText: { color: '#6b7280', fontSize: 14 },
});
