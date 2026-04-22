import { ApiError } from '../config/api';
import { getAuthExitReason, isAuthExitInProgress } from './authExitState';
import { logger } from '../utils/logger';

type UnauthorizedHandlerParams = {
  error: unknown;
  source: string;
  onSessionExpired?: () => Promise<void> | void;
};

export function isUnauthorizedApiError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export async function handleUnauthorizedIfNeeded({
  error,
  source,
  onSessionExpired,
}: UnauthorizedHandlerParams): Promise<boolean> {
  if (!isUnauthorizedApiError(error)) {
    return false;
  }

  if (isAuthExitInProgress()) {
    logger.info(`[AuthDiag] unauthorized suppressed during auth-exit from ${source} (reason=${getAuthExitReason() ?? 'unknown'})`);
    return true;
  }

  logger.warn(`[AuthDiag] unauthorized detected at ${source}; invoking session-expired handler`);
  await onSessionExpired?.();
  return true;
}
