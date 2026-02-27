/**
 * Document Reader — renders a vault doc as markdown
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import * as FileSystem from 'expo-file-system';
import { db } from '../../src/db/client';
import { documents } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

export default function DocReaderScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    db.select().from(documents).where(eq(documents.slug, slug)).all().then(rows => {
      if (rows[0]) {
        setTitle(rows[0].title);
        setContent(rows[0].content);
      } else {
        setContent('*Document not found in vault.*');
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Markdown style={markdownStyle}>{content}</Markdown>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0f' },
  title: { color: '#f9fafb', fontSize: 24, fontWeight: '800', marginBottom: 16, lineHeight: 32 },
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
  list_item: { color: '#d1d5db', marginBottom: 4 },
  bullet_list: { marginBottom: 12 },
};
