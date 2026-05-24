import React, { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { gameService } from '../services/gameService';

/**
 * Admin "Reset for Launch" — every category is an independent checkbox so the
 * admin must explicitly opt each one in. A short typed confirmation gates the
 * actual wipe to prevent a misclick from nuking a live event.
 */

interface Category {
  key: string;
  title: string;
  detail: string;
  defaultChecked: boolean;
}

const CATEGORIES: Category[] = [
  // Fox state (the "old data keeps showing up" group)
  { key: 'fox_locations',       title: 'Fox locations & status',   detail: 'area_locations + clears areas.lat/lng/last_seen + resets status to active', defaultChecked: true },
  { key: 'fox_status_history',  title: 'Fox status history',       detail: 'green/orange/red transitions per fox',            defaultChecked: true },
  { key: 'predictions',         title: 'Cached predictions',       detail: 'fox_predictions table (derived data)',            defaultChecked: true },
  // Submissions
  { key: 'hunts',               title: 'Hunt submissions',         detail: 'all hunt photos and points awarded',              defaultChecked: true },
  { key: 'hint_solutions',      title: 'Hint solutions',           detail: 'all submitted RD-coordinate hint answers',        defaultChecked: true },
  // Other event state
  { key: 'subscription_visits', title: 'Subscription visits',      detail: 'recorded fox visits to clubhouses',               defaultChecked: true },
  { key: 'api_cache',           title: 'API sync cache',           detail: 'forces a fresh resync on next pull',              defaultChecked: true },
  // Optional
  { key: 'articles',            title: 'Articles (API content)',   detail: 'news / hints / assignments — will re-sync',       defaultChecked: false },
  { key: 'chat',                title: 'Chat history',             detail: 'team_messages + reactions (channels kept)',       defaultChecked: false },
];

const CONFIRM_PHRASE = 'RESET';

const AdminLaunchReset: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultChecked]))
  );
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const anyChecked = Object.values(flags).some(Boolean);
  const canRun = anyChecked && confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !running;

  const close = () => {
    if (running) return;
    setOpen(false);
    setConfirmText('');
    setResult(null);
    setFlags(Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultChecked])));
  };

  const run = async () => {
    setRunning(true);
    try {
      const res = await gameService.resetForLaunch(flags);
      setResult(res.deleted || {});
    } catch (err: any) {
      alert('Reset failed: ' + (err?.response?.data?.error || err?.message || 'unknown'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card p-4 border-l-4 border-red-500">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" /> Reset for launch
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Wipe accumulated event data before starting fresh. Every category is opt-in
            and the action is irreversible. Use this between events, never during one.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium shrink-0"
        >
          <RotateCcw className="w-4 h-4" /> Reset…
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" /> Reset for launch
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Tick the categories to wipe. Nothing is reset until you confirm.
              </p>
            </div>

            <div className="p-5 space-y-2 max-h-[55vh] overflow-y-auto">
              {result ? (
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-3">
                    Reset complete. Rows affected:
                  </p>
                  <ul className="text-sm font-mono text-gray-700 dark:text-gray-300 space-y-1">
                    {Object.entries(result).map(([k, n]) => (
                      <li key={k}>
                        {k}: <span className="font-semibold">{n}</span>
                      </li>
                    ))}
                    {Object.keys(result).length === 0 && <li>(nothing was selected)</li>}
                  </ul>
                </div>
              ) : (
                CATEGORIES.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!flags[c.key]}
                      onChange={(e) => setFlags({ ...flags, [c.key]: e.target.checked })}
                      className="mt-1"
                      disabled={running}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{c.detail}</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {!result && (
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to enable the reset button:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    className="input w-full font-mono"
                    disabled={running}
                  />
                </div>
                {!anyChecked && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Select at least one category to enable the reset.</p>
                )}
              </div>
            )}

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={close}
                disabled={running}
                className="px-4 py-2 text-sm rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  onClick={run}
                  disabled={!canRun}
                  className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {running ? 'Resetting…' : 'Reset selected'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLaunchReset;
