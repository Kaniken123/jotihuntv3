import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/authService';
import { useWebSocket } from '../contexts/WebSocketContext';
import { StickyNote } from 'lucide-react';

// Shared notepad beside the planning board. Saves itself shortly after typing
// stops; other admins' saves come in live unless you are typing yourself.
const SAVE_DELAY_MS = 800;

const PlanningNotes: React.FC = () => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const contentRef = useRef(content);
  contentRef.current = content;
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { socket } = useWebSocket();

  useEffect(() => {
    api.get('/planning/notes')
      .then((res) => setContent(res.data.content || ''))
      .catch((e) => console.error('Failed to load planning notes', e));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (data: { content: string }) => {
      if (!dirty.current) setContent(data.content || '');
    };
    socket.on('planning-notes-updated', onUpdate);
    return () => { socket.off('planning-notes-updated', onUpdate); };
  }, [socket]);

  const save = async (text: string) => {
    setStatus('saving');
    try {
      await api.put('/planning/notes', { content: text });
      dirty.current = false;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const onChange = (text: string) => {
    setContent(text);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(text), SAVE_DELAY_MS);
  };

  // Flush a pending save when leaving the page.
  useEffect(() => () => {
    if (timer.current && dirty.current) {
      clearTimeout(timer.current);
      void api.put('/planning/notes', { content: contentRef.current });
    }
  }, []);

  const statusText = { idle: '', saving: 'Opslaan...', saved: 'Opgeslagen', error: 'Opslaan mislukt' }[status];

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col h-full">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1"><StickyNote size={16} /> Notities</span>
        <span className={`text-xs font-normal ${status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>{statusText}</span>
      </h2>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Gedeeld met alle admins..."
        className="flex-1 min-h-[300px] w-full resize-none rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};

export default PlanningNotes;
