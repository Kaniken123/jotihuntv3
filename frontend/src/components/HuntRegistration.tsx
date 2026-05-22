import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/authService';
import { Area, Hunt } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { Camera, MapPin, Clock, Trophy } from 'lucide-react';

const HuntRegistration: React.FC = () => {
  const { t } = useTranslation();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Cooldowns removed to allow always submitting hunts
  const [recentHunts, setRecentHunts] = useState<Hunt[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auth state no longer needed for team requirement

  useEffect(() => {
    loadAreas();
    loadRecentHunts();
    getCurrentLocation();
  }, []);

  const loadAreas = async () => {
    try {
      const response = await api.get('/jotihunt/areas');
      // Show all areas - let users hunt any fox team regardless of status
      setAreas(response.data);
      console.log('Loaded areas:', response.data); // Debug log
      console.log('Area count:', response.data.length);
    } catch (error) {
      console.error('Failed to load areas:', error);
    }
  };

  // Cooldown loading removed

  const loadRecentHunts = async () => {
    try {
      const response = await api.get('/hunts/my-hunts');
      setRecentHunts(response.data.slice(0, 5)); // Last 5 hunts
    } catch (error) {
      console.error('Failed to load recent hunts:', error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setError(t('hunt.locationError'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      setError(t('hunt.geoUnsupported'));
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError(t('hunt.photoTooLarge'));
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError(t('hunt.selectImage'));
        return;
      }

      setPhoto(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Cooldown functions removed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedArea || !photo) {
      setError(t('hunt.selectAreaPhoto'));
      return;
    }

    // Allow submissions without cooldown restrictions

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('fox_area', selectedArea);
      // Use current location if available, otherwise use default coordinates
      const lat = currentLocation?.lat || 0;
      const lng = currentLocation?.lng || 0;
      formData.append('hunt_lat', lat.toString());
      formData.append('hunt_lng', lng.toString());
      formData.append('photo', photo);

      await api.post('/hunts/submit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(t('hunt.submitSuccess'));
      setSelectedArea('');
      setPhoto(null);
      setPhotoPreview(null);
      
      // Reload data
      loadRecentHunts();
    } catch (error: any) {
      setError(error.response?.data?.error || t('hunt.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 dark:text-green-400';
      case 'rejected': return 'text-red-600 dark:text-red-400';
      case 'pending': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <Trophy className="w-4 h-4" />;
      case 'rejected': return <span className="w-4 h-4 text-center">✗</span>;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  // Allow all authenticated users to submit hunts

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Hunt Submission Form */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('hunt.title')}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-lg">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fox Area Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('hunt.foxArea')}
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="input"
              required
            >
              <option value="">{t('hunt.selectFoxArea')}</option>
              {areas.length === 0 ? (
                <option value="" disabled>{t('hunt.loadingAreas')}</option>
              ) : (
                areas.map((area) => (
                  <option
                    key={area.id}
                    value={area.name}
                  >
                    🦊 {area.name} {area.fox_team_name ? `- ${area.fox_team_name}` : ''}
                    {area.status === 'hunted' ? t('hunt.optHunted') : area.status === 'active' ? t('hunt.optActive') : t('hunt.optReady')}
                    {area.last_seen ? ` - ${t('hunt.lastSeen')}: ${new Date(area.last_seen).toLocaleDateString()}` : ''}
                  </option>
                ))
              )}
            </select>
            {areas.length === 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                {t('hunt.noAreas')}
              </p>
            )}
            {areas.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('hunt.areasFound', { count: areas.length })}
              </p>
            )}
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('hunt.huntPhoto')}
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="input"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('hunt.photoHelp')}
              </p>
            </div>
            
            {photoPreview && (
              <div className="mt-2">
                <img
                  src={photoPreview}
                  alt="Hunt preview"
                  className="max-w-xs rounded-lg shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Location Status */}
          <div className="flex items-center space-x-2 text-sm">
            <MapPin size={16} className="text-gray-500" />
            {currentLocation ? (
              <span className="text-green-600 dark:text-green-400">
                {t('hunt.locationAcquired', { coords: `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` })}
              </span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">
                {t('hunt.locationOptional')}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn btn-primary flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>{t('hunt.submitting')}</span>
              </>
            ) : (
              <>
                <Camera size={16} />
                <span>{t('hunt.submit')}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Cooldowns removed - users can always submit hunts */}

      {/* Recent Hunts */}
      {recentHunts.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('hunt.recentHunts')}
          </h3>
          <div className="space-y-3">
            {recentHunts.map((hunt) => (
              <div key={hunt.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-1 ${getStatusColor(hunt.status)}`}>
                    {getStatusIcon(hunt.status)}
                  </div>
                  <div>
                    <p className="font-medium">{hunt.fox_area}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(hunt.hunt_time).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${getStatusColor(hunt.status)}`}>
                    {t(`hunt.status.${hunt.status}`, hunt.status)}
                  </p>
                  {hunt.status === 'approved' && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('hunt.pointsAwarded', { n: hunt.points_awarded })}
                    </p>
                  )}
                  {hunt.status === 'rejected' && hunt.rejection_reason && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {hunt.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HuntRegistration;