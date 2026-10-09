import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

// Renders the ephemeral in-app popups from NotificationContext (chat messages,
// hunt reviews, assignments, etc.) as a stack of toasts in the top-right corner.
// Mounted once, inside the providers. Click a message toast to jump to chat.
const ICONS: Record<string, string> = {
  message: '💬',
  hunt: '🦊',
  assignment: '📝',
  location: '📍',
  system: '🔔',
};

const ToastHost: React.FC = () => {
  const { toasts, dismissToast, markAsRead } = useNotifications();
  const navigate = useNavigate();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          onClick={() => {
            markAsRead(toast.id);
            dismissToast(toast.id);
            if (toast.type === 'message') navigate('/chat');
          }}
          className="cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-[slideIn_0.2s_ease-out]"
        >
          <span className="text-xl leading-none mt-0.5">{ICONS[toast.type] || '🔔'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
              {toast.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 break-words line-clamp-2">
              {toast.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(toast.id);
            }}
            aria-label="Sluiten"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
