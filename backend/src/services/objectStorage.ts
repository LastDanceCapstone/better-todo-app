import crypto from 'crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

const AVATAR_PREFIX = 'avatars';
const PRESIGNED_UPLOAD_TTL_SECONDS = 10 * 60;
const PRESIGNED_READ_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

type StorageConfig = {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let s3Client: S3Client | null = null;

const getStorageConfig = (): StorageConfig => {
  const bucketName = env.S3_BUCKET_NAME?.trim();
  const region = env.AWS_REGION?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage is not configured');
  }

  return {
    bucketName,
    region,
    accessKeyId,
    secretAccessKey,
  };
};

const getS3Client = (): S3Client => {
  if (s3Client) {
    return s3Client;
  }

  const config = getStorageConfig();
  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
};

const getPublicHost = (): string => {
  const { bucketName, region } = getStorageConfig();
  return region === 'us-east-1'
    ? `${bucketName}.s3.amazonaws.com`
    : `${bucketName}.s3.${region}.amazonaws.com`;
};

const sanitizeFileExtension = (fileName: string): string | null => {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{2,8})$/);
  return match ? match[1] : null;
};

const getAvatarFileExtension = (fileName: string, mimeType: string): string => {
  const fromMimeType = MIME_TYPE_TO_EXTENSION[mimeType.toLowerCase()];
  if (fromMimeType) {
    return fromMimeType;
  }

  const fromFileName = sanitizeFileExtension(fileName);
  return fromFileName || 'jpg';
};

export const getAvatarUploadConstraints = () => ({
  maxFileSizeBytes: MAX_AVATAR_FILE_SIZE_BYTES,
  allowedMimeTypes: Object.keys(MIME_TYPE_TO_EXTENSION),
  expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS,
});

export const isAllowedAvatarMimeType = (mimeType: string): boolean => {
  return Boolean(MIME_TYPE_TO_EXTENSION[mimeType.toLowerCase()]);
};

export const buildAvatarObjectKey = (userId: string, fileName: string, mimeType: string): string => {
  const extension = getAvatarFileExtension(fileName, mimeType);
  return `${AVATAR_PREFIX}/${userId}/${crypto.randomUUID()}.${extension}`;
};

export const isManagedAvatarFileKey = (fileKey: string, userId: string): boolean => {
  const normalized = fileKey.trim().replace(/^\/+/, '');
  if (normalized !== fileKey.trim()) {
    return false;
  }

  if (normalized.includes('..')) {
    return false;
  }

  return normalized.startsWith(`${AVATAR_PREFIX}/${userId}/`);
};

export const buildAvatarUrl = (fileKey: string): string => {
  const normalizedPath = fileKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `https://${getPublicHost()}/${normalizedPath}`;
};

export const parseManagedAvatarFileKey = (avatarUrl: string): string | null => {
  try {
    const parsed = new URL(avatarUrl);
    if (parsed.protocol !== 'https:' || parsed.host !== getPublicHost()) {
      return null;
    }

    const fileKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    return fileKey || null;
  } catch {
    return null;
  }
};

export const createAvatarUploadUrl = async (fileKey: string, mimeType: string): Promise<string> => {
  const { bucketName } = getStorageConfig();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS });
};

export const createAvatarReadUrl = async (fileKey: string): Promise<string> => {
  const { bucketName } = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  });
  return getSignedUrl(getS3Client(), command, { expiresIn: PRESIGNED_READ_URL_TTL_SECONDS });
};

/**
 * Given a stored avatarUrl (may be a plain S3 public URL), returns a presigned GET URL
 * valid for 7 days. Falls back to the original URL if the key cannot be parsed or S3
 * is not configured.
 */
export const resolveAvatarDisplayUrl = async (storedUrl: string): Promise<string> => {
  try {
    const fileKey = parseManagedAvatarFileKey(storedUrl);
    if (!fileKey) return storedUrl;
    return await createAvatarReadUrl(fileKey);
  } catch {
    return storedUrl;
  }
};

export const deleteManagedObject = async (fileKey: string): Promise<void> => {
  const { bucketName } = getStorageConfig();
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
  }));
};