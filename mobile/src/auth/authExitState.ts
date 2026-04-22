export type AuthExitReason =
  | 'manual-email-logout'
  | 'manual-google-logout'
  | 'manual-apple-logout'
  | 'reauth-required'
  | 'session-expired'
  | 'invalid-token'
  | 'unauthorized-response'
  | 'auth-bootstrap-failure';

let currentAuthExitReason: AuthExitReason | null = null;

export function beginAuthExit(reason: AuthExitReason): boolean {
  if (currentAuthExitReason) {
    return false;
  }

  currentAuthExitReason = reason;
  return true;
}

export function clearAuthExitState(): void {
  currentAuthExitReason = null;
}

export function isAuthExitInProgress(): boolean {
  return currentAuthExitReason !== null;
}

export function getAuthExitReason(): AuthExitReason | null {
  return currentAuthExitReason;
}