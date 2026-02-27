/**
 * Flashcards Screen — daily SRS session with SM-2, streak tracking
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Vibration,
} from 'react-native';
import { db } from '../../src/db/client';
import { flashcardCards, flashcardReviews, streaks } from '../../src/db/schema';
import { lte, eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

interface Card { id: string; front: string; back: string; easeFactor: number; interval: number; repetitions: number; }

// SM-2 algorithm
function sm2(card: Card, rating: 0 | 1 | 2 | 3): { interval: number; easeFactor: number; repetitions: number; dueDate: string } {
  let { interval, easeFactor, repetitions } = card;
  if (rating < 2) {
    interval = 1;
    repetitions = 0;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions++;
  }
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
  const due = new Date();
  due.setDate(due.getDate() + interval);
  return { interval, easeFactor, repetitions, dueDate: due.toISOString().split('T')[0] };
}

export default function FlashcardsScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    db.select().from(flashcardCards).where(lte(flashcardCards.dueDate, today)).limit(50).all()
      .then(rows => setCards(rows as Card[]));
    db.select({ v: streaks.currentStreak }).from(streaks).where(eq(streaks.id, 'default')).all()
      .then(r => setStreak(r[0]?.v || 0));
  }, []);

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(flipAnim, { toValue: flipped ? 0 : 1, useNativeDriver: true }).start();
    setFlipped(f => !f);
  };

  const rate = async (rating: 0 | 1 | 2 | 3) => {
    const card = cards[idx];
    if (!card) return;
    Haptics.impactAsync(rating >= 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy);

    const { interval, easeFactor, repetitions, dueDate } = sm2(card, rating);

    await db.update(flashcardCards).set({ interval, easeFactor, repetitions, dueDate, lastReviewed: new Date().toISOString() }).where(eq(flashcardCards.id, card.id));
    const revId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, card.id + Date.now());
    await db.insert(flashcardReviews).values({ id: revId.slice(0, 36), cardId: card.id, rating, reviewedAt: new Date().toISOString() });

    setReviewed(r => r + 1);
    setFlipped(false);
    flipAnim.setValue(0);

    if (idx + 1 >= cards.length) {
      // Update streak
      const strk = await db.select().from(streaks).where(eq(streaks.id, 'default')).all();
      const s = strk[0];
      const lastDate = s?.lastStudyDate?.split('T')[0];
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const newStreak = lastDate === today ? (s?.currentStreak || 1)
        : lastDate === yesterday.toISOString().split('T')[0] ? (s?.currentStreak || 0) + 1
        : 1;
      const newXP = (s?.totalXP || 0) + reviewed + 1;
      await db.update(streaks).set({ currentStreak: newStreak, longestStreak: Math.max(newStreak, s?.longestStreak || 0), lastStudyDate: today, totalCardsStudied: (s?.totalCardsStudied || 0) + reviewed + 1, totalXP: newXP }).where(eq(streaks.id, 'default'));
      setStreak(newStreak);
      setDone(true);
    } else {
      setIdx(i => i + 1);
    }
  };

  const frontInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backInterp = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  if (cards.length === 0) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 56 }}>🎉</Text>
      <Text style={styles.doneTitle}>All caught up!</Text>
      <Text style={styles.doneSub}>No cards due today. Come back tomorrow.</Text>
      <View style={styles.streakBadge}><Text style={styles.streakText}>🔥 {streak}-day streak</Text></View>
    </View>
  );

  if (done) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 56 }}>✅</Text>
      <Text style={styles.doneTitle}>Session Complete!</Text>
      <Text style={styles.doneSub}>{reviewed} card{reviewed !== 1 ? 's' : ''} reviewed</Text>
      <View style={styles.streakBadge}><Text style={styles.streakText}>🔥 {streak}-day streak</Text></View>
    </View>
  );

  const card = cards[idx];

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.header}>
        <Text style={styles.progress}>{idx + 1} / {cards.length}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((idx) / cards.length) * 100}%` as `${number}%` }]} />
        </View>
        <View style={styles.streakBadgeSmall}><Text style={styles.streakSmall}>🔥 {streak}d</Text></View>
      </View>

      {/* Card */}
      <TouchableOpacity style={styles.cardArea} onPress={flip} activeOpacity={0.95}>
        <Animated.View style={[styles.card, styles.cardFront, { transform: [{ rotateY: frontInterp }], backfaceVisibility: 'hidden' }]}>
          <Text style={styles.sideLabel}>QUESTION</Text>
          <Text style={styles.cardText}>{card.front}</Text>
          <Text style={styles.tapHint}>Tap to reveal answer</Text>
        </Animated.View>
        <Animated.View style={[styles.card, styles.cardBack, StyleSheet.absoluteFillObject, { transform: [{ rotateY: backInterp }], backfaceVisibility: 'hidden' }]}>
          <Text style={styles.sideLabel}>ANSWER</Text>
          <Text style={styles.cardText}>{card.back}</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Rating buttons — only show after flip */}
      {flipped && (
        <View style={styles.ratingRow}>
          <RatingBtn label="Again" emoji="🔴" sub="<1min" onPress={() => rate(0)} color="#ef4444" />
          <RatingBtn label="Hard" emoji="🟠" sub="<10min" onPress={() => rate(1)} color="#f97316" />
          <RatingBtn label="Good" emoji="🟢" sub={`${card.interval}d`} onPress={() => rate(2)} color="#22c55e" />
          <RatingBtn label="Easy" emoji="🔵" sub={`${Math.round(card.interval * card.easeFactor)}d`} onPress={() => rate(3)} color="#3b82f6" />
        </View>
      )}
    </View>
  );
}

function RatingBtn({ label, emoji, sub, onPress, color }: { label: string; emoji: string; sub: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={[styles.ratingBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[styles.ratingLabel, { color }]}>{label}</Text>
      <Text style={styles.ratingSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  progress: { color: '#4b5563', fontSize: 13 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#1f2937', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  streakBadge: { backgroundColor: '#1c1917', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  streakText: { color: '#f59e0b', fontSize: 16, fontWeight: '700' },
  streakBadgeSmall: { backgroundColor: '#1c1917', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  streakSmall: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  cardArea: { flex: 1 },
  card: { flex: 1, backgroundColor: '#111118', borderRadius: 20, padding: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1f1f2e' },
  cardFront: {},
  cardBack: { backgroundColor: '#0f172a', borderColor: '#1e3a5f' },
  sideLabel: { color: '#374151', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 20 },
  cardText: { color: '#f9fafb', fontSize: 20, fontWeight: '600', textAlign: 'center', lineHeight: 30 },
  tapHint: { color: '#374151', fontSize: 12, marginTop: 24 },
  ratingRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  ratingBtn: { flex: 1, backgroundColor: '#111118', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, gap: 2 },
  ratingLabel: { fontSize: 11, fontWeight: '700' },
  ratingSub: { color: '#4b5563', fontSize: 10 },
  doneTitle: { color: '#e5e7eb', fontSize: 24, fontWeight: '700', marginTop: 12 },
  doneSub: { color: '#6b7280', fontSize: 14, marginTop: 6 },
});
