import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSyncStore } from '../offline/sync-engine';

export default function SyncStatus() {
  const router = useRouter();
  const { isSyncing, pendingCount } = useSyncStore();
  if (!isSyncing && pendingCount === 0) return null;
  return (
    <TouchableOpacity style={styles.badge} onPress={() => router.push('/sync')}>
      <Text style={styles.text}>{isSyncing ? '↕ Syncing...' : `↑ ${pendingCount} pending`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#1c1917', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  text: { color: '#f97316', fontSize: 11, fontWeight: '600' },
});
