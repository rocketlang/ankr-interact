import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStore } from '../offline/network-monitor';

export default function OfflineBanner() {
  const isOnline = useNetworkStore(s => s.isOnline);
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 Offline — showing cached content</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#422006', paddingHorizontal: 16, paddingVertical: 6 },
  text: { color: '#fed7aa', fontSize: 12, textAlign: 'center' },
});
