import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushDevice, unregisterPushDevice } from '../config/api';
import { logger } from '../utils/logger';

const PUSH_INSTALLATION_ID_KEY = 'prioritizePushInstallationId';
export const FOCUS_SUPPRESS_NOTIFICATIONS_KEY = 'prioritizeFocusSuppressNotifications';
export const FOCUS_SESSION_ACTIVE_KEY = 'prioritizeFocusSessionActive';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

let notificationHandlerConfigured = false;

const isGrantedStatus = (settings?: Notifications.NotificationPermissionsStatus | null): boolean => {
	if (!settings) {
		return false;
	}

	if (settings.granted) {
		return true;
	}

	if (Platform.OS === 'ios') {
		const iosStatus = settings.ios?.status;
		return iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
			|| iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
			|| iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
	}

	return settings.status === Notifications.PermissionStatus.GRANTED;
};

const toPermissionState = (settings?: Notifications.NotificationPermissionsStatus | null): NotificationPermissionState => {
	if (!settings) {
		return 'undetermined';
	}

	if (isGrantedStatus(settings)) {
		return 'granted';
	}

	if (settings.status === Notifications.PermissionStatus.DENIED) {
		return 'denied';
	}

	return 'undetermined';
};

const readInstallationId = async (): Promise<string | null> => {
	return AsyncStorage.getItem(PUSH_INSTALLATION_ID_KEY);
};

const getOrCreateInstallationId = async (): Promise<string> => {
	const existing = await readInstallationId();
	if (existing) {
		return existing;
	}

	const nextId = Crypto.randomUUID();
	await AsyncStorage.setItem(PUSH_INSTALLATION_ID_KEY, nextId);
	return nextId;
};

const getExpoProjectId = (): string | null => {
	const easProjectId = (Constants.easConfig as any)?.projectId;
	const legacyProjectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
	return typeof easProjectId === 'string'
		? easProjectId
		: typeof legacyProjectId === 'string'
			? legacyProjectId
			: null;
};

const getLocalTimeZone = (): string | undefined => {
	try {
		const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
	} catch {
		return undefined;
	}
};

export const configureNotificationPresentation = (): void => {
	if (notificationHandlerConfigured) {
		return;
	}

	Notifications.setNotificationHandler({
		handleNotification: async () => {
			const [suppressionEnabled, focusSessionActive] = await Promise.all([
				AsyncStorage.getItem(FOCUS_SUPPRESS_NOTIFICATIONS_KEY),
				AsyncStorage.getItem(FOCUS_SESSION_ACTIVE_KEY),
			]);

			const shouldSuppress = suppressionEnabled === 'true' && focusSessionActive === 'true';

			return {
				shouldShowBanner: !shouldSuppress,
				shouldShowList: !shouldSuppress,
				shouldPlaySound: !shouldSuppress,
				shouldSetBadge: false,
			};
		},
	});

	notificationHandlerConfigured = true;
};

export const syncPushNotificationRegistration = async (
	options: { allowPrompt: boolean },
): Promise<{ permissionStatus: NotificationPermissionState; isRegistered: boolean; expoPushToken: string | null }> => {
	const permissions = options.allowPrompt
		? await Notifications.requestPermissionsAsync({
			ios: {
				allowAlert: true,
				allowBadge: true,
				allowSound: true,
			},
		})
		: await Notifications.getPermissionsAsync();

	const permissionStatus = toPermissionState(permissions);
	const existingInstallationId = await readInstallationId();

	if (permissionStatus !== 'granted') {
		if (existingInstallationId) {
			try {
				await unregisterPushDevice(existingInstallationId);
			} catch (error) {
				logger.warn('Failed to unregister push device after permission change');
			}
		}

		return {
			permissionStatus,
			isRegistered: false,
			expoPushToken: null,
		};
	}

	const projectId = getExpoProjectId();
	if (!projectId) {
		throw new Error('Missing Expo project ID for push notifications.');
	}

	const installationId = await getOrCreateInstallationId();
	const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

	await registerPushDevice({
		installationId,
		expoPushToken: tokenResponse.data,
		platform: Platform.OS === 'android' ? 'android' : 'ios',
		deviceName: Application.applicationName || undefined,
		appVersion: Application.nativeApplicationVersion || undefined,
		timezone: getLocalTimeZone(),
	});

	return {
		permissionStatus,
		isRegistered: true,
		expoPushToken: tokenResponse.data,
	};
};

export const disconnectCurrentPushInstallation = async (): Promise<void> => {
	const installationId = await readInstallationId();
	if (!installationId) {
		return;
	}

	try {
		await unregisterPushDevice(installationId);
	} catch (error) {
		logger.warn('Failed to unregister current push installation during logout');
	}
};

export const getFocusNotificationSuppressionEnabled = async (): Promise<boolean> => {
	return (await AsyncStorage.getItem(FOCUS_SUPPRESS_NOTIFICATIONS_KEY)) === 'true';
};

export const setFocusNotificationSuppressionEnabled = async (enabled: boolean): Promise<void> => {
	await AsyncStorage.setItem(FOCUS_SUPPRESS_NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
};

export const setFocusSessionActive = async (active: boolean): Promise<void> => {
	await AsyncStorage.setItem(FOCUS_SESSION_ACTIVE_KEY, active ? 'true' : 'false');
};