import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import { Subscription, Area } from '../types/index';
import { useAuth } from '../contexts/AuthContext';

const SubscriptionManager: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    fox_team_name: '',
    lat: '',
    lng: ''
  });
  const [visitForm, setVisitForm] = useState({
    fox_team_name: '',
    visit_lat: '',
    visit_lng: '',
    notes: ''
  });
  const [isAssigning, setIsAssigning] = useState(false);
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

  const handleAssignFoxTeam = async (subscription: Subscription) => {
    if (!assignmentForm.fox_team_name) {
      alert('Selecteer een vos team');
      return;
    }

    setIsAssigning(true);
    try {
      await gameService.assignSubscriptionToFoxTeam(
        subscription.id,
        assignmentForm.fox_team_name,
        assignmentForm.lat ? parseFloat(assignmentForm.lat) : undefined,
        assignmentForm.lng ? parseFloat(assignmentForm.lng) : undefined
      );

      // Reload data to reflect changes
      await loadData();
      
      // Reset form
      setAssignmentForm({ fox_team_name: '', lat: '', lng: '' });
      setSelectedSubscription(null);
      
      alert('Groep succesvol gekoppeld aan vos team!');
    } catch (error) {
      console.error('Error assigning fox team:', error);
      alert('Fout bij koppelen van groep aan vos team');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRecordVisit = async () => {
    if (!selectedSubscription || !visitForm.fox_team_name || !visitForm.visit_lat || !visitForm.visit_lng) {
      alert('Alle velden zijn verplicht');
      return;
    }

    setIsRecordingVisit(true);
    try {
      await gameService.recordFoxVisit(
        selectedSubscription.id,
        visitForm.fox_team_name,
        parseFloat(visitForm.visit_lat),
        parseFloat(visitForm.visit_lng),
        visitForm.notes
      );

      // Reload data to reflect changes
      await loadData();
      
      // Reset form and close modal
      setVisitForm({ fox_team_name: '', visit_lat: '', visit_lng: '', notes: '' });
      setShowVisitModal(false);
      setSelectedSubscription(null);
      
      alert('Bezoek succesvol geregistreerd!');
    } catch (error) {
      console.error('Error recording visit:', error);
      alert('Fout bij registreren van bezoek');
    } finally {
      setIsRecordingVisit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Laden...</span>
      </div>
    );
  }

  if (!state.user?.is_super_admin && state.user?.roles?.every(role => role.role !== 'tenant_admin')) {
    return (
      <div className="p-4 text-center text-gray-600">
        Alleen admins kunnen groepen beheren.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Groep-Vosteam Beheer</h1>

      <div className="bg-white rounded-lg shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Groepen Overzicht</h2>
          <p className="text-sm text-gray-600">
            Beheer de koppeling tussen groepen en vos teams
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Groep
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gekoppeld aan Vos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Locatie
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bezocht door
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
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
                        Gebied: {subscription.area}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {subscription.fox_team_name ? (
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {subscription.fox_team_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Niet gekoppeld</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {subscription.lat && subscription.lng ? (
                      <div className="text-sm text-gray-900">
                        {subscription.lat.toFixed(6)}, {subscription.lng.toFixed(6)}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Geen locatie</span>
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
                      <span className="text-gray-400 text-sm">Nog niet bezocht</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.is_participating 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {subscription.is_participating ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedSubscription(subscription)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {subscription.fox_team_name ? 'Bewerken' : 'Koppelen'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSubscription(subscription);
                          setShowVisitModal(true);
                        }}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Bezoek +
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedSubscription && !showVisitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedSubscription.fox_team_name ? 'Bewerk Koppeling' : 'Koppel aan Vos Team'}
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Groep:</strong> {selectedSubscription.team_name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vos Team
                </label>
                <select
                  value={assignmentForm.fox_team_name}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, fox_team_name: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecteer vos team...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name} ({area.fox_team_name || 'Unknown Team'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude (optioneel)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={assignmentForm.lat}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, lat: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="52.123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude (optioneel)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={assignmentForm.lng}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, lng: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="6.123456"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => handleAssignFoxTeam(selectedSubscription)}
                disabled={isAssigning}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isAssigning ? 'Bezig...' : 'Opslaan'}
              </button>
              
              <button
                onClick={() => {
                  setSelectedSubscription(null);
                  setAssignmentForm({ fox_team_name: '', lat: '', lng: '' });
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visit Recording Modal */}
      {showVisitModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Registreer Bezoek
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Groep:</strong> {selectedSubscription.team_name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vos Team
                </label>
                <select
                  value={visitForm.fox_team_name}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, fox_team_name: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Selecteer vos team...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bezoek Latitude *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={visitForm.visit_lat}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, visit_lat: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="52.123456"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bezoek Longitude *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={visitForm.visit_lng}
                    onChange={(e) => setVisitForm(prev => ({ ...prev, visit_lng: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="6.123456"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notities (optioneel)
                </label>
                <textarea
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Eventuele notities over het bezoek..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleRecordVisit}
                disabled={isRecordingVisit}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {isRecordingVisit ? 'Bezig...' : 'Registreer Bezoek'}
              </button>
              
              <button
                onClick={() => {
                  setShowVisitModal(false);
                  setSelectedSubscription(null);
                  setVisitForm({ fox_team_name: '', visit_lat: '', visit_lng: '', notes: '' });
                }}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;