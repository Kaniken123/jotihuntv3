import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { NotificationData } from '../types';
import { 
  Bell, 
  BellOff, 
  X, 
  MessageSquare, 
  Camera, 
  FileText, 
  MapPin, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';

const NotificationCenter: React.FC = () => {
  const { state, markAsRead, markAllAsRead, removeNotification, clearAll, toggleVisibility } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4" />;
      case 'hunt': return <Camera className="w-4 h-4" />;
      case 'assignment': return <FileText className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'system': return <AlertTriangle className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message': return 'text-blue-600 dark:text-blue-400';
      case 'hunt': return 'text-green-600 dark:text-green-400';
      case 'assignment': return 'text-orange-600 dark:text-orange-400';
      case 'location': return 'text-purple-600 dark:text-purple-400';
      case 'system': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    switch (notification.type) {
      case 'message':
        // Navigate to chat
        window.location.href = '/chat';
        break;
      case 'hunt':
        // Navigate to hunt page
        window.location.href = '/hunt';
        break;
      case 'assignment':
        // Navigate to updates
        window.location.href = '/updates';
        break;
      case 'location':
        // Navigate to map
        window.location.href = '/';
        break;
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={toggleVisibility}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded-lg"
      >
        {state.unreadCount > 0 ? (
          <Bell className="w-6 h-6" />
        ) : (
          <BellOff className="w-6 h-6" />
        )}
        
        {state.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[1.25rem] h-5">
            {state.unreadCount > 99 ? '99+' : state.unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {state.isVisible && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
            <div className="flex items-center space-x-2">
              {state.unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Mark all read
                </button>
              )}
              {state.notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleVisibility}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {state.notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No notifications yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {state.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 mt-1 ${getNotificationColor(notification.type)}`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p className={`text-sm font-medium ${
                            !notification.read 
                              ? 'text-gray-900 dark:text-gray-100' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {notification.title}
                          </p>
                          
                          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          
                          {notification.type === 'assignment' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Action Required
                            </span>
                          )}
                          
                          {notification.type === 'hunt' && notification.data?.status === 'approved' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {state.notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {Math.min(state.notifications.length, 50)} most recent notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;