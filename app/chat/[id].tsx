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

import { useApp } from '@/context/AppContext';
import { fetchThread, sendChatMessage, subscribeThread } from '@/lib/chat';
import { fetchPersonById } from '@/lib/db';
import { moderateImage } from '@/lib/moderation';
import { formatDistance, personById } from '@/lib/people';
import { colors, radius } from '@/lib/theme';
import type { ChatMessage, Person } from '@/lib/types';
import { pickImage, uploadImage } from '@/lib/upload';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { messages, sendMessage, userId, markBanned } = useApp();
  const [person, setPerson] = useState<Person | undefined>(personById(id ?? ''));
  const [thread, setThread] = useState<ChatMessage[]>(messages[id ?? ''] ?? []);
  const [draft, setDraft] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const cached = personById(id ?? '');
    if (cached) setPerson(cached);
    else if (id) fetchPersonById(id).then((p) => p && setPerson(p));
  }, [id]);

  useEffect(() => {
    if (!userId || !id) {
      setThread(messages[id ?? ''] ?? []);
      return;
    }
    let active = true;
    fetchThread(userId, id).then((rows) => {
      if (active) setThread(rows);
    });
    const unsub = subscribeThread(userId, id, (msg) => {
      setThread((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => {
      active = false;
      unsub();
    };
  }, [userId, id, messages]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [thread.length]);

  if (!person) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Chat unavailable.</Text>
      </SafeAreaView>
    );
  }

  const onSendImage = async () => {
    const picked = await pickImage();
    if (!picked) return;
    setSendingImage(true);
    try {
      if (userId) {
        const verdict = await moderateImage(userId, picked.base64, 'chat_image');
        if (verdict === 'banned') {
          markBanned();
          return;
        }
        const url = await uploadImage('chat-images', userId, picked.base64);
        const msg = await sendChatMessage(userId, person.id, '', url);
        setThread((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else {
        sendMessage(person.id, '', picked.uri);
      }
    } catch {
      // retry by sending again
    } finally {
      setSendingImage(false);
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      if (userId) {
        const msg = await sendChatMessage(userId, person.id, text);
        setThread((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      } else {
        sendMessage(person.id, text);
      }
    } catch {
      setDraft(text);
    }
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
          <Text style={styles.dist}>
            {person.distanceKm ? formatDistance(person.distanceKm) : person.city || 'Matcharound'}
          </Text>
        </View>
        <Pressable
          style={styles.headIcon}
          onPress={() => router.push(`/call/${person.id}?mode=voice`)}>
          <Ionicons name="call" size={18} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.headIcon}
          onPress={() => router.push(`/call/${person.id}?mode=video`)}>
          <Ionicons name="videocam" size={18} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {thread.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bubble,
                msg.fromMe ? styles.mine : styles.theirs,
                msg.imageUrl ? styles.imageBubble : null,
              ]}>
              {msg.imageUrl ? (
                <Image source={{ uri: msg.imageUrl }} style={styles.bubbleImage} contentFit="cover" />
              ) : null}
              {msg.text ? <Text style={styles.bubbleText}>{msg.text}</Text> : null}
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <Pressable
              style={[styles.attach, sendingImage && styles.sendOff]}
              onPress={onSendImage}
              disabled={sendingImage}>
              <Ionicons name={sendingImage ? 'hourglass' : 'image'} size={18} color={colors.text} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
            />
            <Pressable
              style={[styles.send, !draft.trim() && styles.sendOff]}
              onPress={onSend}
              disabled={!draft.trim()}>
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
  imageBubble: { padding: 4, overflow: 'hidden' },
  bubbleImage: { width: 220, height: 220, borderRadius: radius.md - 4 },
  attach: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  bubbleText: { color: colors.white, fontSize: 16, lineHeight: 22 },
  composer: { paddingHorizontal: 12, paddingBottom: 8 },
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
