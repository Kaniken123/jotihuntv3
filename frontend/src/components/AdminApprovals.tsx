import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/authService';
import { UserCheck, UserX, MapPin, Loader2, Users } from 'lucide-react';

interface AdminUser {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  scouting_group?: string;
  created_at?: string;
}
interface Deelgebied {
  id: number;
  name: string;
  is_active: boolean;
}
interface Member {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
}

const fullName = (u: { first_name?: string; last_name?: string; username: string }) =>
  u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : u.username;

const AdminApprovals: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [deelgebieden, setDeelgebieden] = useState<Deelgebied[]>([]);
  const [membersByDg, setMembersByDg] = useState<Record<number, Member[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  // per-pending-user selected deelgebied to assign on approve
  const [assignChoice, setAssignChoice] = useState<Record<number, number | ''>>({});
  // roster: which hunter to add to a given deelgebied
  const [rosterChoice, setRosterChoice] = useState<Record<number, number | ''>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const [usersRes, dgRes] = await Promise.all([
        api.get('/users'),
        api.get('/deelgebieden'),
      ]);
      const dgs: Deelgebied[] = dgRes.data;
      setUsers(usersRes.data);
      setDeelgebieden(dgs);
      const membersEntries = await Promise.all(
        dgs.map(async (d) => [d.id, (await api.get(`/deelgebieden/${d.id}/members`)).data] as const)
      );
      setMembersByDg(Object.fromEntries(membersEntries));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load approvals data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = users
    .filter((u) => u.status === 'pending')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); // newest first
  const approved = users.filter((u) => u.status === 'approved');

  const setStatus = async (userId: number, status: string, deelgebiedId?: number | '') => {
    setBusyId(userId);
    setError('');
    try {
      await api.patch(`/users/${userId}/status`, { status });
      if (status === 'approved' && deelgebiedId) {
        await api.post(`/deelgebieden/${deelgebiedId}/members`, { user_id: userId });
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const assign = async (deelgebiedId: number, userId: number | '') => {
    if (!userId) return;
    setError('');
    try {
      await api.post(`/deelgebieden/${deelgebiedId}/members`, { user_id: userId });
      setRosterChoice((c) => ({ ...c, [deelgebiedId]: '' }));
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Assign failed');
    }
  };

  const removeMember = async (deelgebiedId: number, userId: number) => {
    setError('');
    try {
      await api.delete(`/deelgebieden/${deelgebiedId}/members/${userId}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Remove failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>
      )}

      {/* Pending approvals */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pending approvals</h2>
          <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No accounts waiting for approval.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{fullName(u)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {u.email}{u.created_at ? ` · ${new Date(u.created_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <select
                  className="input h-9 py-0 text-sm max-w-[12rem]"
                  value={assignChoice[u.id] ?? ''}
                  onChange={(e) => setAssignChoice((c) => ({ ...c, [u.id]: e.target.value ? Number(e.target.value) : '' }))}
                  disabled={busyId === u.id}
                >
                  <option value="">Assign deelgebied… (optional)</option>
                  {deelgebieden.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(u.id, 'approved', assignChoice[u.id])}
                    disabled={busyId === u.id}
                    className="btn btn-primary h-9 py-0 text-sm flex items-center gap-1"
                  >
                    <UserCheck className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => setStatus(u.id, 'rejected')}
                    disabled={busyId === u.id}
                    className="btn btn-secondary h-9 py-0 text-sm flex items-center gap-1"
                  >
                    <UserX className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Deelgebied roster */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deelgebieden roster</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deelgebieden.map((d) => {
            const members = membersByDg[d.id] || [];
            const memberIds = new Set(members.map((m) => m.id));
            const assignable = approved.filter((u) => !memberIds.has(u.id));
            return (
              <div key={d.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</h3>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Users className="w-3.5 h-3.5" /> {members.length}
                  </span>
                </div>
                <ul className="space-y-1 mb-2">
                  {members.length === 0 && <li className="text-xs text-gray-400">No hunters assigned</li>}
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-gray-800 dark:text-gray-200">{fullName(m)}</span>
                      <button
                        onClick={() => removeMember(d.id, m.id)}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <select
                    className="input h-8 py-0 text-sm flex-1"
                    value={rosterChoice[d.id] ?? ''}
                    onChange={(e) => setRosterChoice((c) => ({ ...c, [d.id]: e.target.value ? Number(e.target.value) : '' }))}
                  >
                    <option value="">Add hunter…</option>
                    {assignable.map((u) => (
                      <option key={u.id} value={u.id}>{fullName(u)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assign(d.id, rosterChoice[d.id] ?? '')}
                    disabled={!rosterChoice[d.id]}
                    className="btn btn-primary h-8 py-0 text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminApprovals;
