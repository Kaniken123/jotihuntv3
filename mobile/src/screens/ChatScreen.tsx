import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { gameService } from '../services/gameService';
import { TeamMessage, ChatChannel } from '../types';
import { format, isToday, isYesterday } from 'date-fns';

const senderName = (m: TeamMessage): string =>
  m.first_name || m.username || m.user?.first_name || m.user?.username || 'Unknown';

const ChatScreen: React.FC = () => {
  const { state: authState } = useAuth();
  const { on, off, isConnected } = useWebSocket();
  const flatListRef = useRef<FlatList>(null);

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const activeChannelRef = useRef<ChatChannel | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  // Load the channels the hunter can see (general + their deelgebieden). The
  // server assigns socket rooms from membership, so no join needed here.
  useEffect(() => {
    (async () => {
      try {
        const chans = await gameService.getChatChannels();
        setChannels(chans);
        // Default to the general channel, else the first available.
        setActiveChannel(chans.find((c) => c.type === 'general') || chans[0] || null);
      } catch (error) {
        console.error('Failed to load channels:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Load messages whenever the active channel changes.
  useEffect(() => {
    if (!activeChannel) return;
    (async () => {
      try {
        const data = await gameService.getChannelMessages(activeChannel.id);
        setMessages(data);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    })();
  }, [activeChannel?.id]);

  // Realtime: the server emits 'new-message' into the channel's room. Only keep
  // ones for the channel currently open.
  useEffect(() => {
    const handleNewMessage = (message: TeamMessage) => {
      if (message.channel_id !== activeChannelRef.current?.id) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };
    on('new-message', handleNewMessage);
    return () => off('new-message', handleNewMessage);
  }, [on, off]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChannel || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const sent = await gameService.sendChannelMessage(activeChannel.id, messageText);
      // Optimistically add — don't rely on the socket echo reaching us.
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageText); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    }
    return format(date, 'dd MMM HH:mm');
  };

  const renderMessage = ({ item, index }: { item: TeamMessage; index: number }) => {
    const isOwnMessage = item.user_id === authState.user?.id;
    const showAvatar =
      index === 0 || messages[index - 1]?.user_id !== item.user_id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isOwnMessage && showAvatar && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {senderName(item)[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            !isOwnMessage && !showAvatar && styles.noAvatarMargin,
          ]}
        >
          {!isOwnMessage && showAvatar && (
            <Text style={styles.senderName}>{senderName(item)}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.message}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatMessageDate(item.created_at)}
            {item.is_edited && ' (edited)'}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{activeChannel?.name || 'Chat'}</Text>
          {activeChannel?.description ? (
            <Text style={styles.headerSubtitle}>{activeChannel.description}</Text>
          ) : null}
        </View>
        <View
          style={[
            styles.connectionBadge,
            isConnected ? styles.connected : styles.disconnected,
          ]}
        >
          <View
            style={[
              styles.connectionDot,
              isConnected ? styles.dotConnected : styles.dotDisconnected,
            ]}
          />
          <Text style={styles.connectionText}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Channel switcher */}
      {channels.length > 1 && (
        <View style={styles.channelBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelBarContent}>
            {channels.map((c) => {
              const active = c.id === activeChannel?.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setActiveChannel(c)}
                  style={[styles.channelTab, active && styles.channelTabActive]}
                >
                  <Text style={[styles.channelTabText, active && styles.channelTabTextActive]}>
                    {c.type === 'general' ? '# ' : ''}{c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  noTeamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F3F4F6',
  },
  noTeamTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  noTeamText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerInfo: {},
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connected: {
    backgroundColor: '#DCFCE7',
  },
  disconnected: {
    backgroundColor: '#FEE2E2',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#10B981',
  },
  dotDisconnected: {
    backgroundColor: '#EF4444',
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  channelBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  channelBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  channelTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  channelTabActive: {
    backgroundColor: '#1E40AF',
  },
  channelTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  channelTabTextActive: {
    color: '#FFFFFF',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#1E40AF',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  noAvatarMargin: {
    marginLeft: 40,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1F2937',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
});

export default ChatScreen;
