import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ProviderRequestError } from './taskParser';

type MultipartImplementation = {
  fetchFn: typeof fetch;
  FormDataCtor: typeof FormData;
  FileCtor: typeof File;
};

let multipartImplementation: MultipartImplementation | null = null;

async function getMultipartImplementation(): Promise<MultipartImplementation> {
  if (multipartImplementation) {
    return multipartImplementation;
  }

  if (
    typeof globalThis.fetch === 'function'
    && typeof globalThis.FormData === 'function'
    && typeof globalThis.File === 'function'
  ) {
    multipartImplementation = {
      fetchFn: globalThis.fetch.bind(globalThis),
      FormDataCtor: globalThis.FormData,
      FileCtor: globalThis.File,
    };
    return multipartImplementation;
  }

  const { fetch: undiciFetch, FormData: UndiciFormData, File: UndiciFile } = await import('undici');
  multipartImplementation = {
    fetchFn: undiciFetch as unknown as typeof fetch,
    FormDataCtor: UndiciFormData as unknown as typeof FormData,
    FileCtor: UndiciFile as unknown as typeof File,
  };
  return multipartImplementation;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ProviderRequestError('Audio file is required for transcription');
  }

  const { fetchFn, FormDataCtor, FileCtor } = await getMultipartImplementation();
  const model = env.WHISPER_MODEL;
  const normalizedMimeType = mimeType?.trim().toLowerCase() || 'application/octet-stream';
  const extension = MIME_EXTENSION_MAP[normalizedMimeType] || 'm4a';
  const apiKey = env.OPENAI_API_KEY;
  const fileBytes = new Uint8Array(buffer);

  const formData = new FormDataCtor();
  const file = new FileCtor([fileBytes], `recording.${extension}`, { type: normalizedMimeType });
  formData.append('model', model);
  formData.append('response_format', 'text');
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetchFn('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch {
    throw new ProviderRequestError('Failed to reach AI transcription provider');
  }

  if (!response.ok) {
    // Intentionally omit raw provider response body from the thrown message to
    // avoid surfacing internal API details in error monitoring (e.g. Sentry).
    throw new ProviderRequestError(`AI transcription request failed with status ${response.status}`);
  }

  const transcript = (await response.text()).trim();
  if (!transcript) {
    throw new ProviderRequestError('AI transcription provider returned empty transcript');
  }

  logger.info(`[ai.transcribe] model=${model} mimeType=${normalizedMimeType} bytes=${buffer.length}`);
  return transcript;
}