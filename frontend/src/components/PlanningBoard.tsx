import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/authService';
import { useWebSocket } from '../contexts/WebSocketContext';
import LoadingSpinner from './LoadingSpinner';
import { Plus, Trash2, LogOut, CheckCircle, BellRing, Clock } from 'lucide-react';

interface Entry {
  id: number;
  user_id: number | null;
  display_name: string | null;
  activity: string;
  track_location?: boolean;
  timer_started_at: string | null;
  threshold_minutes: number;
  overrun_notified: boolean;
  returned_at: string | null;
  username?: string;
  first_name?: string;
  last_name?: string;
  license_plate?: string | null;
}

const COLUMNS: { key: string; label: string }[] = [
  { key: 'unassigned', label: 'Niet ingedeeld' },
  { key: 'hunt', label: 'Hunt' },
  { key: 'creatief', label: 'Creatief' },
  { key: 'fotos', label: "Foto's" },
  { key: 'puzzels', label: 'Puzzels' },
];

const nameOf = (e: Entry) =>
  e.display_name ||
  `${e.first_name || ''} ${e.last_name || ''}`.trim() ||
  e.username ||
  'Onbekend';

// "2u 14m" / "14m" — how long this person has been on the road.
const formatElapsed = (ms: number) => {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
};

const PlanningBoard: React.FC = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [threshold, setThreshold] = useState(180);
  const [, setTick] = useState(0);
  const dragId = useRef<number | null>(null);

  const { socket } = useWebSocket();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/planning');
      setEntries(res.data.entries || []);
    } catch (e) {
      console.error('Failed to load planning board', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-render every 30s so the on-the-road timers stay current.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Live sync: any admin's change refreshes every open board.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => load();
    const onOverrun = () => {
      // The notification itself is raised globally in NotificationContext so
      // admins see it anywhere in the app; here we only refresh the board.
      load();
    };
    socket.on('planning-updated', onUpdate);
    socket.on('planning-overrun', onOverrun);
    return () => {
      socket.off('planning-updated', onUpdate);
      socket.off('planning-overrun', onOverrun);
    };
  }, [socket, load]);

  const move = async (id: number, activity: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, activity } : e))); // optimistic
    try { await api.patch(`/planning/${id}`, { activity }); } catch { load(); }
  };

  // Location tracking is switched per person, independent of their column.
  const setTracking = async (id: number, on: boolean) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, track_location: on } : e)));
    try { await api.patch(`/planning/${id}`, { track_location: on }); } catch { load(); }
  };

  const addPerson = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    try { await api.post('/planning', { display_name: name }); await load(); } catch { /* ignore */ }
  };

  const removeEntry = async (id: number) => {
    try { await api.delete(`/planning/${id}`); await load(); } catch { /* ignore */ }
  };

  const startTimer = async (id: number) => {
    try { await api.post(`/planning/${id}/leave`, { threshold_minutes: threshold }); await load(); } catch { /* ignore */ }
  };

  const stopTimer = async (id: number, returned: boolean) => {
    try { await api.post(`/planning/${id}/stop`, { returned }); await load(); } catch { /* ignore */ }
  };

  const sendBack = async (e: Entry) => {
    if (!e.user_id) {
      alert('Deze persoon heeft geen account, dus kan geen melding ontvangen.');
      return;
    }
    try {
      await api.post(`/planning/${e.id}/send-back`, {});
      alert(`${nameOf(e)} heeft een melding gekregen om terug te komen.`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Versturen mislukt');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Planning</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sleep mensen tussen de activiteiten. In de Hunt-kolom zie je hoe lang iemand onderweg is.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
            <Clock size={14} /> Max. hunttijd (min)
            <input
              type="number"
              min={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 180)}
              className="input w-20 ml-1"
            />
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerson()}
            placeholder="Naam toevoegen..."
            className="input w-48"
          />
          <button onClick={addPerson} className="btn btn-primary flex items-center gap-1">
            <Plus size={16} /> Toevoegen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = entries.filter((e) => e.activity === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId.current != null) { move(dragId.current, col.key); dragId.current = null; } }}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 min-h-[200px]"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-between">
                <span>{col.label}</span>
                <span className="text-xs font-normal text-gray-500">{items.length}</span>
              </h2>

              <div className="space-y-2">
                {items.map((e) => {
                  const started = e.timer_started_at ? new Date(e.timer_started_at).getTime() : null;
                  const elapsed = started ? Date.now() - started : 0;
                  const over = started ? elapsed > e.threshold_minutes * 60000 : false;
                  return (
                    <div
                      key={e.id}
                      draggable
                      onDragStart={() => { dragId.current = e.id; }}
                      className={`rounded-md border p-2 bg-white dark:bg-gray-700 cursor-move ${
                        over ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {nameOf(e)}
                          </p>
                          {e.license_plate && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">🚗 {e.license_plate}</p>
                          )}
                          {!e.user_id && (
                            <p className="text-[10px] text-gray-400">handmatig toegevoegd</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeEntry(e.id)}
                          title="Verwijderen"
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Touch-friendly fallback for drag & drop */}
                      <select
                        value={e.activity}
                        onChange={(ev) => move(e.id, ev.target.value)}
                        className="mt-2 w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-1 py-1"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>

                      <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!e.track_location}
                          onChange={(ev) => setTracking(e.id, ev.target.checked)}
                          disabled={!e.user_id}
                        />
                        <span>📍 Locatie volgen</span>
                      </label>
                      {!e.user_id && (
                        <p className="text-[10px] text-gray-400">geen account, dus geen locatie</p>
                      )}

                      {col.key === 'hunt' && (
                        <div className="mt-2 border-t border-gray-100 dark:border-gray-600 pt-2">
                          {started ? (
                            <>
                              <p className={`text-xs font-medium ${over ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                                Onderweg: {formatElapsed(elapsed)} / {e.threshold_minutes}m
                                {over && ' — tijd om!'}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <button onClick={() => stopTimer(e.id, true)} className="text-[11px] px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
                                  <CheckCircle size={11} /> Terug
                                </button>
                                <button onClick={() => stopTimer(e.id, false)} className="text-[11px] px-2 py-1 rounded bg-gray-500 hover:bg-gray-600 text-white">
                                  Stop
                                </button>
                                <button onClick={() => sendBack(e)} className="text-[11px] px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1">
                                  <BellRing size={11} /> Roep terug
                                </button>
                              </div>
                            </>
                          ) : (
                            <button onClick={() => startTimer(e.id)} className="text-[11px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
                              <LogOut size={11} /> Vertrokken
                            </button>
                          )}
                          {e.returned_at && !started && (
                            <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">terug</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sleep hier iemand naartoe</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlanningBoard;
