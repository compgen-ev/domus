import type { OAuthConfig } from './oauth';
import { initiateLogin, handleCallback, getStoredToken, clearStoredToken, getValidToken } from './oauth';

// Wikimedia OAuth 2.0 config
// Use production consumer for domus.genealogy.net, dev consumer for localhost
const isProd = location.hostname === 'domus.genealogy.net';
const WIKIMEDIA_CONFIG: OAuthConfig = {
  clientId: isProd
    ? '2f72fc54220fdf923e29a989212b5619' // Production
    : '4e6c7ae6f3b47b114de7aab9fa99be75', // Development (oauth-test.html)
  authEndpoint: 'https://meta.wikimedia.org/w/rest.php/oauth2/authorize',
  tokenEndpoint: 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token',
  scopes: ['basic', 'createeditmovepage'],
};

export function login(): Promise<never> {
  return initiateLogin(WIKIMEDIA_CONFIG);
}

export function logout(): void {
  clearStoredToken(WIKIMEDIA_CONFIG.clientId);
}

/**
 * Get the current access token (synchronous, does not auto-refresh)
 * For API calls, prefer getValidAccessToken() which auto-refreshes
 */
export function getAccessToken(): string | null {
  return getStoredToken(WIKIMEDIA_CONFIG.clientId);
}

/**
 * Get a valid access token, automatically refreshing if needed
 * Use this for API calls to ensure token is fresh
 */
export async function getValidAccessToken(): Promise<string | null> {
  return getValidToken(WIKIMEDIA_CONFIG);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export async function handleOAuthCallback(): Promise<boolean> {
  const token = await handleCallback(WIKIMEDIA_CONFIG);
  return token !== null;
}
