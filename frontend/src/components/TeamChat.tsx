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
        setMessages(prev => [...prev, message]);
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
  }, [socket]);

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

    try {
      const formData = new FormData();
      if (newMessage.trim()) {
        formData.append('message', newMessage);
      }
      if (selectedFile) {
        formData.append('attachment', selectedFile);
      }

      await api.post(`/chat/messages/${state.team.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {(message.user?.first_name || message.user?.username || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {message.user?.first_name && message.user?.last_name
                      ? `${message.user.first_name} ${message.user.last_name}`
                      : message.user?.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(message.created_at)}
                    {message.is_edited && (
                      <span className="ml-1 italic">(edited)</span>
                    )}
                  </p>
                  
                  {message.user_id === state.user?.id && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => startEditing(message)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                
                {editingMessage === message.id ? (
                  <div className="mt-1">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleEditMessage(message.id)}
                      className="input text-sm"
                      autoFocus
                    />
                    <div className="mt-1 space-x-2">
                      <button
                        onClick={() => handleEditMessage(message.id)}
                        className="text-xs btn btn-primary"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMessage(null)}
                        className="text-xs btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {message.message && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {message.message}
                      </p>
                    )}
                    
                    {message.attachment_url && (
                      <div className="mt-2">
                        {message.attachment_type === 'image' ? (
                          <img
                            src={message.attachment_url}
                            alt="Attachment"
                            className="max-w-sm rounded-lg shadow-sm"
                          />
                        ) : (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="input flex-1"
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
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isSending}
              >
                <Paperclip size={20} />
              </button>
            </div>
            
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="ml-2 text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedFile) || isSending}
            className="btn btn-primary flex items-center space-x-2"
          >
            {isSending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Send size={16} />
            )}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default TeamChat;