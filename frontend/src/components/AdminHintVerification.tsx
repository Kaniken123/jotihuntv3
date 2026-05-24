import React, { useEffect, useState } from 'react';
import { gameService } from '../services/gameService';
import { CheckCircle, XCircle, Clock, MapPin } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface HintSolutionRow {
  id: number;
  fox_team?: string;
  lat?: number;
  lng?: number;
  solution: string;
  verification_status: 'unverified' | 'confirmed' | 'rejected';
  created_at: string;
  team_name?: string;
  submitted_by?: string;
  hint_title?: string;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unverified: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const AdminHintVerification: React.FC = () => {
  const [solutions, setSolutions] = useState<HintSolutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await gameService.getAllHintSolutions();
      setSolutions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load hint solutions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: number, verification_status: 'confirmed' | 'rejected' | 'unverified') => {
    setBusyId(id);
    try {
      await gameService.updateHintSolution(id, { verification_status });
      setSolutions((prev) => prev.map((s) => (s.id === id ? { ...s, verification_status } : s)));
    } catch (err) {
      console.error('Failed to update solution:', err);
      alert('Failed to update solution');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Sort: unverified first (need action), then by newest.
  const sorted = [...solutions].sort((a, b) => {
    if (a.verification_status === 'unverified' && b.verification_status !== 'unverified') return -1;
    if (b.verification_status === 'unverified' && a.verification_status !== 'unverified') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = solutions.filter((s) => s.verification_status === 'unverified').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Hint solutions
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {pendingCount} to review
            </span>
          )}
        </h2>
        <button onClick={load} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
          Refresh
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Confirmed solutions get full weight in the fox-location predictor; unverified ones count
        only lightly; rejected ones are ignored.
      </p>

      {sorted.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          No hint solutions submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.fox_team && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {s.fox_team}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLE[s.verification_status] || ''}`}>
                      {s.verification_status}
                    </span>
                    {s.lat != null && s.lng != null && (
                      <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3 mr-1" />
                        {Number(s.lat).toFixed(5)}, {Number(s.lng).toFixed(5)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-800 dark:text-gray-200 break-words">{s.solution}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {s.hint_title ? `${s.hint_title} · ` : ''}
                    {s.team_name ? `${s.team_name} · ` : ''}
                    {s.submitted_by ? `${s.submitted_by} · ` : ''}
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    disabled={busyId === s.id || s.verification_status === 'confirmed'}
                    onClick={() => setStatus(s.id, 'confirmed')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" /> Confirm
                  </button>
                  <button
                    disabled={busyId === s.id || s.verification_status === 'rejected'}
                    onClick={() => setStatus(s.id, 'rejected')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  {s.verification_status !== 'unverified' && (
                    <button
                      disabled={busyId === s.id}
                      onClick={() => setStatus(s.id, 'unverified')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                    >
                      <Clock className="w-4 h-4" /> Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHintVerification;
