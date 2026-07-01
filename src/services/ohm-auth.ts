import type { OAuthConfig } from './oauth';
import { initiateLogin, handleCallback, getStoredToken, clearStoredToken, getValidToken } from './oauth';

const OHM_CONFIG: OAuthConfig = {
  clientId:      'qWphSMfJpscsdafgzn-42QwNkJh16U9rpLbCY57_K-g',
  authEndpoint:  'https://www.openhistoricalmap.org/oauth2/authorize',
  tokenEndpoint: 'https://www.openhistoricalmap.org/oauth2/token',
  scopes:        ['read_prefs', 'write_api'],
};

export function ohmLogin(): Promise<never> {
  return initiateLogin(OHM_CONFIG);
}

export function ohmLogout(): void {
  clearStoredToken(OHM_CONFIG.clientId);
}

export function getOhmAccessToken(): string | null {
  return getStoredToken(OHM_CONFIG.clientId);
}

export async function getValidOhmAccessToken(): Promise<string | null> {
  return getValidToken(OHM_CONFIG);
}

export function isOhmAuthenticated(): boolean {
  return getOhmAccessToken() !== null;
}

export async function handleOhmOAuthCallback(): Promise<boolean> {
  const token = await handleCallback(OHM_CONFIG);
  return token !== null;
}
