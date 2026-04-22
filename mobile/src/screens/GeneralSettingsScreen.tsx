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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';

export type DefaultPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const DEFAULT_PRIORITY_KEY = 'prioritizeDefaultTaskPriority';

const PRIVACY_POLICY_URL = 'https://irradiated-sting-81f.notion.site/Privacy-Policy-Prioritize-33f12199bee38025a25cec1da24c49e0';
const SUPPORT_URL = 'https://irradiated-sting-81f.notion.site/Support-Prioritize-33f12199bee380279286c0da86e9800c';
const CONTACT_EMAIL = 'contact@prioritize-app.com';

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

  const openExternalUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unavailable', 'Could not open this link right now.');
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert('Unavailable', 'Could not open this link right now.');
    }
  };

  const openContactEmail = async () => {
    await openExternalUrl(`mailto:${CONTACT_EMAIL}`);
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber ?? '1'
      : Constants.expoConfig?.android?.versionCode?.toString() ?? '1';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>General</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handlePriorityPress}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
                <MaterialIcons name="flag" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Default Task Priority</Text>
                <Text style={[styles.rowSub, { color: colors.mutedText }]}>
                  Applied when creating a new task
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.primary }]}>
                {PRIORITY_LABELS[defaultPriority]}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.mutedText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
              <MaterialIcons name="info-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedText }]}>Version</Text>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{appVersion}</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.mutedText }]}>
              Build {buildNumber}
            </Text>
          </View>
          {__DEV__ && (
            <View style={styles.infoRow}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
                <MaterialIcons name="verified" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.infoLabel, { color: colors.mutedText }]}>Build Type</Text>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Development</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>SUPPORT & LEGAL</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <TouchableOpacity
            style={[styles.settingRow, styles.separatorRow, { borderBottomColor: colors.border }]}
            onPress={() => void openExternalUrl(PRIVACY_POLICY_URL)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}> 
                <MaterialIcons name="privacy-tip" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
                <Text style={[styles.rowSub, { color: colors.mutedText }]}>View how your data is handled</Text>
              </View>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.mutedText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingRow, styles.separatorRow, { borderBottomColor: colors.border }]}
            onPress={() => void openExternalUrl(SUPPORT_URL)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}> 
                <MaterialIcons name="support-agent" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Support</Text>
                <Text style={[styles.rowSub, { color: colors.mutedText }]}>Help center and troubleshooting</Text>
              </View>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.mutedText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => void openContactEmail()} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}> 
                <MaterialIcons name="alternate-email" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Contact Email</Text>
                <Text style={[styles.rowSub, { color: colors.mutedText }]}>{CONTACT_EMAIL}</Text>
              </View>
            </View>
            <MaterialIcons name="email" size={18} color={colors.mutedText} />
          </TouchableOpacity>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  separatorRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
