import {
	GoogleSignin,
	isErrorWithCode,
	isSuccessResponse,
	statusCodes,
} from '@react-native-google-signin/google-signin';

let isConfigured = false;

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

		if (typeof error.message === 'string' && error.message.trim().length > 0) {
			return error.message;
		}
	}

	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return 'Unable to continue with Google. Please try again.';
}
