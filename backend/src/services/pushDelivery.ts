import { NotificationType } from '@prisma/client';
import { prisma } from '../prisma';
import { logger } from '../utils/logger';
import { getNotificationSettings } from './notifications';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_MAX_BATCH_SIZE = 100;

type PushData = Record<string, string | number | boolean | null>;

type PushContent = {
  title: string;
  body: string;
  data?: PushData;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: PushData;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
  errors?: Array<{ message?: string }>;
};

export type PushDeliverySummary = {
  attempted: number;
  sent: number;
  invalidTokensRemoved: number;
};

let fetchImplementation: typeof fetch | null = null;

async function getFetchImplementation(): Promise<typeof fetch> {
  if (fetchImplementation) {
    return fetchImplementation;
  }

  if (typeof globalThis.fetch === 'function') {
    fetchImplementation = globalThis.fetch.bind(globalThis);
    return fetchImplementation;
  }

  const { fetch: undiciFetch } = await import('undici');
  fetchImplementation = undiciFetch as unknown as typeof fetch;
  return fetchImplementation;
}

const isExpoPushToken = (token: string): boolean => {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const buildPushContentFromNotification = (
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    taskId?: string | null;
    notificationId?: string | null;
  },
): PushContent => ({
  title,
  body: message,
  data: {
    type,
    route: 'notifications',
    sentAt: new Date().toISOString(),
    ...(options?.taskId ? { taskId: options.taskId } : {}),
    ...(options?.notificationId ? { notificationId: options.notificationId } : {}),
  },
});

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const fetchFn = await getFetchImplementation();
  const response = await fetchFn(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  let payload: ExpoPushResponse | null = null;
  try {
    payload = (await response.json()) as ExpoPushResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorDetails = payload?.errors?.map((err) => err.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
    throw new Error(`Expo push request failed: ${errorDetails}`);
  }

  if (!payload?.data || !Array.isArray(payload.data)) {
    throw new Error('Expo push request failed: invalid response payload');
  }

  return payload.data;
}

export async function sendPushToUser(
  userId: string,
  content: PushContent,
): Promise<PushDeliverySummary> {
  const devices = await prisma.pushDevice.findMany({
    where: { userId },
    select: {
      id: true,
      expoPushToken: true,
    },
  });

  if (devices.length === 0) {
    return { attempted: 0, sent: 0, invalidTokensRemoved: 0 };
  }

  const uniqueTokenToDeviceId = new Map<string, string>();
  for (const device of devices) {
    if (!uniqueTokenToDeviceId.has(device.expoPushToken)) {
      uniqueTokenToDeviceId.set(device.expoPushToken, device.id);
    }
  }

  const allTokens = [...uniqueTokenToDeviceId.keys()];
  const invalidTokenSet = new Set<string>();

  for (const token of allTokens) {
    if (!isExpoPushToken(token)) {
      invalidTokenSet.add(token);
    }
  }

  const validTokens = allTokens.filter((token) => !invalidTokenSet.has(token));
  if (validTokens.length === 0) {
    if (invalidTokenSet.size > 0) {
      await prisma.pushDevice.deleteMany({
        where: {
          userId,
          expoPushToken: { in: [...invalidTokenSet] },
        },
      });
    }

    return {
      attempted: 0,
      sent: 0,
      invalidTokensRemoved: invalidTokenSet.size,
    };
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: content.title,
    body: content.body,
    data: content.data,
  }));

  let sent = 0;

  for (const messageBatch of chunk(messages, EXPO_MAX_BATCH_SIZE)) {
    try {
      const tickets = await sendExpoBatch(messageBatch);

      tickets.forEach((ticket, index) => {
        const token = messageBatch[index]?.to;
        if (!token) return;

        if (ticket.status === 'ok') {
          sent += 1;
          return;
        }

        const expoError = ticket.details?.error;
        if (expoError === 'DeviceNotRegistered') {
          invalidTokenSet.add(token);
          return;
        }

        logger.warn(`[Push] Expo push delivery failed for user ${userId}: ${ticket.message || expoError || 'unknown error'}`);
      });
    } catch (error: any) {
      logger.error(`[Push] Expo push batch request failed for user ${userId}: ${error?.message || 'unknown error'}`);
    }
  }

  if (invalidTokenSet.size > 0) {
    await prisma.pushDevice.deleteMany({
      where: {
        userId,
        expoPushToken: { in: [...invalidTokenSet] },
      },
    });
  }

  return {
    attempted: validTokens.length,
    sent,
    invalidTokensRemoved: invalidTokenSet.size,
  };
}

export async function sendPushForNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    taskId?: string | null;
    notificationId?: string | null;
  },
): Promise<PushDeliverySummary> {
  const settings = await getNotificationSettings(userId);
  if (!settings.pushEnabled) {
    return { attempted: 0, sent: 0, invalidTokensRemoved: 0 };
  }

  const categoryEnabled =
    (type === 'MORNING_OVERVIEW' && settings.morningOverview)
    || (type === 'EVENING_REVIEW' && settings.eveningReview)
    || (type === 'TASK_DUE_SOON' && settings.dueSoonNotifications)
    || (type === 'TASK_OVERDUE' && settings.overdueNotifications);

  if (!categoryEnabled) {
    return { attempted: 0, sent: 0, invalidTokensRemoved: 0 };
  }

  return sendPushToUser(userId, buildPushContentFromNotification(type, title, message, options));
}