import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TypingDots } from '@/components/TypingDots';
import { useApp } from '@/context/AppContext';
import { formatDistance, personById } from '@/lib/people';
import { colors, radius } from '@/lib/theme';

const replies = [
  'I’m nearby too — want to jump on a voice call?',
  'Haha okay. Video might be easier than typing forever.',
  'That works. I can meet around here after 7.',
  'Still around? I just finished work.',
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { messages, sendMessage, addIncoming, like } = useApp();
  const person = personById(id ?? '');
  const thread = messages[id ?? ''] ?? [];
  const [draft, setDraft] = useState('');
  const [theyTyping, setTheyTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id) like(id);
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [thread.length, theyTyping]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  if (!person) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Chat unavailable.</Text>
      </SafeAreaView>
    );
  }

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(person.id, text);
    setDraft('');
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      setTheyTyping(true);
      replyTimer.current = setTimeout(() => {
        setTheyTyping(false);
        addIncoming(person.id, replies[thread.length % replies.length]);
      }, 1400);
    }, 700);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Image source={{ uri: person.photo }} style={styles.avatar} />
        <View style={styles.headMeta}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.dist}>{formatDistance(person.distanceKm)}</Text>
        </View>
        <Pressable style={styles.headIcon} onPress={() => router.push(`/call/${person.id}?mode=voice`)}>
          <Ionicons name="call" size={18} color={colors.text} />
        </Pressable>
        <Pressable style={styles.headIcon} onPress={() => router.push(`/call/${person.id}?mode=video`)}>
          <Ionicons name="videocam" size={18} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {thread.map((msg) => (
            <View key={msg.id} style={[styles.bubble, msg.fromMe ? styles.mine : styles.theirs]}>
              <Text style={styles.bubbleText}>{msg.text}</Text>
            </View>
          ))}
          {theyTyping ? (
            <View style={[styles.bubble, styles.theirs, styles.typingBubble]}>
              <TypingDots color={colors.text} />
              <Text style={styles.typingLabel}>{person.name} is typing</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          {draft.length > 0 ? (
            <View style={styles.youTyping}>
              <TypingDots color={colors.accent} />
              <Text style={styles.youTypingText}>You are typing…</Text>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
            />
            <Pressable style={[styles.send, !draft.trim() && styles.sendOff]} onPress={onSend} disabled={!draft.trim()}>
              <Ionicons name="send" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  missing: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headMeta: { flex: 1 },
  name: { color: colors.text, fontWeight: '800', fontSize: 16 },
  dist: { color: colors.gold, fontSize: 12, fontWeight: '600' },
  headIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: { padding: 16, gap: 10, paddingBottom: 20 },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  bubbleText: { color: colors.white, fontSize: 16, lineHeight: 22 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingLabel: { color: colors.muted, fontSize: 12 },
  composer: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  youTyping: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 },
  youTypingText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, color: colors.text, maxHeight: 110, paddingVertical: 8, fontSize: 16 },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
