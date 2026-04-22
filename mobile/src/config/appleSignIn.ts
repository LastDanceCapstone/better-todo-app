import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

/**
 * Thrown when the user explicitly cancels the Apple Sign-In sheet.
 * Callers can check instanceof to suppress error alerts.
 */
export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in was cancelled');
    this.name = 'AppleSignInCancelledError';
  }
}

/**
 * Result of successful Apple Sign-In
 */
export interface AppleSignInResult {
  idToken: string;
  user?: {
    name?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
    email?: string | null;
  };
}

/**
 * Check if the device supports Apple Sign-In
 * Apple Sign-In is only available on iOS 13+
 */
export async function isAppleAuthenticationAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Get a user-friendly error message from Apple Sign-In errors.
 * Note: AppleSignInCancelledError should be handled by the caller before
 * calling this function — cancellation should not show an error alert.
 */
export function getAppleErrorMessage(error: unknown): string {
  if (error instanceof AppleSignInCancelledError) {
    // Caller should silently dismiss, but provide a safe message just in case
    return 'Apple sign-in was cancelled.';
  }

  if (error instanceof Error) {
    const safeMessage = error.message.trim();
    if (
      safeMessage &&
      !safeMessage.includes('http') &&
      !safeMessage.includes('stack') &&
      !safeMessage.includes('localhost')
    ) {
      return safeMessage;
    }
  }

  return 'Unable to continue with Apple Sign-In. Please try again.';
}

/**
 * Perform Apple Sign-In
 * This will prompt the user to authenticate with their Apple ID
 * Returns the identity token needed for backend verification
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    // Check if Apple Authentication is available
    const isAvailable = await isAppleAuthenticationAvailable();
    if (!isAvailable) {
      throw new Error('Apple Sign-In is not available on this device');
    }

    // Request credentials from Apple
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple Sign-In succeeded but no identity token was returned');
    }

    return {
      idToken: credential.identityToken,
      user: {
        name: credential.fullName
          ? {
              firstName: credential.fullName.givenName ?? undefined,
              lastName: credential.fullName.familyName ?? undefined,
            }
          : undefined,
        email: credential.email ?? undefined,
      },
    };
  } catch (error) {
    if (error && typeof error === 'object') {
      const code = (error as { code?: string }).code;
      switch (code) {
        case 'ERR_REQUEST_CANCELED':
          throw new AppleSignInCancelledError();
        case 'ERR_REQUEST_FAILED':
          throw new Error('Unable to connect to Apple. Please check your internet connection and try again.');
        case 'ERR_REQUEST_NOT_HANDLED':
        case 'ERR_REQUEST_NOT_INTERACTIVE':
          throw new Error('Apple Sign-In is not available right now. Please try again.');
        case 'ERR_REQUEST_UNKNOWN_ERROR':
          throw new Error('An unexpected error occurred during Apple Sign-In. Please try again.');
        default:
          break;
      }
    }

    // Re-throw if it's already our error type
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Apple Sign-In failed. Please try again.');
  }
}

/**
 * Sign out of Apple (if possible)
 * Note: Apple doesn't provide a sign-out method, so this is a no-op
 * The app should clear its local session on sign-out
 */
export async function signOutApple(): Promise<void> {
  // Apple doesn't provide a sign-out API
  // Sign-out is handled by clearing the app's session token
  return Promise.resolve();
}
