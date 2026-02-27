/**
 * Classroom Screen — student view for enrolled courses
 * Join with invite code, browse modules, track attendance
 */

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { db } from '../src/db/client';
import { settings } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { useNetworkStore } from '../src/offline/network-monitor';
import { useRouter } from 'expo-router';

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  teacherName: string;
  memberCount: number;
  moduleCount: number;
  code: string;
  enrolledAt: string;
}

interface ClassModule {
  id: string;
  title: string;
  type: string;
  status: 'locked' | 'available' | 'completed';
  completedAt?: string;
  documentSlug?: string;
  bundleSlug?: string;
}

export default function ClassroomScreen() {
  const [view, setView] = useState<'list' | 'join' | 'modules'>('list');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [modules, setModules] = useState<ClassModule[]>([]);
  const [activeClass, setActiveClass] = useState<Classroom | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const { isOnline } = useNetworkStore();
  const router = useRouter();

  useEffect(() => {
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'server_url')).all()
      .then(r => r[0] && setServerUrl(r[0].value));
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'auth_token')).all()
      .then(r => r[0] && setAuthToken(r[0].value));
  }, []);

  useEffect(() => {
    if (serverUrl) loadClassrooms();
  }, [serverUrl]);

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  });

  const loadClassrooms = async () => {
    if (!serverUrl || !isOnline) { setClassrooms([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/classrooms/my`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(data.classrooms || []);
      }
    } catch { /* offline */ } finally { setLoading(false); }
  };

  const joinClassroom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) return;
    if (!isOnline || !serverUrl) { Alert.alert('Offline', 'Joining a classroom requires an internet connection.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/classrooms/join`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Joined!', `Welcome to ${data.classroom.name}`);
        setJoinCode('');
        setView('list');
        await loadClassrooms();
      } else {
        Alert.alert('Error', data.error || 'Invalid code');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setLoading(false); }
  };

  const openClassroom = async (cls: Classroom) => {
    setActiveClass(cls);
    setView('modules');
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/classrooms/${cls.id}/modules`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch { setModules([]); } finally { setLoading(false); }
  };

  const openModule = (mod: ClassModule) => {
    if (mod.status === 'locked') { Alert.alert('Locked', 'Complete previous modules first.'); return; }
    if (mod.documentSlug) router.push(`/doc/${mod.documentSlug}`);
    else if (mod.bundleSlug) router.push(`/bundle/${mod.bundleSlug}`);
  };

  /* ── VIEWS ── */

  if (view === 'join') return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Classroom</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.joinBox}>
        <Text style={styles.joinLabel}>Enter Invite Code</Text>
        <TextInput
          style={styles.joinInput}
          value={joinCode}
          onChangeText={t => setJoinCode(t.toUpperCase())}
          placeholder="e.g. DEMO2026"
          placeholderTextColor="#4b5563"
          autoCapitalize="characters"
          maxLength={12}
        />
        <TouchableOpacity style={[styles.joinBtn, (!joinCode.trim() || loading) && styles.joinBtnDisabled]} onPress={joinClassroom} disabled={!joinCode.trim() || loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinBtnText}>Join →</Text>}
        </TouchableOpacity>
        <Text style={styles.joinHint}>Get your code from your teacher or course administrator.</Text>
      </View>
    </View>
  );

  if (view === 'modules' && activeClass) return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{activeClass.name}</Text>
          <Text style={styles.headerSub}>by {activeClass.teacherName} · {activeClass.memberCount} learners</Text>
        </View>
      </View>

      {loading
        ? <View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>
        : (
          <FlatList
            data={modules}
            keyExtractor={m => m.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>No modules yet</Text></View>}
            renderItem={({ item, index }) => (
              <TouchableOpacity style={[styles.modCard, item.status === 'locked' && styles.modCardLocked]} onPress={() => openModule(item)}>
                <View style={styles.modNum}>
                  <Text style={styles.modNumText}>
                    {item.status === 'completed' ? '✓' : item.status === 'locked' ? '🔒' : String(index + 1)}
                  </Text>
                </View>
                <View style={styles.modInfo}>
                  <Text style={[styles.modTitle, item.status === 'locked' && styles.modTitleLocked]}>{item.title}</Text>
                  <Text style={styles.modType}>{item.type.toUpperCase()} {item.completedAt ? `· Done ${new Date(item.completedAt).toLocaleDateString()}` : ''}</Text>
                </View>
                {item.status === 'available' && <Text style={styles.modArrow}>›</Text>}
              </TouchableOpacity>
            )}
          />
        )}
    </View>
  );

  /* Default: Classroom list */
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Classrooms</Text>
        <TouchableOpacity style={styles.joinChip} onPress={() => setView('join')}>
          <Text style={styles.joinChipText}>+ Join</Text>
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 Offline — classroom sync unavailable</Text>
        </View>
      )}

      {loading
        ? <View style={styles.center}><ActivityIndicator color="#3b82f6" /></View>
        : (
          <FlatList
            data={classrooms}
            keyExtractor={c => c.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onRefresh={loadClassrooms}
            refreshing={loading}
            ListEmptyComponent={(
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 48 }}>🎓</Text>
                <Text style={styles.emptyTitle}>No classrooms yet</Text>
                <Text style={styles.emptyText}>Ask your teacher for an invite code to join a live course.</Text>
                <TouchableOpacity style={styles.joinBtnLg} onPress={() => setView('join')}>
                  <Text style={styles.joinBtnText}>Join with Code</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item }) => {
              const completed = 0; // could fetch from progress table
              const pct = item.moduleCount > 0 ? Math.round((completed / item.moduleCount) * 100) : 0;
              return (
                <TouchableOpacity style={styles.classCard} onPress={() => openClassroom(item)}>
                  <View style={styles.classCardTop}>
                    <View style={styles.classAvatar}>
                      <Text style={styles.classAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.classInfo}>
                      <Text style={styles.className}>{item.name}</Text>
                      <Text style={styles.classTeacher}>by {item.teacherName}</Text>
                    </View>
                    <Text style={styles.classArrow}>›</Text>
                  </View>
                  {item.description && <Text style={styles.classDesc} numberOfLines={2}>{item.description}</Text>}
                  <View style={styles.classFooter}>
                    <Text style={styles.classStat}>{item.moduleCount} modules</Text>
                    <Text style={styles.classStat}>{item.memberCount} learners</Text>
                    <Text style={styles.classStat}>Code: {item.code}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1f1f2e' },
  headerTitle: { color: '#f9fafb', fontSize: 16, fontWeight: '700', flex: 1 },
  headerCenter: { flex: 1 },
  headerSub: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  backBtn: { paddingRight: 12, width: 60 },
  backText: { color: '#3b82f6', fontSize: 16 },
  joinChip: { backgroundColor: '#1d4ed8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  joinChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  offlineBanner: { backgroundColor: '#422006', paddingVertical: 6, paddingHorizontal: 16 },
  offlineText: { color: '#fed7aa', fontSize: 12, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  classCard: { backgroundColor: '#111118', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1f1f2e' },
  classCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  classAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  classAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  classInfo: { flex: 1 },
  className: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  classTeacher: { color: '#6b7280', fontSize: 11, marginTop: 2 },
  classArrow: { color: '#374151', fontSize: 22 },
  classDesc: { color: '#9ca3af', fontSize: 12, marginBottom: 8, lineHeight: 18 },
  classFooter: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  classStat: { color: '#4b5563', fontSize: 11 },
  progressTrack: { height: 2, backgroundColor: '#1f2937', borderRadius: 1 },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 1 },
  /* Module view */
  modCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1f1f2e' },
  modCardLocked: { opacity: 0.5 },
  modNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  modNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modInfo: { flex: 1 },
  modTitle: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  modTitleLocked: { color: '#4b5563' },
  modType: { color: '#6b7280', fontSize: 10, marginTop: 3 },
  modArrow: { color: '#374151', fontSize: 22 },
  /* Join view */
  joinBox: { padding: 24, gap: 16 },
  joinLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  joinInput: { backgroundColor: '#111118', borderRadius: 12, borderWidth: 1, borderColor: '#374151', color: '#f9fafb', fontSize: 18, fontWeight: '700', letterSpacing: 4, textAlign: 'center', padding: 16 },
  joinBtn: { backgroundColor: '#1d4ed8', borderRadius: 12, padding: 14, alignItems: 'center' },
  joinBtnDisabled: { opacity: 0.5 },
  joinBtnLg: { backgroundColor: '#1d4ed8', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  joinHint: { color: '#4b5563', fontSize: 12, textAlign: 'center' },
});
