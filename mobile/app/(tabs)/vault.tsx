/**
 * Vault Screen — document list, search, tag filter
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { documents } from '../../src/db/schema';
import { desc, like, or } from 'drizzle-orm';
import OfflineBanner from '../../src/components/OfflineBanner';

interface Doc { id: string; slug: string; title: string; source: string | null; updatedAt: string; wordCount: number | null; }

export default function VaultScreen() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async (q: string) => {
    const rows = q.trim()
      ? await db.select().from(documents)
          .where(or(like(documents.title, `%${q}%`), like(documents.content, `%${q}%`)))
          .orderBy(desc(documents.updatedAt)).limit(100).all()
      : await db.select().from(documents).orderBy(desc(documents.updatedAt)).limit(100).all();
    setDocs(rows);
  }, []);

  useEffect(() => { load(''); }, []);
  useEffect(() => { const t = setTimeout(() => load(query), 300); return () => clearTimeout(t); }, [query]);

  const sourceColor = (s: string | null) => s === 'bundle' ? '#7c3aed' : s === 'synced' ? '#059669' : '#374151';
  const sourceLabel = (s: string | null) => s === 'bundle' ? '📦' : s === 'synced' ? '☁️' : '📝';

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search vault..."
          placeholderTextColor="#4b5563"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.count}>{docs.length} document{docs.length !== 1 ? 's' : ''}</Text>

      <FlatList
        data={docs}
        keyExtractor={d => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📂</Text>
            <Text style={styles.emptyText}>{query ? 'No results' : 'Vault is empty'}</Text>
            <Text style={styles.emptyHint}>Import a bundle or sync your vault to see documents here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.docRow} onPress={() => router.push(`/doc/${item.slug}`)}>
            <View style={styles.docLeft}>
              <Text style={styles.docSource}>{sourceLabel(item.source)}</Text>
            </View>
            <View style={styles.docMid}>
              <Text style={styles.docTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.docMeta}>
                {item.wordCount ? `${item.wordCount} words · ` : ''}
                {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, backgroundColor: '#111118', borderRadius: 12,
    borderWidth: 1, borderColor: '#1f1f2e', paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: '#e5e7eb', fontSize: 14 },
  clearBtn: { color: '#6b7280', fontSize: 16 },
  count: { color: '#4b5563', fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  sep: { height: 1, backgroundColor: '#1f1f2e' },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  docLeft: { width: 28, alignItems: 'center' },
  docSource: { fontSize: 18 },
  docMid: { flex: 1 },
  docTitle: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
  docMeta: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  arrow: { color: '#374151', fontSize: 20 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#9ca3af', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: '#4b5563', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 32 },
});
