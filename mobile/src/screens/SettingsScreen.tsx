import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useAuth } from '../contexts/AuthContext';
import { gameService } from '../services/gameService';
import { locationService } from '../services/locationService';
import { LocationSettings } from '../types';

const SettingsScreen: React.FC = () => {
  const { state: authState, logout } = useAuth();
  const [settings, setSettings] = useState<LocationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    checkTrackingStatus();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await gameService.getLocationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkTrackingStatus = async () => {
    const isRunning = await locationService.isBackgroundTrackingRunning();
    setIsTrackingEnabled(isRunning);
  };

  const updateSettings = async (updates: Partial<LocationSettings>) => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const updatedSettings = await gameService.updateLocationSettings({
        ...settings,
        ...updates,
      });
      setSettings(updatedSettings);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLocationSharing = async (enabled: boolean) => {
    await updateSettings({ location_sharing_enabled: enabled });

    if (!enabled && isTrackingEnabled) {
      await locationService.stopBackgroundTracking();
      setIsTrackingEnabled(false);
    }
  };

  const togglePrivacyMode = async (enabled: boolean) => {
    await updateSettings({ privacy_mode: enabled });
  };

  const toggleBackgroundTracking = async () => {
    if (isTrackingEnabled) {
      await locationService.stopBackgroundTracking();
      setIsTrackingEnabled(false);
      Alert.alert('Tracking Stopped', 'Background location tracking has been disabled.');
    } else {
      if (!settings?.location_sharing_enabled) {
        Alert.alert(
          'Enable Location Sharing',
          'Please enable location sharing first to use background tracking.'
        );
        return;
      }

      const success = await locationService.startBackgroundTracking({
        timeInterval: (settings?.tracking_interval || 60) * 1000,
      });

      if (success) {
        setIsTrackingEnabled(true);
        Alert.alert('Tracking Started', 'Your location is now being tracked in the background.');
      } else {
        Alert.alert(
          'Permission Required',
          'Please grant background location permission to enable tracking.'
        );
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // Stop tracking before logout
            if (isTrackingEnabled) {
              await locationService.stopBackgroundTracking();
            }
            await logout();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* User Info */}
      <View style={styles.section}>
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {authState.user?.first_name?.[0] || authState.user?.username?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {authState.user?.first_name
                ? `${authState.user.first_name} ${authState.user.last_name || ''}`
                : authState.user?.username}
            </Text>
            <Text style={styles.userEmail}>{authState.user?.email}</Text>
            {authState.team && (
              <View style={styles.teamBadge}>
                <Ionicons name="people" size={12} color="#1E40AF" />
                <Text style={styles.teamName}>{authState.team.name}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Location Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="location" size={24} color="#1E40AF" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Location Sharing</Text>
              <Text style={styles.settingDescription}>
                Allow others to see your location on the map
              </Text>
            </View>
          </View>
          <Switch
            value={settings?.location_sharing_enabled ?? true}
            onValueChange={toggleLocationSharing}
            trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
            thumbColor={settings?.location_sharing_enabled ? '#1E40AF' : '#9CA3AF'}
            disabled={isSaving}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="eye-off" size={24} color="#1E40AF" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Privacy Mode</Text>
              <Text style={styles.settingDescription}>
                Hide your location from other hunters
              </Text>
            </View>
          </View>
          <Switch
            value={settings?.privacy_mode ?? false}
            onValueChange={togglePrivacyMode}
            trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
            thumbColor={settings?.privacy_mode ? '#1E40AF' : '#9CA3AF'}
            disabled={isSaving}
          />
        </View>

        <View style={styles.sliderItem}>
          <View style={styles.sliderHeader}>
            <Ionicons name="timer" size={24} color="#1E40AF" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Tracking Interval</Text>
              <Text style={styles.settingDescription}>
                How often to update your location
              </Text>
            </View>
          </View>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={30}
              maximumValue={300}
              step={30}
              value={settings?.tracking_interval ?? 60}
              onSlidingComplete={(value) => updateSettings({ tracking_interval: value })}
              minimumTrackTintColor="#1E40AF"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#1E40AF"
              disabled={isSaving}
            />
            <Text style={styles.sliderValue}>
              {settings?.tracking_interval ?? 60} seconds
            </Text>
          </View>
        </View>
      </View>

      {/* Background Tracking */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Tracking</Text>

        <TouchableOpacity
          style={[
            styles.trackingButton,
            isTrackingEnabled && styles.trackingButtonActive,
          ]}
          onPress={toggleBackgroundTracking}
        >
          <Ionicons
            name={isTrackingEnabled ? 'radio' : 'radio-outline'}
            size={24}
            color={isTrackingEnabled ? '#FFFFFF' : '#1E40AF'}
          />
          <View style={styles.trackingInfo}>
            <Text
              style={[
                styles.trackingLabel,
                isTrackingEnabled && styles.trackingLabelActive,
              ]}
            >
              {isTrackingEnabled ? 'Tracking Active' : 'Start Tracking'}
            </Text>
            <Text
              style={[
                styles.trackingDescription,
                isTrackingEnabled && styles.trackingDescriptionActive,
              ]}
            >
              {isTrackingEnabled
                ? 'Your location is being tracked in the background'
                : 'Enable background location tracking'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.trackingNote}>
          Background tracking will continue even when the app is closed. This is required for
          accurate route tracking during the hunt.
        </Text>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>Jotihunt Mobile</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    gap: 4,
  },
  teamName: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  sliderItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderContainer: {
    paddingHorizontal: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#1E40AF',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E40AF',
  },
  trackingButtonActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  trackingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  trackingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
  trackingLabelActive: {
    color: '#FFFFFF',
  },
  trackingDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  trackingDescriptionActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  trackingNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 12,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  appVersion: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

export default SettingsScreen;
