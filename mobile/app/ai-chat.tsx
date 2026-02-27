/**
 * AI Chat Screen — on-device or proxied LLM assistant
 * Supports: Ask about vault docs, explain bundles, generate flashcards
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { db } from '../src/db/client';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { useNetworkStore } from '../src/offline/network-monitor';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
}

const SYSTEM_PROMPT = `You are an AI assistant embedded in ANKR Interact — a knowledge management and learning platform.
You help users understand documents in their vault, explain concepts from bundles they are studying, and generate flashcards or quiz questions.
Be concise, precise, and helpful. When citing vault content, mention the document title.`;

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'sys', role: 'assistant', content: '👋 Hi! Ask me anything about your vault docs, bundles, or concepts you\'re studying.', ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const flatRef = useRef<FlatList>(null);
  const { isOnline } = useNetworkStore();

  useEffect(() => {
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all()
      .then(r => r[0] && setServerUrl(r[0].value));
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'auth_token')).all()
      .then(r => r[0] && setAuthToken(r[0].value));
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: String(Date.now()), role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    if (!isOnline || !serverUrl) {
      const offlineMsg: Message = {
        id: String(Date.now() + 1), role: 'assistant',
        content: '📡 You\'re offline. AI chat requires a connection to your ANKR Interact server. Your vault docs are still available for offline reading.',
        ts: Date.now(),
      };
      setMessages(prev => [...prev, offlineMsg]);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ],
      };
      const res = await fetch(`${serverUrl}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.reply || data.choices?.[0]?.message?.content || '(No response)';
      const assistantMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: reply, ts: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: Message = {
        id: String(Date.now() + 1), role: 'assistant',
        content: `⚠ Could not reach AI: ${e.message}. Make sure your server is running and AI is enabled.`,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ id: 'sys', role: 'assistant', content: '👋 Chat cleared. What would you like to explore?', ts: Date.now() }]);
  };

  useEffect(() => {
    if (messages.length > 1) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSub}>{isOnline ? '● Connected' : '○ Offline'}</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
            <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextUser]}>{item.content}</Text>
            <Text style={styles.bubbleTime}>{new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        )}
        ListFooterComponent={loading ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        ) : null}
      />

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <View style={styles.suggestRow}>
          {['Summarize my vault', 'Quiz me on last bundle', 'Generate 5 flashcards'].map(p => (
            <TouchableOpacity key={p} style={styles.suggestChip} onPress={() => { setInput(p); }}>
              <Text style={styles.suggestText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything..."
          placeholderTextColor="#4b5563"
          multiline
          maxLength={2000}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit
        />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim() || loading}>
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  headerTitle: { color: '#f9fafb', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearText: { color: '#6b7280', fontSize: 12 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '85%', marginBottom: 12, borderRadius: 14, padding: 12 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#1d4ed8' },
  bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: '#111118', borderWidth: 1, borderColor: '#1f1f2e' },
  bubbleText: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  bubbleTime: { color: '#9ca3af', fontSize: 10, marginTop: 4, textAlign: 'right' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingText: { color: '#6b7280', fontSize: 12 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  suggestChip: { backgroundColor: '#111118', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#374151' },
  suggestText: { color: '#9ca3af', fontSize: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111118', borderTopWidth: 1, borderTopColor: '#1f1f2e' },
  input: { flex: 1, backgroundColor: '#0a0a0f', color: '#f9fafb', fontSize: 14, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120, borderWidth: 1, borderColor: '#1f1f2e' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#1f1f2e' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
