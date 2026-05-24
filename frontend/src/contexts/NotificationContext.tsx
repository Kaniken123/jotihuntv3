import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { isAdmin } from '../utils/roleUtils';
import { useWebSocket } from './WebSocketContext';
import { NotificationData } from '../types';

interface NotificationState {
  notifications: NotificationData[];
  unreadCount: number;
  isVisible: boolean;
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: NotificationData }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'TOGGLE_VISIBILITY' }
  | { type: 'SET_NOTIFICATIONS'; payload: NotificationData[] };

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isVisible: false,
};

const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      const newNotifications = [action.payload, ...state.notifications];
      return {
        ...state,
        notifications: newNotifications.slice(0, 50), // Keep only last 50 notifications
        unreadCount: state.unreadCount + 1,
      };

    case 'MARK_READ':
      const updatedNotifications = state.notifications.map(notification =>
        notification.id === action.payload ? { ...notification, read: true } : notification
      );
      const unreadAfterRead = updatedNotifications.filter(n => !n.read).length;
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: unreadAfterRead,
      };

    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      };

    case 'REMOVE_NOTIFICATION':
      const filtered = state.notifications.filter(n => n.id !== action.payload);
      return {
        ...state,
        notifications: filtered,
        unreadCount: filtered.filter(n => !n.read).length,
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      };

    case 'TOGGLE_VISIBILITY':
      return {
        ...state,
        isVisible: !state.isVisible,
      };

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
        unreadCount: action.payload.filter(n => !n.read).length,
      };

    default:
      return state;
  }
};

interface NotificationContextType {
  state: NotificationState;
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  toggleVisibility: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { state: authState } = useAuth();
  const { socket } = useWebSocket();
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      try {
        const notifications = JSON.parse(saved);
        dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
      } catch (error) {
        console.error('Failed to load notifications from localStorage:', error);
      }
    }
  }, []);

  // Save notifications to localStorage when they change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(state.notifications));
  }, [state.notifications]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket || !authState.isAuthenticated) return;

    const handleNewMessage = (data: any) => {
      addNotification({
        type: 'message',
        title: 'New Team Message',
        message: `${data.user?.first_name || data.user?.username || 'Someone'} sent a message`,
        read: false,
        data
      });
    };

    // Admin-only: a new hunt photo was submitted and is waiting for review.
    // The backend broadcasts this on every submit; non-admins ignore it.
    const handleHuntPendingReview = (data: any) => {
      if (!isAdmin(authState.user)) return;
      const hunter = data?.first_name
        ? `${data.first_name} ${data.last_name || ''}`.trim()
        : data?.username || 'a hunter';
      addNotification({
        type: 'hunt',
        title: 'New hunt to review',
        message: `${hunter} submitted a hunt for ${data?.fox_area || 'a fox'}`,
        read: false,
        data,
      });
    };

    const handleHuntReviewed = (data: any) => {
      const isApproved = data.status === 'approved';
      addNotification({
        type: 'hunt',
        title: isApproved ? 'Hunt Approved!' : 'Hunt Rejected',
        message: isApproved 
          ? `Your ${data.fox_area} hunt was approved for ${data.points_awarded} points!`
          : `Your ${data.fox_area} hunt was rejected: ${data.rejection_reason}`,
        read: false,
        data
      });
    };

    const handleNewAssignment = (data: any) => {
      addNotification({
        type: 'assignment',
        title: 'New Assignment',
        message: data.title,
        read: false,
        data
      });
    };

    const handleLocationAlert = (data: any) => {
      addNotification({
        type: 'location',
        title: 'Location Alert',
        message: data.message,
        read: false,
        data
      });
    };

    const handleSystemNotification = (data: any) => {
      addNotification({
        type: 'system',
        title: data.title || 'System Notification',
        message: data.message,
        read: false,
        data
      });
    };

    const handleTeamNotification = (data: any) => {
      addNotification({
        type: 'system',
        title: data.title || 'Team Notification',
        message: data.message,
        read: false,
        data
      });
    };

    const handleUserNotification = (data: any) => {
      addNotification({
        type: 'system',
        title: data.title || 'Personal Notification',
        message: data.message,
        read: false,
        data
      });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('hunt-pending-review', handleHuntPendingReview);
    socket.on('hunt-reviewed', handleHuntReviewed);
    socket.on('new-assignment', handleNewAssignment);
    socket.on('location-alert', handleLocationAlert);
    socket.on('system-notification', handleSystemNotification);
    socket.on('team-notification', handleTeamNotification);
    socket.on('user-notification', handleUserNotification);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('hunt-pending-review', handleHuntPendingReview);
      socket.off('hunt-reviewed', handleHuntReviewed);
      socket.off('new-assignment', handleNewAssignment);
      socket.off('location-alert', handleLocationAlert);
      socket.off('system-notification', handleSystemNotification);
      socket.off('team-notification', handleTeamNotification);
      socket.off('user-notification', handleUserNotification);
    };
  }, [socket, authState.isAuthenticated]);

  const addNotification = (notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const newNotification: NotificationData = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

    // Show browser notification if permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/favicon.ico',
          tag: newNotification.id,
          requireInteraction: newNotification.type === 'assignment',
        });

        // Auto-close after 5 seconds for most notifications
        if (newNotification.type !== 'assignment') {
          const timeoutId = setTimeout(() => {
            browserNotification.close();
          }, 5000);
          timeoutsRef.current.push(timeoutId);
        }

        browserNotification.onclick = () => {
          window.focus();
          markAsRead(newNotification.id);
          browserNotification.close();
        };
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  };

  const markAsRead = (id: string) => {
    dispatch({ type: 'MARK_READ', payload: id });
  };

  const markAllAsRead = () => {
    dispatch({ type: 'MARK_ALL_READ' });
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' });
  };

  const toggleVisibility = () => {
    dispatch({ type: 'TOGGLE_VISIBILITY' });
  };

  // Cleanup all timeouts when component unmounts
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  return (
    <NotificationContext.Provider value={{
      state,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
      toggleVisibility,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};