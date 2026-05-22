import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { api } from '../services/authService';
import LoadingSpinner from './LoadingSpinner';
import { Send, Paperclip, Hash, Users, MoreHorizontal, Search, Phone, Video } from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  type: 'general' | 'team';
  description?: string;
  team_id?: number;
  is_active: boolean;
}

interface ChatMessage {
  id: number;
  message: string;
  user_id: number;
  channel_id?: number;
  team_id?: number;
  attachment_url?: string;
  attachment_type?: string;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  username: string;
  first_name?: string;
  last_name?: string;
  status?: 'sent' | 'delivered' | 'read';
  reactions?: Array<{
    emoji: string;
    user_id: number;
  }>;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const ModernChat: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const { state } = useAuth();
  const { socket } = useWebSocket();
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
    }
  }, [activeChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket) {
      socket.on('new-message', handleNewMessage);
      socket.on('message-reaction-added', handleReactionUpdate);
      socket.on('message-reaction-removed', handleReactionUpdate);

      return () => {
        socket.off('new-message', handleNewMessage);
        socket.off('message-reaction-added', handleReactionUpdate);
        socket.off('message-reaction-removed', handleReactionUpdate);
      };
    }
  }, [socket, activeChannel]);

  const loadChannels = async () => {
    try {
      const response = await api.get('/chat/channels');
      setChannels(response.data);
      
      // Auto-select general channel if available, otherwise first channel
      const generalChannel = response.data.find((c: Channel) => c.type === 'general');
      setActiveChannel(generalChannel || response.data[0] || null);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (channelId: number) => {
    try {
      const response = await api.get(`/chat/channels/${channelId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleNewMessage = (message: ChatMessage) => {
    if (message.channel_id === activeChannel?.id) {
      setMessages(prev => {
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        
        return [...prev, {
          ...message,
          reactions: []
        }];
      });
    }
  };

  const handleReactionUpdate = (data: { message_id: number; reactions: any[] }) => {
    setMessages(prev => prev.map(msg => 
      msg.id === data.message_id 
        ? { ...msg, reactions: data.reactions }
        : msg
    ));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !activeChannel || isSending) return;

    setIsSending(true);

    try {
      const formData = new FormData();
      if (newMessage.trim()) {
        formData.append('message', newMessage.trim());
      }
      if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      await api.post(`/chat/channels/${activeChannel.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    try {
      await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    try {
      await api.delete(`/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const groupReactions = (reactions: any[]) => {
    const grouped: { [emoji: string]: number[] } = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r.user_id);
    });
    return grouped;
  };

  const hasUserReacted = (reactions: any[], emoji: string, userId: number) => {
    return reactions.some(r => r.emoji === emoji && r.user_id === userId);
  };

  const getAvatarColor = (userId: number) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-red-500', 'bg-yellow-500', 'bg-teal-500'
    ];
    return colors[userId % colors.length];
  };

  const getUserInitials = (message: ChatMessage) => {
    if (message.first_name && message.last_name) {
      return `${message.first_name.charAt(0)}${message.last_name.charAt(0)}`.toUpperCase();
    }
    return message.username.charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white dark:bg-gray-900">
      {/* Sidebar - Channels */}
      <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('chat.appTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('chat.appSubtitle')}
          </p>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setActiveChannel(channel)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeChannel?.id === channel.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  channel.type === 'general' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  {channel.type === 'general' ? (
                    <Hash className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{channel.name}</p>
                  {channel.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {channel.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChannel ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  activeChannel.type === 'general' 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : 'bg-blue-100 dark:bg-blue-900/30'
                }`}>
                  {activeChannel.type === 'general' ? (
                    <Hash className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activeChannel.name}
                  </h2>
                  {activeChannel.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activeChannel.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
              <div className="mt-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('chat.searchMessages')}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('chat.noMessagesTitle')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('chat.beFirst', { channel: activeChannel.name })}
                </p>
              </div>
            ) : (
              messages
                .filter(msg => 
                  !searchTerm || 
                  msg.message.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((message, index) => {
                  const isOwn = message.user_id === state.user?.id;
                  const showAvatar = index === 0 || messages[index - 1].user_id !== message.user_id;
                  const groupedReactions = groupReactions(message.reactions || []);

                  return (
                    <div key={message.id} className={`flex items-start space-x-3 group ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar */}
                      {showAvatar && !isOwn && (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getAvatarColor(message.user_id)}`}>
                          {getUserInitials(message)}
                        </div>
                      )}
                      
                      {!showAvatar && !isOwn && <div className="w-10" />}

                      {/* Message */}
                      <div className={`max-w-lg ${isOwn ? 'ml-auto' : ''}`}>
                        {/* Username and timestamp */}
                        {showAvatar && (
                          <div className={`flex items-baseline space-x-2 mb-1 ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {message.first_name && message.last_name
                                ? `${message.first_name} ${message.last_name}`
                                : message.username}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatTime(message.created_at)}
                              {message.is_edited && <span className="ml-1 italic">{t('chat.edited')}</span>}
                            </span>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`relative rounded-2xl px-4 py-3 ${
                          isOwn
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}>
                          {message.message && (
                            <p className="text-sm leading-relaxed break-words">
                              {message.message}
                            </p>
                          )}
                          
                          {message.attachment_url && (
                            <div className="mt-2">
                              {message.attachment_type === 'image' ? (
                                <img
                                  src={message.attachment_url}
                                  alt="Attachment"
                                  className="max-w-full rounded-lg"
                                />
                              ) : (
                                <a
                                  href={message.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-blue-300 hover:text-blue-100 transition-colors"
                                >
                                  <Paperclip size={16} />
                                  <span className="text-sm">{t('chat.viewAttachment')}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Reactions */}
                          {Object.keys(groupedReactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(groupedReactions).map(([emoji, userIds]) => (
                                <button
                                  key={emoji}
                                  onClick={() => 
                                    hasUserReacted(message.reactions || [], emoji, state.user!.id)
                                      ? handleRemoveReaction(message.id, emoji)
                                      : handleAddReaction(message.id, emoji)
                                  }
                                  className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                    hasUserReacted(message.reactions || [], emoji, state.user!.id)
                                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600'
                                      : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-gray-600 dark:text-gray-300">
                                    {userIds.length}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Add reaction button */}
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                            className="absolute -bottom-2 -right-2 w-6 h-6 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="text-xs">😀</span>
                          </button>

                          {/* Emoji picker */}
                          {showEmojiPicker === message.id && (
                            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-2 flex space-x-1 z-10">
                              {REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(message.id, emoji)}
                                  className="w-8 h-8 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
              <div className="flex-1">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      autoResizeTextarea();
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={t('chat.messagePlaceholder', { channel: activeChannel.name })}
                    className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none resize-none max-h-32 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    rows={1}
                    disabled={isSending}
                    style={{ minHeight: '44px' }}
                  />
                  
                  {selectedFile && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          📎 {selectedFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        disabled={isSending}
                      >
                        <Paperclip size={18} />
                      </button>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={(!newMessage.trim() && !selectedFile) || isSending}
                      className={`px-6 py-2 rounded-xl font-medium transition-all flex items-center space-x-2 ${
                        (!newMessage.trim() && !selectedFile) || isSending
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      {isSending ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Send size={16} />
                      )}
                      <span>{t('chat.send')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">💭</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('chat.noChannelsTitle')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t('chat.joinTeam')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernChat;