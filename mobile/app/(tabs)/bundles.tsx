/**
 * Bundles Screen — import .ib, browse local bundles, play
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { db } from '../../src/db/client';
import { bundles, bundleProgress } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import * as Crypto from 'expo-crypto';
import OfflineBanner from '../../src/components/OfflineBanner';

interface BundleMeta { id: string; slug: string; name: string; description: string | null; subject: string | null; fileSize: number | null; importedAt: string; }

export default function BundlesScreen() {
  const router = useRouter();
  const [bundleList, setBundleList] = useState<BundleMeta[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await db.select({
      id: bundles.id, slug: bundles.slug, name: bundles.name,
      description: bundles.description, subject: bundles.subject,
      fileSize: bundles.fileSize, importedAt: bundles.importedAt,
    }).from(bundles).all();
    setBundleList(rows);

    // Load progress for each bundle
    const prog: Record<string, number> = {};
    for (const b of rows) {
      const p = await db.select().from(bundleProgress).where(eq(bundleProgress.bundleSlug, b.slug)).all();
      const done = p.filter(x => x.completed).length;
      prog[b.slug] = p.length > 0 ? Math.round((done / p.length) * 100) : 0;
    }
    setProgress(prog);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const importBundle = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.name.endsWith('.ib')) {
      Alert.alert('Invalid file', 'Please select a .ib bundle file');
      return;
    }

    setImporting(true);
    try {
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const buffer = Buffer.from(content, 'base64');

      const zip = await JSZip.loadAsync(buffer);
      const mf = zip.file('manifest.json');
      if (!mf) throw new Error('Invalid bundle — missing manifest.json');
      const manifest = JSON.parse(await mf.async('string'));

      // Save to local bundles directory
      const bundlesDir = FileSystem.documentDirectory + 'bundles/';
      await FileSystem.makeDirectoryAsync(bundlesDir, { intermediates: true });
      const destPath = bundlesDir + `${manifest.slug}.ib`;
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });

      // Ingest docs
      const docsDir = FileSystem.documentDirectory + 'vault/';
      await FileSystem.makeDirectoryAsync(docsDir, { intermediates: true });

      for (const [filePath, zipFile] of Object.entries(zip.files)) {
        if ((zipFile as JSZip.JSZipObject).dir || !filePath.startsWith('docs/')) continue;
        const text = await (zipFile as JSZip.JSZipObject).async('string');
        const docSlug = filePath.replace('docs/', '').replace('.md', '');
        const now = new Date().toISOString();
        const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, docSlug + now);

        await db.insert(bundles).values({
          id: manifest.id,
          slug: manifest.slug,
          name: manifest.name,
          description: manifest.description,
          authorName: manifest.author?.name,
          language: manifest.language || 'en',
          subject: manifest.subject,
          tags: JSON.stringify(manifest.tags || []),
          access: manifest.access || 'public',
          license: manifest.license || 'Apache-2.0',
          filePath: destPath,
          fileSize: asset.size || buffer.length,
          manifestJson: JSON.stringify(manifest),
          importedAt: now,
          isDownloaded: true,
        }).onConflictDoNothing();

        // upsert doc
        await db.execute(`
          INSERT OR REPLACE INTO documents (id, slug, title, content, source, bundle_slug, word_count, created_at, updated_at)
          VALUES ('${id.slice(0,36)}', '${manifest.slug}--${docSlug}', '${docSlug.replace(/-/g, ' ')}', ?, 'bundle', '${manifest.slug}', ${text.split(/\s+/).length}, '${now}', '${now}')
        `, [text]);
      }

      Alert.alert('✅ Bundle Imported', `"${manifest.name}" is ready to play offline.`, [
        { text: 'Play Now', onPress: () => router.push(`/bundle/${manifest.slug}`) },
        { text: 'OK', style: 'cancel' },
      ]);
      load();
    } catch (e: unknown) {
      Alert.alert('Import Failed', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const sizeHuman = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <TouchableOpacity style={styles.importBtn} onPress={importBundle} disabled={importing}>
        {importing
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.importBtnText}>↑  Import .ib Bundle</Text>
        }
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />}

      <FlatList
        data={bundleList}
        keyExtractor={b => b.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No Bundles Yet</Text>
            <Text style={styles.emptyHint}>Tap "Import .ib Bundle" to load a portable knowledge package.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => {
          const pct = progress[item.slug] || 0;
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/bundle/${item.slug}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardSize}>{sizeHuman(item.fileSize)}</Text>
              </View>
              {item.subject && <Text style={styles.cardSub}>{item.subject}</Text>}
              {item.description && <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>}
              {pct > 0 && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>{pct}% complete</Text>
                </View>
              )}
              <Text style={styles.playBtn}>Play →</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  importBtn: {
    margin: 16, backgroundColor: '#1d4ed8', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  importBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#111118', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1f1f2e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { color: '#e5e7eb', fontSize: 14, fontWeight: '700', flex: 1 },
  cardSize: { color: '#4b5563', fontSize: 11, marginLeft: 8 },
  cardSub: { color: '#3b82f6', fontSize: 11, marginTop: 4 },
  cardDesc: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  progressTrack: { height: 3, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  progressLabel: { color: '#4b5563', fontSize: 10, marginTop: 3 },
  playBtn: { color: '#3b82f6', fontSize: 12, fontWeight: '600', marginTop: 12, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { color: '#9ca3af', fontSize: 16, fontWeight: '700' },
  emptyHint: { color: '#4b5563', fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
});
