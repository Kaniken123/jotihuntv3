import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { api } from '../services/authService';
import { TeamMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { Send, Paperclip, Edit3, Trash2 } from 'lucide-react';

const TeamChat: React.FC = () => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { state } = useAuth();
  const { socket } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (state.team) {
      loadMessages();
    }
  }, [state.team]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket) {
      socket.on('new-message', (message: TeamMessage) => {
        console.log('WebSocket message received:', message); // Debug log
        
        setMessages(prev => {
          // Avoid duplicates - check if message already exists (from our optimistic update)
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('Message already exists, skipping'); // Debug log
            return prev;
          }
          
          // Check if this is from the current user (they already have the optimistic message)
          const isFromCurrentUser = message.user_id === state.user?.id;
          if (isFromCurrentUser) {
            console.log('Message from current user, looking for optimistic message to replace'); // Debug log
            
            // Find and replace optimistic message with real one
            const optimisticIndex = prev.findIndex(m => 
              m.user_id === message.user_id && 
              m.message === message.message && 
              m.id > 1000000000000 && // Temporary ID from Date.now()
              Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 10000
            );
            
            if (optimisticIndex !== -1) {
              console.log('Replacing optimistic message at index', optimisticIndex); // Debug log
              const newMessages = [...prev];
              newMessages[optimisticIndex] = {
                ...message,
                user: {
                  username: message.username,
                  first_name: message.first_name,
                  last_name: message.last_name
                }
              };
              return newMessages;
            }
          }
          
          // Add new message from other users
          console.log('Adding new message from other user'); // Debug log
          return [...prev, {
            ...message,
            user: {
              username: message.username,
              first_name: message.first_name,
              last_name: message.last_name
            }
          }];
        });
      });

      socket.on('message-updated', (message: TeamMessage) => {
        setMessages(prev => prev.map(m => m.id === message.id ? message : m));
        setEditingMessage(null);
      });

      socket.on('message-deleted', (data: { id: number }) => {
        setMessages(prev => prev.filter(m => m.id !== data.id));
      });

      return () => {
        socket.off('new-message');
        socket.off('message-updated');
        socket.off('message-deleted');
      };
    }
  }, [socket, state.user?.id]);

  const loadMessages = async () => {
    if (!state.team) return;
    
    try {
      const response = await api.get(`/chat/messages/${state.team.id}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !state.team || isSending) return;

    setIsSending(true);

    // Create optimistic message for immediate UI update
    const now = new Date();
    const optimisticMessage: TeamMessage = {
      id: Date.now(), // Temporary ID (will be replaced by server)
      team_id: state.team.id,
      user_id: state.user!.id,
      message: newMessage.trim(),
      attachment_url: undefined,
      attachment_type: undefined,
      is_edited: false,
      edited_at: undefined,
      created_at: now.toISOString(),
      user: {
        username: state.user!.username,
        first_name: state.user!.first_name,
        last_name: state.user!.last_name
      }
    };

    // Add message immediately to UI
    setMessages(prev => [...prev, optimisticMessage]);

    // Clear input immediately for better UX
    const messageText = newMessage;
    const fileToSend = selectedFile;
    setNewMessage('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const formData = new FormData();
      if (messageText.trim()) {
        formData.append('message', messageText);
      }
      if (fileToSend) {
        formData.append('attachment', fileToSend);
      }

      const response = await api.post(`/chat/messages/${state.team.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Replace optimistic message with real message from server
      const serverMessage = response.data;
      console.log('Server message received:', serverMessage); // Debug log
      
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id ? {
          ...serverMessage,
          user: {
            username: serverMessage.username,
            first_name: serverMessage.first_name,
            last_name: serverMessage.last_name
          }
        } : msg
      ));

    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on error and restore input
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(messageText);
      setSelectedFile(fileToSend);
      
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId: number) => {
    if (!editText.trim()) return;

    try {
      await api.put(`/chat/messages/${messageId}`, { message: editText });
      setEditText('');
      setEditingMessage(null);
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(`/chat/messages/${messageId}`);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const startEditing = (message: TeamMessage) => {
    setEditingMessage(message.id);
    setEditText(message.message);
  };

  const formatTime = (timestamp: string | number) => {
    try {
      // Handle different timestamp formats
      let date: Date;
      
      if (typeof timestamp === 'number') {
        // Unix timestamp
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        // ISO string or other string format
        date = new Date(timestamp);
      } else {
        return 'Now';
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return 'Now';
      }
      
      // Format the time
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error, 'for timestamp:', timestamp);
      return 'Now';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!state.team) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            You need to be part of a team to access chat
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Team Chat - {state.team.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {state.team.area} Area
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={message.id} 
              className={`flex space-x-3 animate-in slide-in-from-bottom duration-300 ${
                message.user_id === state.user?.id ? 'justify-end' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {message.user_id !== state.user?.id && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {(message.user?.first_name || message.user?.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              
              <div className={`flex-1 min-w-0 max-w-xs sm:max-w-md ${
                message.user_id === state.user?.id ? 'ml-12' : ''
              }`}>
                <div className={`rounded-lg px-4 py-3 ${
                  message.user_id === state.user?.id 
                    ? 'bg-primary-600 text-white ml-auto' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {message.user_id !== state.user?.id && (
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {message.user?.first_name && message.user?.last_name
                          ? `${message.user.first_name} ${message.user.last_name}`
                          : message.user?.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {message.created_at ? formatTime(message.created_at) : 'Now'}
                        {message.is_edited && (
                          <span className="ml-1 italic">(edited)</span>
                        )}
                      </p>
                    </div>
                  )}
                  
                  {message.user_id === state.user?.id && (
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-primary-100">
                        {message.created_at ? formatTime(message.created_at) : 'Now'}
                        {message.is_edited && (
                          <span className="ml-1 italic">(edited)</span>
                        )}
                      </p>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => startEditing(message)}
                          className="text-primary-200 hover:text-white transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-primary-200 hover:text-red-200 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                
                  {editingMessage === message.id ? (
                    <div className="mt-1">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleEditMessage(message.id)}
                        className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                        autoFocus
                      />
                      <div className="mt-2 flex space-x-2">
                        <button
                          onClick={() => handleEditMessage(message.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessage(null)}
                          className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.message && (
                        <p className={`text-sm ${
                          message.user_id === state.user?.id 
                            ? 'text-white' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {message.message}
                        </p>
                      )}
                      
                      {message.attachment_url && (
                        <div className="mt-2">
                          {message.attachment_type === 'image' ? (
                            <img
                              src={message.attachment_url}
                              alt="Attachment"
                              className="max-w-full rounded-lg shadow-sm"
                            />
                          ) : (
                            <a
                              href={message.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center space-x-2 ${
                                message.user_id === state.user?.id
                                  ? 'text-primary-100 hover:text-white'
                                  : 'text-primary-600 hover:text-primary-700 dark:text-primary-400'
                              } transition-colors`}
                            >
                              <Paperclip size={16} />
                              <span className="text-sm">View attachment</span>
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                disabled={isSending}
              />
              
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
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isSending}
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
            </div>
            
            {selectedFile && (
              <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 dark:text-blue-300">
                    📎 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedFile) || isSending}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
              (!newMessage.trim() && !selectedFile) || isSending
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-lg transform hover:scale-105'
            }`}
          >
            {isSending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Send size={16} />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default TeamChat;