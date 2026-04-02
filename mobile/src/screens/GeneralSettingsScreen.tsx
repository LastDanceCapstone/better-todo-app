import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';

export type DefaultPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const DEFAULT_PRIORITY_KEY = 'prioritizeDefaultTaskPriority';

const PRIORITY_LABELS: Record<DefaultPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export default function GeneralSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [defaultPriority, setDefaultPriority] = useState<DefaultPriority>('MEDIUM');

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [])
  );

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(DEFAULT_PRIORITY_KEY);
      if (stored && stored in PRIORITY_LABELS) {
        setDefaultPriority(stored as DefaultPriority);
      }
    } catch {
      // Use default
    }
  };

  const handlePriorityPress = () => {
    const options = ['Low', 'Medium', 'High', 'Urgent'];
    const values: DefaultPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options, 'Cancel'],
          cancelButtonIndex: options.length,
        },
        async (index) => {
          if (index < values.length) {
            await savePriority(values[index]);
          }
        }
      );
    } else {
      Alert.alert(
        'Default Priority',
        'Choose the default priority for new tasks',
        [
          ...values.map((val) => ({
            text: PRIORITY_LABELS[val],
            onPress: () => savePriority(val),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  };

  const savePriority = async (priority: DefaultPriority) => {
    try {
      await AsyncStorage.setItem(DEFAULT_PRIORITY_KEY, priority);
      setDefaultPriority(priority);
    } catch {
      Alert.alert('Error', 'Could not save preference.');
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber ?? '1'
      : Constants.expoConfig?.android?.versionCode?.toString() ?? '1';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>General</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Preferences */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>PREFERENCES</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handlePriorityPress}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                <MaterialIcons name="flag" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Default Task Priority</Text>
                <Text style={[styles.rowSub, { color: colors.mutedText }]}>
                  Applied when creating a new task
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.mutedText }]}>
                {PRIORITY_LABELS[defaultPriority]}
              </Text>
              <MaterialIcons name="chevron-right" size={22} color={colors.mutedText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>ABOUT</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.mutedText }]}>
              {appVersion} ({buildNumber})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="verified" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Build</Text>
            <Text style={[styles.infoValue, { color: colors.mutedText }]}>
              {__DEV__ ? 'Development' : 'Production'}
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scroll: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 'auto',
  },
});
