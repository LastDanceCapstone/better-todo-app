import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

/**
 * Apple Sign-In Identity Token claims that we verify and extract
 */
export interface AppleIdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  auth_time: number;
  nonce_supported: boolean;
  is_private_email?: boolean;
  real_user_status?: number;
  [key: string]: any;
}

/**
 * Result of successful Apple token verification
 */
export interface AppleAuthVerificationResult {
  userId: string; // sub claim - unique identifier for the user
  email?: string;
  isPrivateEmail?: boolean;
  emailVerified?: boolean;
}

const APPLE_AUTH_ISSUERS = new Set([
  'https://appleid.apple.com',
]);

const APPLE_PUBLIC_KEYS_URL = 'https://appleid.apple.com/auth/keys';

/**
 * Cache for Apple's public signing keys
 * In production, consider using a distributed cache like Redis
 */
let cachedApplePublicKeys: {
  keys: Array<{ kid: string; kty: string; use: string; alg: string; n: string; e: string }>;
  fetchedAt: number;
} | null = null;

const APPLE_KEYS_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Apple's public signing keys
 * These are used to verify the signature of the identity token
 */
async function getApplePublicKeys(): Promise<Array<{ kid: string; kty: string; use: string; alg: string; n: string; e: string }>> {
  const now = Date.now();
  
  // Return cached keys if still valid
  if (cachedApplePublicKeys && now - cachedApplePublicKeys.fetchedAt < APPLE_KEYS_CACHE_DURATION_MS) {
    return cachedApplePublicKeys.keys;
  }

  try {
    const response = await fetch(APPLE_PUBLIC_KEYS_URL);
    
    if (!response.ok) {
      throw new Error(`Apple public keys fetch failed with status ${response.status}`);
    }

    const data = await response.json() as { keys: Array<{ kid: string; kty: string; use: string; alg: string; n: string; e: string }> };
    
    if (!Array.isArray(data.keys) || data.keys.length === 0) {
      throw new Error('Invalid Apple public keys response: empty or missing keys array');
    }

    cachedApplePublicKeys = {
      keys: data.keys,
      fetchedAt: now,
    };

    return data.keys;
  } catch (error) {
    logger.error('Failed to fetch Apple public keys');
    throw error;
  }
}

/**
 * Verify an Apple identity token signature using Apple's public keys
 * Returns the decoded payload if valid, throws if invalid
 */
async function verifyAppleTokenSignature(idToken: string): Promise<AppleIdTokenPayload> {
  try {
    // First, decode the token without verification to get the header and payload
    const decoded = jwt.decode(idToken, { complete: true }) as {
      header: { kid: string; alg: string };
      payload: AppleIdTokenPayload;
    } | null;

    if (!decoded || !decoded.header || !decoded.payload) {
      throw new Error('Invalid token format');
    }

    const { kid, alg } = decoded.header;
    const payload = decoded.payload;

    if (alg !== 'RS256') {
      throw new Error('Invalid token signing algorithm');
    }

    // Fetch Apple's public keys
    const publicKeys = await getApplePublicKeys();

    // Find the key used to sign this token
    const signingKey = publicKeys.find((key) => key.kid === kid);
    if (!signingKey) {
      throw new Error(`No matching key found for kid: ${kid}`);
    }

    if (signingKey.kty !== 'RSA' || signingKey.use !== 'sig') {
      throw new Error('Invalid key type or usage');
    }

    // Reconstruct the public key from JWK format
    const publicKeyPEM = reconstructPublicKeyFromJWK(signingKey);

    // Verify the token signature and claims
    jwt.verify(idToken, publicKeyPEM, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      clockTimestamp: Math.floor(Date.now() / 1000),
    });

    return payload;
  } catch (error) {
    logger.error('Apple token signature verification failed');
    throw error;
  }
}

/**
 * Reconstruct an RSA public key from JWK (JSON Web Key) format
 */
function reconstructPublicKeyFromJWK(key: { n: string; e: string }): string {
  // Build the ASN.1 DER structure for RSA public key
  const rsaPublicKey = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });

  return rsaPublicKey.export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Verify an Apple identity token and extract user information
 *
 * @param idToken - The identity token from Apple Sign-In
 * @param expectedAudience - The expected audience (app bundle ID) for verification
 * @returns Extracted user information if valid
 * @throws Error if token is invalid, expired, or verification fails
 */
export async function verifyAppleIdToken(
  idToken: string,
  expectedAudience: string
): Promise<AppleAuthVerificationResult> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid or missing identity token');
  }

  if (!expectedAudience || typeof expectedAudience !== 'string') {
    throw new Error('Missing expected audience');
  }

  try {
    const payload = await verifyAppleTokenSignature(idToken);

    // Validate required claims
    if (!payload.sub) {
      throw new Error('Token missing required claim: sub');
    }

    if (!payload.iss) {
      throw new Error('Token missing required claim: iss');
    }

    // Verify issuer
    if (!APPLE_AUTH_ISSUERS.has(payload.iss)) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }

    // Verify audience
    if (payload.aud !== expectedAudience) {
      throw new Error(`Audience mismatch: expected ${expectedAudience}, got ${payload.aud}`);
    }

    // Verify token has not expired
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowEpoch) {
      throw new Error('Token has expired');
    }

    // Verify iat (issued at) is in the past
    if (!payload.iat || payload.iat > nowEpoch) {
      throw new Error('Token issued in the future or missing iat claim');
    }

    // Extract and validate email
    let email: string | undefined;
    if (payload.email) {
      email = String(payload.email).toLowerCase().trim();
      if (!email) {
        email = undefined;
      }
    }

    // Check if this is a private email relay
    const isPrivateEmail = payload.is_private_email === true;

    // Email verification: Apple always provides verified emails for Sign in with Apple
    const emailVerified = payload.email_verified !== false; // Default true if not explicitly false

    return {
      userId: payload.sub,
      email,
      isPrivateEmail,
      emailVerified,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.error('JWT verification failed');
      throw new Error('Invalid or expired Apple identity token');
    }
    
    logger.error('Apple token verification failed');
    throw error;
  }
}
