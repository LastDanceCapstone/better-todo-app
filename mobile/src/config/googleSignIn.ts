import {
	GoogleSignin,
	isErrorWithCode,
	isSuccessResponse,
	statusCodes,
} from '@react-native-google-signin/google-signin';

let isConfigured = false;
const TECHNICAL_GOOGLE_MESSAGE_PATTERN = /(https?:\/\/|www\.|localhost|\b(?:\d{1,3}\.){3}\d{1,3}\b|network request failed|failed to fetch|xmlhttprequest|socket|stack|exception|timeout|typeerror|http\s*\d{3})/i;

const sanitizeGoogleMessage = (message?: string): string | null => {
	if (typeof message !== 'string') {
		return null;
	}

	const trimmed = message.trim();
	if (!trimmed) {
		return null;
	}

	if (TECHNICAL_GOOGLE_MESSAGE_PATTERN.test(trimmed)) {
		return null;
	}

	return trimmed;
};

function ensureGoogleClientIds() {
	// Set these in mobile/.env and EAS env vars for dev/prod builds.
	const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
	const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

	if (!webClientId || !iosClientId) {
		throw new Error(
			'Google Sign-In is not configured. Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.'
		);
	}

	return { webClientId, iosClientId };
}

export function getGoogleSignInConfigurationIssue(): string | null {
	try {
		ensureGoogleClientIds();
		return null;
	} catch (error) {
		if (error instanceof Error && error.message.trim().length > 0) {
			return 'Google Sign-In is currently unavailable. Please try again later.';
		}
		return 'Google Sign-In is not configured.';
	}
}

export function configureGoogleSignIn(): void {
	if (isConfigured) {
		return;
	}

	const { webClientId, iosClientId } = ensureGoogleClientIds();

	// Native Google Sign-In is required on iOS dev builds because redirect-based
	// browser OAuth (expo-auth-session) is unreliable with custom scheme redirects.
	GoogleSignin.configure({
		webClientId,
		iosClientId,
		offlineAccess: false,
		forceCodeForRefreshToken: false,
		scopes: ['openid', 'profile', 'email'],
	});

	isConfigured = true;
}

export async function signInWithGoogle(): Promise<{ idToken: string }> {
	configureGoogleSignIn();

	const response = await GoogleSignin.signIn();

	if (!isSuccessResponse(response)) {
		throw new Error('Google sign-in was cancelled.');
	}

	const idToken = response.data.idToken;

	if (!idToken) {
		throw new Error('Google sign-in succeeded but no idToken was returned.');
	}

	return { idToken };
}

export async function signOutGoogle(): Promise<void> {
	configureGoogleSignIn();

	try {
		await GoogleSignin.signOut();
	} catch {
		// Ignore local Google sign-out failures to avoid blocking app auth flows.
	}
}

export function getGoogleErrorMessage(error: unknown): string {
	if (isErrorWithCode(error)) {
		if (error.code === statusCodes.SIGN_IN_CANCELLED) {
			return 'Google sign-in was cancelled.';
		}

		if (error.code === statusCodes.IN_PROGRESS) {
			return 'Google sign-in is already in progress.';
		}

		if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
			return 'Google services are unavailable on this device right now.';
		}

		const safeMessage = sanitizeGoogleMessage(error.message);
		if (safeMessage) {
			return safeMessage;
		}
	}

	if (error instanceof Error) {
		const safeMessage = sanitizeGoogleMessage(error.message);
		if (safeMessage) {
			return safeMessage;
		}
	}

	return 'Unable to continue with Google. Please try again.';
}
