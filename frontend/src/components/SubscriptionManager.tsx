import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { gameService } from '../services/gameService';
import { Subscription, Area } from '../types/index';
import { useAuth } from '../contexts/AuthContext';

const SubscriptionManager: React.FC = () => {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [visitForm, setVisitForm] = useState({
    fox_team_name: '',
    notes: ''
  });
  const [isRecordingVisit, setIsRecordingVisit] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const { state } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subscriptionsData, areasData] = await Promise.all([
        gameService.getSubscriptions(),
        gameService.getAreas()
      ]);

      setSubscriptions(subscriptionsData || []);
      setAreas(areasData || []);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordVisit = async () => {
    if (!selectedSubscription || !visitForm.fox_team_name) {
      alert(t('subscriptions.foxTeamRequired'));
      return;
    }

    setIsRecordingVisit(true);
    try {
      await gameService.recordFoxVisit(
        selectedSubscription.id,
        visitForm.fox_team_name,
        null,
        null,
        visitForm.notes
      );

      // Reload data to reflect changes
      await loadData();

      // Reset form and close modal
      setVisitForm({ fox_team_name: '', notes: '' });
      setShowVisitModal(false);
      setSelectedSubscription(null);

      alert(t('subscriptions.visitRecorded'));
    } catch (error) {
      console.error('Error recording visit:', error);
      alert(t('subscriptions.visitError'));
    } finally {
      setIsRecordingVisit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">{t('common.loading')}</span>
      </div>
    );
  }

  if (!state.user?.is_super_admin && state.user?.roles?.every(role => role.role !== 'tenant_admin')) {
    return (
      <div className="p-4 text-center text-gray-600">
        {t('subscriptions.adminOnly')}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('subscriptions.title')}</h1>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">{t('subscriptions.overview')}</h2>
          <p className="text-sm text-gray-600">
            {t('subscriptions.overviewDesc')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('subscriptions.colGroup')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('subscriptions.colLocation')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('subscriptions.colVisitedBy')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('subscriptions.colStatus')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('subscriptions.colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {subscription.team_name}
                    </div>
                    {subscription.area && (
                      <div className="text-sm text-gray-500">
                        {t('subscriptions.area')}: {subscription.area}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {subscription.lat && subscription.lng ? (
                      <div className="text-sm text-gray-900">
                        {subscription.lat.toFixed(6)}, {subscription.lng.toFixed(6)}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">{t('subscriptions.noLocation')}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {subscription.visited_by_foxes && subscription.visited_by_foxes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {subscription.visited_by_foxes.map((foxTeam, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                          >
                            {foxTeam}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">{t('subscriptions.notVisited')}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.is_participating 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {subscription.is_participating ? t('fox.active') : t('fox.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => {
                        setSelectedSubscription(subscription);
                        setShowVisitModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      {t('subscriptions.visit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visit Recording Modal */}
      {showVisitModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {t('subscriptions.recordVisit')}
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>{t('subscriptions.colGroup')}:</strong> {selectedSubscription.team_name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('subscriptions.foxTeam')}
                </label>
                <select
                  value={visitForm.fox_team_name}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, fox_team_name: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">{t('subscriptions.selectFoxTeam')}</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('subscriptions.notes')}
                </label>
                <textarea
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder={t('subscriptions.notesPlaceholder')}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleRecordVisit}
                disabled={isRecordingVisit}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isRecordingVisit ? t('subscriptions.recording') : t('subscriptions.recordVisit')}
              </button>

              <button
                onClick={() => {
                  setShowVisitModal(false);
                  setSelectedSubscription(null);
                  setVisitForm({ fox_team_name: '', notes: '' });
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;