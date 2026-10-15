import React, { useEffect, useState } from 'react';
import { api } from '../services/authService';
import { Send, Megaphone } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  content: string;
  type: string;
  area?: string | null;
  published_at?: string;
  external_id?: string | null;
}

// Epic E — admins write their own updates. Everyone gets a popup + a push.
const AdminUpdateComposer: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('news');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<Article[]>([]);

  const loadRecent = async () => {
    try {
      const res = await api.get('/jotihunt/articles');
      setRecent((res.data || []).slice(0, 10));
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => { loadRecent(); }, []);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Titel en bericht zijn verplicht');
      return;
    }
    setSending(true); setError(''); setSent(false);
    try {
      await api.post('/jotihunt/articles', { title: title.trim(), content: content.trim(), type });
      setTitle(''); setContent('');
      setSent(true);
      setTimeout(() => setSent(false), 4000);
      loadRecent();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Plaatsen mislukt');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Megaphone className="w-6 h-6" /> Update plaatsen
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Iedereen krijgt direct een melding (popup in de app en een pushbericht).
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {sent && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
          Update geplaatst en verstuurd.
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Korte titel"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bericht</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input min-h-[140px]"
            placeholder="Wat moeten de hunters weten?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input max-w-xs">
            <option value="news">Nieuws</option>
            <option value="assignment">Opdracht</option>
            <option value="hint">Hint</option>
          </select>
        </div>

        <button onClick={submit} disabled={sending} className="btn btn-primary flex items-center gap-2">
          <Send size={16} />
          {sending ? 'Plaatsen...' : 'Plaatsen en iedereen melden'}
        </button>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Recente updates</h2>
        <div className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen updates.</p>
          )}
          {recent.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0 pb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {a.type}
                  {!a.external_id && ' · zelf geplaatst'}
                  {a.published_at && ` · ${new Date(a.published_at).toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminUpdateComposer;
