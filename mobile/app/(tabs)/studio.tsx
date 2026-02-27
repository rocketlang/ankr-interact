/**
 * Studio Tab — ANKR Interact Mobile
 * Access Vault, Social Factory, Characters, Comics, Podcast from mobile
 */

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { settings } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { useNetworkStore } from '../../src/offline/network-monitor';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultItem {
  id: string;
  originalName: string;
  fileType: string;
  sizeBytes: number;
  aiSummary?: string;
  aiTags?: string[];
  uploadedAt: string;
}

interface SocialDraft {
  id: string;
  topic: string;
  linkedin?: string;
  twitter?: string;
  whatsapp?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const FILE_ICONS: Record<string, string> = {
  document: '📄', ebook: '📚', audio: '🎵', video: '🎬',
  image: '🖼', bundle: '📦', file: '📎',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudioScreen() {
  const router = useRouter();
  const { isOnline } = useNetworkStore();
  const [activeTab, setActiveTab] = useState<'vault' | 'social' | 'create'>('vault');
  const [serverUrl, setServerUrl] = useState('');

  // Vault state
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Social state
  const [socialDrafts, setSocialDrafts] = useState<SocialDraft[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  // Social factory create state
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string> | null>(null);
  const [activePlatform, setActivePlatform] = useState('linkedin');

  useEffect(() => {
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all()
      .then(r => { if (r[0]) setServerUrl(r[0].value); });
  }, []);

  useEffect(() => {
    if (serverUrl && isOnline) {
      if (activeTab === 'vault') loadVault();
      if (activeTab === 'social') loadSocialDrafts();
    }
  }, [activeTab, serverUrl, isOnline]);

  const loadVault = async () => {
    if (!serverUrl) return;
    setVaultLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/studio/vault`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      setVaultItems(data.items ?? []);
    } catch { /* offline ok */ }
    setVaultLoading(false);
  };

  const loadSocialDrafts = async () => {
    if (!serverUrl) return;
    setSocialLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/studio/social`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      setSocialDrafts(data.drafts ?? []);
    } catch { /* ok */ }
    setSocialLoading(false);
  };

  const generateSocial = async () => {
    if (!topic.trim()) return;
    if (!serverUrl || !isOnline) {
      Alert.alert('Offline', 'Connect to generate social content.');
      return;
    }
    setGenerating(true);
    setGeneratedContent(null);
    try {
      const res = await fetch(`${serverUrl}/api/studio/social/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platforms: ['linkedin', 'twitter', 'whatsapp'] }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.ok) {
        setGeneratedContent(data.content);
        setActivePlatform('linkedin');
      }
    } catch { Alert.alert('Error', 'Generation failed. Check connection.'); }
    setGenerating(false);
  };

  const saveDraft = async () => {
    if (!generatedContent || !topic || !serverUrl) return;
    await fetch(`${serverUrl}/api/studio/social/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, ...generatedContent }),
    });
    Alert.alert('Saved', 'Draft saved to your studio.');
  };

  const shareContent = async (text: string) => {
    await Share.share({ message: text });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['vault', 'social', 'create'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'vault' ? '🗄 Vault' : tab === 'social' ? '💾 Drafts' : '📣 Create'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Offline — Studio requires server connection</Text>
        </View>
      )}

