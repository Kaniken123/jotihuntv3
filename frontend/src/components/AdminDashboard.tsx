import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/authService';
import { Hunt, User, TeamMessage, Area } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { 
  Users, 
  Camera, 
  MessageSquare, 
  Trophy, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Settings,
  BarChart3,
  MapPin,
  RefreshCw,
  Database
} from 'lucide-react';

interface DashboardStats {
  total_users: number;
  total_teams: number;
  pending_hunts: number;
  total_hunts: number;
  active_areas: number;
  total_messages: number;
}

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingHunts, setPendingHunts] = useState<Hunt[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHunt, setSelectedHunt] = useState<Hunt | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [areaUpdateData, setAreaUpdateData] = useState({ status: '', lat: '', lng: '', reason: '' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'user'
  });
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const { state } = useAuth();

  useEffect(() => {
    if (state.user?.role === 'admin') {
      loadDashboardData();
    }
  }, [state.user]);

  const loadDashboardData = async () => {
    try {
      console.log('Loading dashboard data...');
      const [statsRes, huntsRes, usersRes, areasRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/hunts/pending'),
        api.get('/users'),
        api.get('/jotihunt/areas')
      ]);

      console.log('Dashboard data loaded:', {
        stats: statsRes.data,
        hunts: huntsRes.data.length,
        users: usersRes.data.length,
        areas: areasRes.data.length
      });

      setStats(statsRes.data);
      setPendingHunts(huntsRes.data);
      setUsers(usersRes.data);
      setAreas(areasRes.data);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleHuntReview = async (huntId: number, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/hunts/${huntId}/review`, {
        status,
        rejection_reason: status === 'rejected' ? reviewNote : undefined
      });

      // Reload pending hunts
      const response = await api.get('/hunts/pending');
      setPendingHunts(response.data);
      
      setSelectedHunt(null);
      setReviewNote('');
    } catch (error) {
      console.error('Failed to review hunt:', error);
    }
  };

  const handleAreaStatusUpdate = async (areaId: number, status: string, reason?: string) => {
    try {
      await api.put(`/jotihunt/areas/${areaId}/status`, { status, reason });
      
      // Reload areas
      const response = await api.get('/jotihunt/areas');
      setAreas(response.data);
      
      setSelectedArea(null);
      setAreaUpdateData({ status: '', lat: '', lng: '', reason: '' });
    } catch (error) {
      console.error('Failed to update area status:', error);
    }
  };

  const handleAreaLocationUpdate = async (areaId: number, lat: string, lng: string) => {
    try {
      await api.post(`/jotihunt/areas/${areaId}/location`, { 
        lat: parseFloat(lat), 
        lng: parseFloat(lng),
        source: 'admin_update'
      });
      
      // Reload areas
      const response = await api.get('/jotihunt/areas');
      setAreas(response.data);
      
      setSelectedArea(null);
      setAreaUpdateData({ status: '', lat: '', lng: '', reason: '' });
    } catch (error) {
      console.error('Failed to update area location:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      const createResponse = await api.post('/users', newUserData);
      console.log('User created:', createResponse.data);
      
      // Reload users
      const response = await api.get('/users');
      setUsers(response.data);
      console.log('Users reloaded:', response.data.length, 'users');
      
      setShowUserModal(false);
      setNewUserData({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'user'
      });
    } catch (error: any) {
      console.error('Failed to create user:', error);
      alert(`Failed to create user: ${error.response?.data?.error || error.message}`);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await api.get('/jotihunt/sync/status');
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleSync = async (type?: string) => {
    setSyncing(true);
    try {
      const endpoint = type ? `/jotihunt/sync/${type}` : '/jotihunt/sync';
      const response = await api.post(endpoint);
      console.log('Sync completed:', response.data);
      
      // Reload sync status and dashboard data
      await Promise.all([loadSyncStatus(), loadDashboardData()]);
      
      alert(`${type ? `${type.charAt(0).toUpperCase() + type.slice(1)} sync` : 'Full sync'} completed successfully!`);
    } catch (error: any) {
      console.error('Sync failed:', error);
      alert(`Sync failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (state.user?.role === 'admin' && activeTab === 'api') {
      loadSyncStatus();
    }
  }, [activeTab, state.user]);

  if (state.user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'hunts', label: 'Hunt Review', icon: Camera },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'areas', label: 'Game Areas', icon: MapPin },
    { id: 'api', label: 'API Sync', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.total_users || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Hunts</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.pending_hunts || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Hunts</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.total_hunts || 0}
              </p>
            </div>
            <Camera className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Areas</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.active_areas || 0}
              </p>
            </div>
            <MapPin className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Teams</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.total_teams || 0}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Messages</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats?.total_messages || 0}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Hunts Requiring Review
          </h3>
          <div className="space-y-3">
            {pendingHunts.slice(0, 5).map((hunt) => (
              <div key={hunt.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {hunt.fox_area} Hunt
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(hunt.hunt_time).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('hunts')}
                  className="btn btn-primary btn-sm"
                >
                  Review
                </button>
              </div>
            ))}
            {pendingHunts.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                No pending hunts to review
              </p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Active Users
          </h3>
          <div className="space-y-3">
            {users.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}` 
                      : user.username}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user.role === 'admin' ? 'Administrator' : 'Hunter'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderHuntReview = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Pending Hunt Reviews ({pendingHunts.length})
        </h3>

        {pendingHunts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              All hunts have been reviewed!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingHunts.map((hunt) => (
              <div key={hunt.id} className="card p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {hunt.fox_area} Hunt
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        Pending Review
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Hunter:</strong> {hunt.username || 'Unknown'}</p>
                        <p><strong>Team:</strong> {hunt.team_name || 'Unknown'}</p>
                        <p><strong>Time:</strong> {new Date(hunt.hunt_time).toLocaleString()}</p>
                      </div>
                      <div>
                        <p><strong>Location:</strong> {hunt.hunt_lat.toFixed(6)}, {hunt.hunt_lng.toFixed(6)}</p>
                        <p><strong>Potential Points:</strong> {hunt.points_awarded}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {hunt.photo_url && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hunt Photo:</p>
                    <img 
                      src={hunt.photo_url} 
                      alt="Hunt proof" 
                      className="max-w-md max-h-64 rounded-lg shadow-sm"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleHuntReview(hunt.id, 'approved')}
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      <CheckCircle size={16} />
                      <span>Approve</span>
                    </button>
                    
                    <button
                      onClick={() => setSelectedHunt(hunt)}
                      className="btn btn-danger flex items-center space-x-2"
                    >
                      <XCircle size={16} />
                      <span>Reject</span>
                    </button>
                  </div>
                  
                  <a
                    href={`https://www.google.com/maps?q=${hunt.hunt_lat},${hunt.hunt_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary flex items-center space-x-2"
                  >
                    <MapPin size={16} />
                    <span>View Location</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {selectedHunt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Reject Hunt
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting this hunt:
            </p>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Reason for rejection..."
              className="input mb-4 h-24 resize-none"
              required
            />
            <div className="flex space-x-3">
              <button
                onClick={() => handleHuntReview(selectedHunt.id, 'rejected')}
                disabled={!reviewNote.trim()}
                className="btn btn-danger flex-1"
              >
                Reject Hunt
              </button>
              <button
                onClick={() => {
                  setSelectedHunt(null);
                  setReviewNote('');
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            User Management ({users.length} users) {users.length === 0 && <span className="text-red-500 text-sm">[No users loaded - check console]</span>}
          </h3>
          <button 
            onClick={() => setShowUserModal(true)}
            className="btn btn-primary"
          >
            Add New User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.username}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {user.role === 'admin' ? 'Administrator' : 'Hunter'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {user.team?.name || 'No team'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-3">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Creation Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New User
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newUserData.first_name}
                    onChange={(e) => setNewUserData({ ...newUserData, first_name: e.target.value })}
                    className="input"
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newUserData.last_name}
                    onChange={(e) => setNewUserData({ ...newUserData, last_name: e.target.value })}
                    className="input"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  className="input"
                  placeholder="johndoe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="input"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="input"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Password must be at least 6 characters long
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="input"
                >
                  <option value="user">Hunter</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateUser}
                disabled={!newUserData.username || !newUserData.email || !newUserData.password || newUserData.password.length < 6}
                className="btn btn-primary flex-1"
              >
                Create User
              </button>
              
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setNewUserData({
                    username: '',
                    email: '',
                    password: '',
                    first_name: '',
                    last_name: '',
                    role: 'user'
                  });
                }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAreaManagement = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Fox Team Areas Management
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {areas.map((area) => (
            <div key={area.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {area.name}
                </h4>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  area.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : area.status === 'hunted'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {area.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Fox Team:</strong> {area.fox_team_name || 'Unknown'}</p>
                <p><strong>Points:</strong> {area.points}</p>
                
                {area.lat && area.lng ? (
                  <p><strong>Location:</strong> {area.lat.toFixed(4)}, {area.lng.toFixed(4)}</p>
                ) : (
                  <p className="text-gray-500">No location set</p>
                )}
                
                {area.last_seen && (
                  <p><strong>Last Seen:</strong> {new Date(area.last_seen).toLocaleString()}</p>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedArea(area)}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    Update Status
                  </button>
                  <button
                    onClick={() => {
                      setSelectedArea(area);
                      setAreaUpdateData({ ...areaUpdateData, lat: area.lat?.toString() || '', lng: area.lng?.toString() || '' });
                    }}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    Set Location
                  </button>
                </div>
                
                {area.lat && area.lng && (
                  <a
                    href={`https://www.google.com/maps?q=${area.lat},${area.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm w-full inline-flex items-center justify-center space-x-2"
                  >
                    <MapPin size={14} />
                    <span>View on Map</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Area Update Modal */}
      {selectedArea && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Update {selectedArea.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={areaUpdateData.status}
                  onChange={(e) => setAreaUpdateData({ ...areaUpdateData, status: e.target.value })}
                  className="input"
                >
                  <option value="">Select status...</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="hunted">Hunted</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={areaUpdateData.lat}
                    onChange={(e) => setAreaUpdateData({ ...areaUpdateData, lat: e.target.value })}
                    className="input"
                    placeholder="52.0907"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={areaUpdateData.lng}
                    onChange={(e) => setAreaUpdateData({ ...areaUpdateData, lng: e.target.value })}
                    className="input"
                    placeholder="5.1214"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason/Note (optional)
                </label>
                <textarea
                  value={areaUpdateData.reason}
                  onChange={(e) => setAreaUpdateData({ ...areaUpdateData, reason: e.target.value })}
                  className="input h-20 resize-none"
                  placeholder="Reason for status change..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              {areaUpdateData.status && (
                <button
                  onClick={() => handleAreaStatusUpdate(selectedArea.id, areaUpdateData.status, areaUpdateData.reason)}
                  className="btn btn-primary flex-1"
                >
                  Update Status
                </button>
              )}
              
              {areaUpdateData.lat && areaUpdateData.lng && (
                <button
                  onClick={() => handleAreaLocationUpdate(selectedArea.id, areaUpdateData.lat, areaUpdateData.lng)}
                  className="btn btn-secondary flex-1"
                >
                  Set Location
                </button>
              )}
              
              <button
                onClick={() => {
                  setSelectedArea(null);
                  setAreaUpdateData({ status: '', lat: '', lng: '', reason: '' });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderApiSync = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          External API Integration
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Sync data from the official Jotihunt APIs for live event data including participating teams, fox status, and articles.
        </p>

        {/* Sync Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => handleSync()}
            disabled={syncing}
            className="btn btn-primary flex items-center justify-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Full Sync'}</span>
          </button>
          
          <button
            onClick={() => handleSync('subscriptions')}
            disabled={syncing}
            className="btn btn-secondary flex items-center justify-center space-x-2"
          >
            <Users className="w-4 h-4" />
            <span>Sync Teams</span>
          </button>
          
          <button
            onClick={() => handleSync('areas')}
            disabled={syncing}
            className="btn btn-secondary flex items-center justify-center space-x-2"
          >
            <MapPin className="w-4 h-4" />
            <span>Sync Areas</span>
          </button>
          
          <button
            onClick={() => handleSync('articles')}
            disabled={syncing}
            className="btn btn-secondary flex items-center justify-center space-x-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Sync Articles</span>
          </button>
        </div>

        {/* Auto-Sync Status */}
        {syncStatus?.auto_sync && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${syncStatus.auto_sync.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  Auto-Sync {syncStatus.auto_sync.enabled ? 'Enabled' : 'Disabled'}
                </h4>
                {syncStatus.auto_sync.enabled && (
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Syncing every {syncStatus.auto_sync.interval}
                    {syncStatus.auto_sync.last_auto_sync && (
                      <span> • Last: {new Date(syncStatus.auto_sync.last_auto_sync).toLocaleString()}</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sync Status */}
        {syncStatus && (
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">Manual Sync Status</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {syncStatus.subscriptions && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Subscriptions</h5>
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last sync: {syncStatus.subscriptions.last_sync ? new Date(syncStatus.subscriptions.last_sync).toLocaleString() : 'Never'}
                  </p>
                  {syncStatus.subscriptions.data && (
                    <p className="text-sm text-green-600">
                      Synced: {syncStatus.subscriptions.data.count || 0}, Errors: {syncStatus.subscriptions.data.errors || 0}
                    </p>
                  )}
                </div>
              )}

              {syncStatus.areas && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Areas</h5>
                    <MapPin className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last sync: {syncStatus.areas.last_sync ? new Date(syncStatus.areas.last_sync).toLocaleString() : 'Never'}
                  </p>
                  {syncStatus.areas.data && (
                    <p className="text-sm text-green-600">
                      Synced: {syncStatus.areas.data.count || 0}, Errors: {syncStatus.areas.data.errors || 0}
                    </p>
                  )}
                </div>
              )}

              {syncStatus.articles && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">Articles</h5>
                    <MessageSquare className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last sync: {syncStatus.articles.last_sync ? new Date(syncStatus.articles.last_sync).toLocaleString() : 'Never'}
                  </p>
                  {syncStatus.articles.data && (
                    <p className="text-sm text-green-600">
                      Synced: {syncStatus.articles.data.count || 0}, Errors: {syncStatus.articles.data.errors || 0}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-900 dark:text-blue-100">API Endpoints</h5>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-1 space-y-1">
                <li>• <strong>Subscriptions:</strong> https://jotihunt.nl/api/2.0/subscriptions</li>
                <li>• <strong>Areas:</strong> https://jotihunt.nl/api/2.0/areas</li>
                <li>• <strong>Articles:</strong> https://jotihunt.nl/api/2.0/articles</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'hunts': return renderHuntReview();
      case 'users': return renderUserManagement();
      case 'areas': return renderAreaManagement();
      case 'api': return renderApiSync();
      case 'settings': return <div className="card p-6">Admin settings - Coming soon</div>;
      default: return renderOverview();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage users, review hunts, and monitor game activity
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderContent()}
    </div>
  );
};

export default AdminDashboard;