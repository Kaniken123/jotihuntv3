import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { gameService } from '../services/gameService';
import { locationService } from '../services/locationService';
import { Area, Hunt } from '../types';

const HuntScreen: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recentHunts, setRecentHunts] = useState<Hunt[]>([]);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
    getCurrentLocation();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [areasData, huntsData] = await Promise.all([
        gameService.getAreas(),
        gameService.getMyHunts(),
      ]);
      setAreas(areasData);
      setRecentHunts(huntsData.slice(0, 5));
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load hunt data');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      setCurrentLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take hunt photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to select hunt photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedArea) {
      Alert.alert('Error', 'Please select a fox area');
      return;
    }

    if (!photo) {
      Alert.alert('Error', 'Please take or select a photo');
      return;
    }

    setIsSubmitting(true);
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('fox_area', selectedArea);
      formData.append('hunt_lat', (currentLocation?.lat || 0).toString());
      formData.append('hunt_lng', (currentLocation?.lng || 0).toString());

      // Add photo to form data
      const photoUri = photo.uri;
      const photoName = photoUri.split('/').pop() || 'photo.jpg';
      const photoType = 'image/jpeg';

      formData.append('photo', {
        uri: photoUri,
        name: photoName,
        type: photoType,
      } as any);

      await gameService.submitHunt(formData);

      setSuccess('Hunt submitted successfully! It will be reviewed by administrators.');
      setSelectedArea('');
      setPhoto(null);

      // Reload hunts
      const huntsData = await gameService.getMyHunts();
      setRecentHunts(huntsData.slice(0, 5));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to submit hunt';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'rejected':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="camera" size={32} color="#1E40AF" />
        <Text style={styles.headerTitle}>Submit Fox Hunt</Text>
      </View>

      {/* Success Message */}
      {success ? (
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {/* Fox Area Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fox Area</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedArea}
            onValueChange={(value) => setSelectedArea(value)}
            style={styles.picker}
          >
            <Picker.Item label="Select a fox area..." value="" />
            {areas.map((area) => (
              <Picker.Item
                key={area.id}
                label={`🦊 ${area.name}${area.fox_team_name ? ` - ${area.fox_team_name}` : ''}`}
                value={area.name}
              />
            ))}
          </Picker>
        </View>
        {areas.length === 0 && (
          <Text style={styles.warningText}>⚠️ No fox areas found. Contact admin to set up fox teams.</Text>
        )}
      </View>

      {/* Photo Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hunt Photo</Text>
        
        {photo ? (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => setPhoto(null)}
            >
              <Ionicons name="close-circle" size={32} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera" size={32} color="#1E40AF" />
              <Text style={styles.photoButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <Ionicons name="images" size={32} color="#1E40AF" />
              <Text style={styles.photoButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Location Status */}
      <View style={styles.section}>
        <View style={styles.locationStatus}>
          <Ionicons
            name={currentLocation ? 'location' : 'location-outline'}
            size={20}
            color={currentLocation ? '#10B981' : '#F59E0B'}
          />
          <Text style={[styles.locationText, { color: currentLocation ? '#10B981' : '#F59E0B' }]}>
            {currentLocation
              ? `Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
              : 'Location not available (optional)'}
          </Text>
        </View>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshLocationButton}>
          <Ionicons name="refresh" size={16} color="#1E40AF" />
          <Text style={styles.refreshLocationText}>Refresh Location</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Submit Hunt</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Recent Hunts */}
      {recentHunts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Hunts</Text>
          {recentHunts.map((hunt) => (
            <View key={hunt.id} style={styles.huntItem}>
              <View style={styles.huntInfo}>
                <Ionicons
                  name={getStatusIcon(hunt.status) as any}
                  size={24}
                  color={getStatusColor(hunt.status)}
                />
                <View style={styles.huntDetails}>
                  <Text style={styles.huntArea}>{hunt.fox_area}</Text>
                  <Text style={styles.huntTime}>
                    {new Date(hunt.hunt_time).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.huntStatus}>
                <Text style={[styles.huntStatusText, { color: getStatusColor(hunt.status) }]}>
                  {hunt.status.charAt(0).toUpperCase() + hunt.status.slice(1)}
                </Text>
                {hunt.status === 'approved' && (
                  <Text style={styles.huntPoints}>+{hunt.points_awarded} pts</Text>
                )}
                {hunt.status === 'rejected' && hunt.rejection_reason && (
                  <Text style={styles.rejectionReason}>{hunt.rejection_reason}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#10B981',
    marginLeft: 12,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 12,
    marginTop: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    marginTop: 8,
    color: '#1E40AF',
    fontSize: 14,
    fontWeight: '500',
  },
  photoPreviewContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
  },
  refreshLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  refreshLocationText: {
    marginLeft: 4,
    color: '#1E40AF',
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  huntItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  huntInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  huntDetails: {
    marginLeft: 12,
  },
  huntArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  huntTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  huntStatus: {
    alignItems: 'flex-end',
  },
  huntStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  huntPoints: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  rejectionReason: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
    maxWidth: 120,
  },
});

export default HuntScreen;
