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
  if (token) fetchAndStoreOhmUsername(token.access_token);
  return token !== null;
}

export async function fetchAndStoreOhmUsername(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openhistoricalmap.org/api/0.6/user/details.json', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const user = data['user'] as Record<string, unknown> | undefined;
    const username = user?.['display_name'] as string | undefined;
    if (username) sessionStorage.setItem(`oauth_${OHM_CONFIG.clientId}_username`, username);
    return username ?? null;
  } catch { return null; }
}

export function getStoredOhmUsername(): string | null {
  return sessionStorage.getItem(`oauth_${OHM_CONFIG.clientId}_username`);
}
