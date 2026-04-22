require('dotenv/config');

const appJson = require('./app.json');

const requiredPublicVars = ['EXPO_PUBLIC_API_URL'];
const requiredGoogleVars = ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'];

const normalizeUrl = (value) => value.replace(/\/+$/, '');

const getHostname = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isLocalOrLanHost = (hostname) => {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
};

for (const key of requiredPublicVars) {
  if (!process.env[key] || process.env[key].trim().length === 0) {
    throw new Error(`Missing ${key}. Set it in mobile/.env for local runs and EAS environment variables for builds.`);
  }
}

const buildProfile = process.env.EAS_BUILD_PROFILE?.trim() || 'development';
const explicitAppEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim();
const appEnv = explicitAppEnv || (buildProfile === 'production' ? 'production' : buildProfile === 'preview' ? 'staging' : 'development');

const apiUrl = normalizeUrl(process.env.EXPO_PUBLIC_API_URL.trim());
const apiHost = getHostname(apiUrl);
const isReleaseProfile = buildProfile === 'preview' || buildProfile === 'production';

try {
  new URL(apiUrl);
} catch {
  throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL.');
}

if (isReleaseProfile) {
  for (const key of requiredGoogleVars) {
    if (!process.env[key] || process.env[key].trim().length === 0) {
      throw new Error(`Missing ${key}. Set it in EAS environment variables for preview/production builds.`);
    }
  }

  if (appEnv === 'development') {
    throw new Error('Preview/production builds cannot use development app environment labels. Set EXPO_PUBLIC_APP_ENV accordingly.');
  }

  if (!apiUrl.startsWith('https://')) {
    throw new Error('Preview/production builds require EXPO_PUBLIC_API_URL to use HTTPS.');
  }

  if (isLocalOrLanHost(apiHost)) {
    throw new Error('Preview/production builds cannot use localhost/LAN EXPO_PUBLIC_API_URL.');
  }
}

if (buildProfile === 'production') {
  const expectedProductionApiUrl = process.env.EXPO_PUBLIC_PRODUCTION_API_URL?.trim();
  if (!expectedProductionApiUrl) {
    throw new Error('Production build requires EXPO_PUBLIC_PRODUCTION_API_URL to verify release backend target.');
  }

  try {
    new URL(expectedProductionApiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_PRODUCTION_API_URL must be a valid absolute URL.');
  }

  if (!normalizeUrl(expectedProductionApiUrl).startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_PRODUCTION_API_URL must use HTTPS.');
  }

  if (normalizeUrl(expectedProductionApiUrl) !== apiUrl) {
    throw new Error('Production build EXPO_PUBLIC_API_URL must match EXPO_PUBLIC_PRODUCTION_API_URL.');
  }
}

module.exports = () => {
  return {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins || []),
      'expo-font',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
    ],
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl,
      appEnv,
      buildProfile,
    },
  };
};
