import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = 'http://100.100.66.165:3000';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

interface SettingRow {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}

export default function AccountDetailsScreen({ navigation }: any) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
    loadAvatar();
    requestPermissions();
  }, []);

  const loadAvatar = async () => {
    try {
      const savedAvatar = await AsyncStorage.getItem('userAvatar');
      if (savedAvatar) {
        setAvatarUri(savedAvatar);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  };

  const saveAvatar = async (uri: string) => {
    try {
      await AsyncStorage.setItem('userAvatar', uri);
      setAvatarUri(uri);
    } catch (error) {
      console.error('Error saving avatar:', error);
      Alert.alert('Error', 'Failed to save avatar');
    }
  };

  const requestPermissions = async () => {
    // Request camera and media library permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      console.log('Permissions not fully granted, but will handle on action');
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Error', 'No authentication token found.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns { user: {...} }, so extract the user object
        setUser(data.user);
      } else {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          handleLogout();
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.error || 'Failed to load profile');
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      // iOS Action Sheet
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          } else if (buttonIndex === 3) {
            removeAvatar();
          }
        }
      );
    } else {
      // Android Alert
      Alert.alert(
        'Change Avatar',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: takePhoto },
          { text: 'Choose from Library', onPress: pickImage },
          { text: 'Remove Photo', onPress: removeAvatar, style: 'destructive' },
        ]
      );
    }
  };

  const removeAvatar = async () => {
    try {
      await AsyncStorage.removeItem('userAvatar');
      setAvatarUri(null);
    } catch (error) {
      console.error('Error removing avatar:', error);
      Alert.alert('Error', 'Failed to remove avatar');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await saveAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await saveAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('authToken');
              await AsyncStorage.removeItem('user');
              // Keep avatar even after logout
              // await AsyncStorage.removeItem('userAvatar');
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (!user) return '?';
    const firstInitial = user.firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = user.lastName?.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || '?';
  };

  const settingRows: SettingRow[] = [
    {
      id: 'account',
      icon: 'person',
      label: 'Account',
      onPress: () => console.log('TODO: Navigate to Account settings'),
    },
    {
      id: 'general',
      icon: 'settings',
      label: 'General',
      onPress: () => console.log('TODO: Navigate to General settings'),
    },
    {
      id: 'calendar',
      icon: 'calendar-today',
      label: 'Calendar',
      onPress: () => console.log('TODO: Navigate to Calendar settings'),
    },
    {
      id: 'theme',
      icon: 'palette',
      label: 'Theme',
      onPress: () => console.log('TODO: Navigate to Theme settings'),
    },
    {
      id: 'notifications',
      icon: 'notifications',
      label: 'Notifications',
      onPress: () => console.log('TODO: Navigate to Notifications settings'),
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4E8FFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#FF4D4D" />
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="camera-alt" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <Text style={styles.memberSince}>
            Member since {new Date(user.createdAt).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </Text>
        </View>

        {/* Settings List */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsList}>
            {settingRows.map((row, index) => (
              <TouchableOpacity
                key={row.id}
                style={[
                  styles.settingRow,
                  index === settingRows.length - 1 && styles.settingRowLast,
                ]}
                onPress={row.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingRowLeft}>
                  <View style={styles.settingIconContainer}>
                    <MaterialIcons name={row.icon} size={22} color="#4E8FFF" />
                  </View>
                  <Text style={styles.settingLabel}>{row.label}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={20} color="#FF4D4D" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4E8FFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerSpacer: {
    width: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E5E5',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4E8FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4E8FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 13,
    color: '#999999',
  },
  settingsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666666',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4D4D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF4D4D',
    marginLeft: 8,
  },
});