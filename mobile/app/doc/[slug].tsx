/**
 * Document Screen — ANKR Interact Mobile
 * Phase C4: Markdown editor with wiki-link autocomplete + voice capture
 *
 * Modes:
 *   READ  — renders markdown via react-native-markdown-display
 *   EDIT  — raw markdown TextInput + formatting toolbar + wiki-link picker
 *
 * C4-1  Markdown editor (read / edit toggle)
 * C4-2  Formatting toolbar: H1, H2, bold, italic, bullet, code, link
 * C4-3  Wiki-link autocomplete: type [[ → shows matching vault docs
 * C4-4  Voice note: mic button → expo-speech-recognition → inserts text at cursor
 * C4-5  Image capture: camera button → expo-image-picker → inserts ![](uri)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, ScrollView, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, FlatList, KeyboardAvoidingView,
  Platform, Alert, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { db } from '../../src/db/client';
import { documents } from '../../src/db/schema';
import { eq, like } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocRow {
  id: string;
  slug: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface WikiSuggestion { slug: string; title: string; }

// ─── Formatting toolbar config ────────────────────────────────────────────────

const TOOLBAR_ITEMS = [
  { label: 'H1', prefix: '# ', suffix: '' },
  { label: 'H2', prefix: '## ', suffix: '' },
  { label: 'B', prefix: '**', suffix: '**' },
  { label: 'I', prefix: '_', suffix: '_' },
  { label: '•', prefix: '- ', suffix: '' },
  { label: '`', prefix: '`', suffix: '`' },
  { label: '```', prefix: '```\n', suffix: '\n```' },
  { label: '[[', prefix: '[[', suffix: '' },   // triggers wiki-link
  { label: '>', prefix: '> ', suffix: '' },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocRow | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Wiki-link autocomplete
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiSuggestions, setWikiSuggestions] = useState<WikiSuggestion[]>([]);
  const [showWiki, setShowWiki] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  // Voice recording state
  const [recording, setRecording] = useState(false);

  const editorRef = useRef<TextInput>(null);

  // ── Load doc ──────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    if (!slug) return;
    db.select().from(documents).where(eq(documents.slug, slug as string)).all().then(rows => {
      if (rows[0]) {
        const row = rows[0] as DocRow;
        setDoc(row);
        setTitle(row.title);
        setContent(row.content ?? '');
      }
      setLoading(false);
    });
  }, [slug]));

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!doc || !dirty) return;
    setSaving(true);
    try {
      await db.update(documents)
        .set({ content, title, updatedAt: Date.now() })
        .where(eq(documents.id, doc.id));
      setDirty(false);
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
    setSaving(false);
  };

  // Auto-save on blur / mode switch
  const enterRead = async () => {
    await save();
    setMode('read');
    Keyboard.dismiss();
  };

  // ── Wiki-link autocomplete ────────────────────────────────────────────────

  const onChangeContent = (text: string, pos?: number) => {
    setContent(text);
    setDirty(true);

    // Detect [[...]] trigger
    const caret = pos ?? text.length;
    const before = text.slice(0, caret);
    const match = before.match(/\[\[([^\]]{0,40})$/);
    if (match) {
      const q = match[1];
      setWikiQuery(q);
      if (q.length >= 0) {
        // Search vault docs
        db.select({ slug: documents.slug, title: documents.title })
          .from(documents)
          .where(like(documents.title, `%${q}%`))
          .all()
          .then(rows => {
            setWikiSuggestions((rows as WikiSuggestion[]).slice(0, 6));
            setShowWiki(rows.length > 0);
          });
      }
    } else {
      setShowWiki(false);
    }
  };

  const insertWikiLink = (suggestion: WikiSuggestion) => {
    // Replace [[partial with [[title]]
    const newContent = content.replace(/\[\[([^\]]*)$/, `[[${suggestion.title}]]`);
    setContent(newContent);
    setDirty(true);
    setShowWiki(false);
  };

  // ── Format toolbar ────────────────────────────────────────────────────────

  const applyFormat = (prefix: string, suffix: string) => {
    if (prefix === '[[') {
      // Trigger wiki-link mode
      const newContent = content.slice(0, cursorPos) + '[[' + content.slice(cursorPos);
      onChangeContent(newContent, cursorPos + 2);
      return;
    }
    const newContent = content.slice(0, cursorPos) + prefix + suffix + content.slice(cursorPos);
    setContent(newContent);
    setDirty(true);
  };

  // ── Voice capture (C4-4) ─────────────────────────────────────────────────

  const startVoice = async () => {
    // Graceful: try expo-speech-recognition, fall back to alert if not installed
    try {
      const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition' as any);
      setRecording(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'en-IN',
        interimResults: true,
        onresult: (result: any) => {
          const transcript = result.results?.[0]?.[0]?.transcript ?? '';
          if (transcript) {
            const insertion = transcript + ' ';
            const newContent = content.slice(0, cursorPos) + insertion + content.slice(cursorPos);
            setContent(newContent);
            setDirty(true);
          }
        },
        onend: () => setRecording(false),
        onerror: () => setRecording(false),
      });
    } catch {
      Alert.alert(
        'Voice not available',
        'Install expo-speech-recognition to enable voice note capture.',
      );
    }
  };

  // ── Image capture (C4-5) ─────────────────────────────────────────────────

  const captureImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker' as any);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera permission denied');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = result.assets[0].uri;
        const insertion = `\n![image](${uri})\n`;
        const newContent = content.slice(0, cursorPos) + insertion + content.slice(cursorPos);
        setContent(newContent);
        setDirty(true);
      }
    } catch {
      Alert.alert(
        'Camera not available',
        'Install expo-image-picker to enable camera capture.',
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { save(); router.back(); }} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          {mode === 'edit' ? (
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={t => { setTitle(t); setDirty(true); }}
              placeholderTextColor="#6b7280"
              placeholder="Document title"
              returnKeyType="done"
            />
          ) : (
            <Text style={styles.titleText} numberOfLines={1}>{title || 'Untitled'}</Text>
          )}

          {mode === 'read' ? (
            <TouchableOpacity onPress={() => setMode('edit')} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterRead} style={[styles.editBtn, styles.doneBtn]}>
              <Text style={styles.doneBtnText}>{saving ? '…' : 'Done'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Read mode ──────────────────────────────────────────────── */}
        {mode === 'read' && (
          <ScrollView style={styles.readScroll} contentContainerStyle={styles.readContent}>
            <Markdown style={mdStyle}>{content || '*Empty document. Tap Edit to start writing.*'}</Markdown>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        {/* ── Edit mode ──────────────────────────────────────────────── */}
        {mode === 'edit' && (
          <View style={{ flex: 1 }}>

            {/* Formatting toolbar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.toolbar}
              contentContainerStyle={styles.toolbarContent}
              keyboardShouldPersistTaps="always"
            >
              {TOOLBAR_ITEMS.map(item => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => applyFormat(item.prefix, item.suffix)}
                  style={styles.toolbarBtn}
                >
                  <Text style={styles.toolbarBtnText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.toolbarSeparator} />
              {/* Voice */}
              <TouchableOpacity
                onPress={startVoice}
                style={[styles.toolbarBtn, recording && styles.toolbarBtnActive]}
              >
                <Text style={styles.toolbarBtnText}>{recording ? '⏹' : '🎙'}</Text>
              </TouchableOpacity>
              {/* Camera */}
              <TouchableOpacity onPress={captureImage} style={styles.toolbarBtn}>
                <Text style={styles.toolbarBtnText}>📷</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Wiki-link suggestions */}
            {showWiki && (
              <View style={styles.wikiPanel}>
                <FlatList
                  data={wikiSuggestions}
                  keyExtractor={item => item.slug}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.wikiItem}
                      onPress={() => insertWikiLink(item)}
                    >
                      <Text style={styles.wikiIcon}>🔗</Text>
                      <View>
                        <Text style={styles.wikiTitle}>{item.title}</Text>
                        <Text style={styles.wikiSlug}>{item.slug}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Editor */}
            <TextInput
              ref={editorRef}
              style={styles.editor}
              value={content}
              onChangeText={text => onChangeContent(text)}
              onSelectionChange={e => setCursorPos(e.nativeEvent.selection.start)}
              multiline
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              placeholderTextColor="#4b5563"
              placeholder="Start writing in markdown…&#10;&#10;Type [[ to link to another doc"
              scrollEnabled
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050508' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050508' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#0a0a0f',
    gap: 8,
  },
  backBtn: { paddingHorizontal: 4 },
  backText: { color: '#60a5fa', fontSize: 18 },
  titleText: { flex: 1, color: '#f9fafb', fontSize: 16, fontWeight: '700' },
  titleInput: {
    flex: 1,
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: '#60a5fa', fontWeight: '600', fontSize: 14 },
  doneBtn: { backgroundColor: '#1d4ed8' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Read mode
  readScroll: { flex: 1 },
  readContent: { padding: 20 },

  // Toolbar
  toolbar: {
    flexGrow: 0,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  toolbarContent: { paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  toolbarBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 34,
    alignItems: 'center',
  },
  toolbarBtnActive: { backgroundColor: '#ef4444' },
  toolbarBtnText: { color: '#d1d5db', fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  toolbarSeparator: { width: 1, backgroundColor: '#374151', marginHorizontal: 4 },

  // Wiki-link panel
  wikiPanel: {
    maxHeight: 160,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  wikiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  wikiIcon: { fontSize: 14 },
  wikiTitle: { color: '#f3f4f6', fontSize: 14, fontWeight: '600' },
  wikiSlug: { color: '#6b7280', fontSize: 11, marginTop: 1 },

  // Editor
  editor: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top',
    backgroundColor: '#050508',
  },
});

const mdStyle = {
  body: { color: '#e5e7eb', fontSize: 15, lineHeight: 26, backgroundColor: 'transparent' },
  heading1: { color: '#f9fafb', fontSize: 22, fontWeight: '700' as const, marginBottom: 12, marginTop: 20 },
  heading2: { color: '#f3f4f6', fontSize: 18, fontWeight: '700' as const, marginBottom: 8, marginTop: 16 },
  heading3: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' as const, marginBottom: 6, marginTop: 12 },
  paragraph: { color: '#d1d5db', marginBottom: 12 },
  code_inline: { backgroundColor: '#1f2937', color: '#60a5fa', borderRadius: 4, padding: 2 },
  fence: { backgroundColor: '#111827', borderRadius: 8, padding: 12, marginVertical: 8 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#3b82f6', paddingLeft: 12, marginLeft: 0 },
  strong: { color: '#f9fafb', fontWeight: '700' as const },
  link: { color: '#60a5fa', textDecorationLine: 'underline' as const },
  list_item: { color: '#d1d5db', marginBottom: 4 },
};
