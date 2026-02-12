// API Configuration
// This file contains the API base URL for the backend server

/**
 * Production API Base URL (Railway)
 * Use this when connecting to the deployed backend
 */
export const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

/**
 * Local Development API Base URL
 * Uncomment and use this when developing with local backend
 * Make sure to update the IP address to match your local network
 */
// export const API_BASE_URL = 'http://localhost:3000';
// export const API_BASE_URL = 'http://192.168.x.x:3000';

/**
 * Environment Detection (for future enhancement)
 * You can use __DEV__ to automatically switch between environments
 */
// export const API_BASE_URL = __DEV__ 
//   ? 'http://192.168.x.x:3000'  // Local development
//   : 'https://prioritize-production-3835.up.railway.app';  // Production

export default API_BASE_URL;