      {/* Vault */}
      {activeTab === 'vault' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>File Vault</Text>
            <Text style={styles.sectionSub}>{vaultItems.length} files</Text>
          </View>
          {vaultLoading ? (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 30 }} />
          ) : vaultItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🗄</Text>
              <Text style={styles.emptyText}>Vault is empty. Upload files from the web app.</Text>
            </View>
          ) : vaultItems.map(item => (
            <View key={item.id} style={styles.vaultCard}>
              <Text style={styles.fileIcon}>{FILE_ICONS[item.fileType] ?? '📎'}</Text>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{item.originalName}</Text>
                <Text style={styles.fileMeta}>{formatBytes(item.sizeBytes)} · {item.fileType}</Text>
                {item.aiSummary && (
                  <Text style={styles.aiSummary} numberOfLines={2}>{item.aiSummary}</Text>
                )}
                {item.aiTags && item.aiTags.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagRow}>
                    {item.aiTags.slice(0, 4).map(tag => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Social Drafts */}
      {activeTab === 'social' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved Drafts</Text>
            <TouchableOpacity onPress={() => setActiveTab('create')}>
              <Text style={styles.linkText}>+ Create new</Text>
            </TouchableOpacity>
          </View>
          {socialLoading ? (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 30 }} />
          ) : socialDrafts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📣</Text>
              <Text style={styles.emptyText}>No drafts yet. Create content from the Create tab.</Text>
            </View>
          ) : socialDrafts.map(draft => (
            <View key={draft.id} style={styles.draftCard}>
              <Text style={styles.draftTopic}>{draft.topic}</Text>
              <Text style={styles.draftDate}>{new Date(draft.createdAt).toLocaleDateString()}</Text>
              <View style={styles.platformBadges}>
                {draft.linkedin && <Text style={styles.badge}>💼</Text>}
                {draft.twitter && <Text style={styles.badge}>𝕏</Text>}
                {draft.whatsapp && <Text style={styles.badge}>💬</Text>}
              </View>
              {draft.whatsapp && (
                <TouchableOpacity onPress={() => shareContent(draft.whatsapp!)} style={styles.shareBtn}>
                  <Text style={styles.shareBtnText}>Share WhatsApp →</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create — Social Factory */}
      {activeTab === 'create' && (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Social Factory</Text>
          <Text style={styles.sectionSub}>Write once, publish everywhere</Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Topic or Headline</Text>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g. How logistics AI is changing India"
              placeholderTextColor="#4b5563"
              style={styles.textInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.generateBtn, (!topic.trim() || generating) && styles.generateBtnDisabled]}
              onPress={generateSocial}
              disabled={!topic.trim() || generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>✨ Generate for All Platforms</Text>
              )}
            </TouchableOpacity>
          </View>

          {generatedContent && (
            <View style={styles.resultCard}>
              {/* Platform tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformTabs}>
                {(['linkedin', 'twitter', 'whatsapp'] as const).filter(p => generatedContent[p]).map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setActivePlatform(p)}
                    style={[styles.platformTab, activePlatform === p && styles.platformTabActive]}
                  >
                    <Text style={[styles.platformTabText, activePlatform === p && styles.platformTabTextActive]}>
                      {p === 'linkedin' ? '💼' : p === 'twitter' ? '𝕏' : '💬'} {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.resultText}>{generatedContent[activePlatform] ?? ''}</Text>

              <View style={styles.resultActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => shareContent(generatedContent[activePlatform] ?? '')}
                >
                  <Text style={styles.actionBtnText}>Share →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnSecondary} onPress={saveDraft}>
                  <Text style={styles.actionBtnSecondaryText}>💾 Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  tabBar: { flexDirection: 'row', backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  offlineBanner: { backgroundColor: '#1f1f2e', padding: 10, alignItems: 'center' },
  offlineText: { color: '#6b7280', fontSize: 12 },
  scrollArea: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  sectionSub: { color: '#6b7280', fontSize: 12 },
  linkText: { color: '#6366f1', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { color: '#4b5563', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  vaultCard: { flexDirection: 'row', backgroundColor: '#111118', borderRadius: 12, padding: 12, marginBottom: 10, gap: 10 },
  fileIcon: { fontSize: 28, width: 36 },
  fileInfo: { flex: 1 },
  fileName: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  fileMeta: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  aiSummary: { color: '#9ca3af', fontSize: 11, marginTop: 4, lineHeight: 16 },
  tagRow: { marginTop: 6 },
  tag: { backgroundColor: '#1e1b4b', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6 },
  tagText: { color: '#818cf8', fontSize: 10 },
  draftCard: { backgroundColor: '#111118', borderRadius: 12, padding: 14, marginBottom: 10 },
  draftTopic: { color: '#e5e7eb', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  draftDate: { color: '#6b7280', fontSize: 11, marginBottom: 8 },
  platformBadges: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { fontSize: 18 },
  shareBtn: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 10, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  inputCard: { backgroundColor: '#111118', borderRadius: 12, padding: 14, marginTop: 12 },
  inputLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  textInput: { color: '#e5e7eb', fontSize: 14, lineHeight: 20, minHeight: 70, textAlignVertical: 'top', borderWidth: 1, borderColor: '#1f1f2e', borderRadius: 8, padding: 10, marginBottom: 12, backgroundColor: '#0a0a0f' },
  generateBtn: { backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center' },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultCard: { backgroundColor: '#111118', borderRadius: 12, padding: 14, marginTop: 12 },
  platformTabs: { marginBottom: 12 },
  platformTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1f1f2e', marginRight: 8 },
  platformTabActive: { backgroundColor: '#6366f1' },
  platformTabText: { color: '#9ca3af', fontSize: 12 },
  platformTabTextActive: { color: '#fff', fontWeight: '600' },
  resultText: { color: '#d1d5db', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  resultActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: '#1d4ed8', borderRadius: 8, padding: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  actionBtnSecondary: { backgroundColor: '#1f1f2e', borderRadius: 8, padding: 10, paddingHorizontal: 16 },
  actionBtnSecondaryText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
});
