import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  getConversationMembers,
  getMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  type ChatMessage,
  type ConversationMember,
} from '@/lib/chat';
import { Button, ErrorState, Input, Skeleton } from '@/components/ui';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, type, fontFamily } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const myId = session?.user.id;
  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const otherMember = members.find((m) => m.user_id !== myId);

  const appendIfNew = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  useEffect(() => {
    if (!id || !myId) return;
    let cancelled = false;

    (async () => {
      const [msgs, mems] = await Promise.all([getMessages(id), getConversationMembers(id)]);
      if (cancelled) return;
      if (msgs.error) setError(msgs.error);
      else setMessages(msgs.data);
      setMembers(mems);
      setLoading(false);
      markConversationRead(id, myId);
    })();

    const unsubscribe = subscribeToMessages(id, appendIfNew, setError);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, myId, appendIfNew]);

  useEffect(() => {
    // Keep the latest message in view as new ones arrive.
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !id) return;
    setDraft('');
    setSending(true);
    const { data, error } = await sendMessage(id, content);
    setSending(false);
    if (error) {
      setError(error);
      return;
    }
    if (data) appendIfNew(data);
  }

  const title = otherMember?.full_name ?? 'Chat';
  const closeScreen = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chat');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Button label="Back" onPress={closeScreen} variant="ghost" size="sm" />
        <Text
          numberOfLines={1}
          style={{ color: colors.ink, fontFamily: fontFamily.display.medium, fontSize: type.h3.fontSize, flex: 1 }}
        >
          {title}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'flex-end' }}>
            <Skeleton width="72%" height={42} /><Skeleton width="55%" height={42} style={{ alignSelf: 'flex-end' }} /><Skeleton width="66%" height={42} />
          </View>
        ) : error && messages.length === 0 ? (
          <ErrorState description={error} onRetry={() => setError(null)} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === myId;
              const senderName = memberById.get(item.sender_id)?.full_name;
              return (
                <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && members.length > 2 && senderName ? (
                    <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.medium, fontSize: type.caption.fontSize, marginBottom: 2 }}>
                      {senderName}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      maxWidth: '80%',
                      backgroundColor: isMe ? colors.primary : colors.surfaceMuted,
                      borderRadius: 16,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                    }}
                  >
                    <Text style={{ color: isMe ? colors.onPrimary : colors.ink, fontFamily: fontFamily.body.regular, fontSize: type.body.fontSize }}>
                      {item.content}
                    </Text>
                  </View>
                  <Text style={{ color: colors.inkFaint, fontFamily: fontFamily.body.regular, fontSize: type.caption.fontSize, marginTop: 2 }}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Input placeholder="Message" value={draft} onChangeText={setDraft} multiline />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={sending || draft.trim().length === 0}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              opacity: draft.trim().length === 0 ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            {sending ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Feather name="send" size={18} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
