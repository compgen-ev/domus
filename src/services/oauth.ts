export interface OAuthConfig {
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  /** Defaults to `${location.origin}${location.pathname}` */
  redirectUri?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

// ── PKCE ─────────────────────────────────────────────────────────────────────

function base64urlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (const b of buffer) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function randomBase64url(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

async function sha256Base64url(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

// ── Storage keys (namespaced by clientId) ────────────────────────────────────

function k(clientId: string, suffix: string): string {
  return `oauth_${clientId}_${suffix}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

function resolveRedirectUri(config: OAuthConfig): string {
  return config.redirectUri ?? `${location.origin}${location.pathname}`;
}

/**
 * Stores a PKCE verifier + state, then redirects to the provider's auth
 * endpoint. Never resolves — the browser navigates away.
 */
export async function initiateLogin(config: OAuthConfig): Promise<never> {
  const verifier  = randomBase64url(32);
  const state     = randomBase64url(16);
  const challenge = await sha256Base64url(verifier);

  sessionStorage.setItem(k(config.clientId, 'verifier'), verifier);
  sessionStorage.setItem(k(config.clientId, 'state'),    state);

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             config.clientId,
    redirect_uri:          resolveRedirectUri(config),
    scope:                 config.scopes.join(' '),
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  location.href = `${config.authEndpoint}?${params}`;
  return new Promise<never>(() => { /* navigation pending */ });
}

/**
 * Call this on the callback page. Reads `?code=` and `?state=` from the URL,
 * validates state, exchanges the code for a token, stores the access token in
 * sessionStorage, and cleans the URL.
 *
 * Returns the full token response, or `null` if no callback params are present.
 * Throws on state mismatch or a failed token exchange.
 */
export async function handleCallback(config: OAuthConfig): Promise<TokenResponse | null> {
  const params = new URLSearchParams(location.search);
  const code   = params.get('code');
  const state  = params.get('state');

  if (!code || !state) return null;

  const savedState   = sessionStorage.getItem(k(config.clientId, 'state'));
  const codeVerifier = sessionStorage.getItem(k(config.clientId, 'verifier'));

  if (!savedState || state !== savedState) {
    throw new Error('State mismatch — possible CSRF attempt');
  }

  sessionStorage.removeItem(k(config.clientId, 'state'));
  sessionStorage.removeItem(k(config.clientId, 'verifier'));

  history.replaceState(null, '', `${location.origin}${location.pathname}`);

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  resolveRedirectUri(config),
    client_id:     config.clientId,
    code_verifier: codeVerifier ?? '',
  });

  const res  = await fetch(config.tokenEndpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json() as Record<string, unknown>;

  if (!res.ok || data['error']) {
    throw new Error((data['error_description'] ?? data['error'] ?? `HTTP ${res.status}`) as string);
  }

  const token = data as unknown as TokenResponse;
  console.log('OAuth token received:', {
    expires_in: token.expires_in,
    expires_in_hours: token.expires_in ? token.expires_in / 3600 : null,
    has_refresh_token: !!token.refresh_token,
  });

  storeTokens(config.clientId, token);
  return token;
}

/**
 * Stores access token, refresh token, and expiry timestamp in sessionStorage
 */
function storeTokens(clientId: string, token: TokenResponse): void {
  sessionStorage.setItem(k(clientId, 'token'), token.access_token);

  if (token.refresh_token) {
    sessionStorage.setItem(k(clientId, 'refresh_token'), token.refresh_token);
  }

  if (token.expires_in) {
    // Store expiry timestamp (current time + expires_in seconds)
    const expiryTime = Date.now() + (token.expires_in * 1000);
    sessionStorage.setItem(k(clientId, 'token_expiry'), expiryTime.toString());
  }
}

/**
 * Checks if the current token is expired or close to expiring (within 5 minutes)
 */
function isTokenExpiringSoon(clientId: string): boolean {
  const expiryStr = sessionStorage.getItem(k(clientId, 'token_expiry'));
  if (!expiryStr) return false;

  const expiryTime = parseInt(expiryStr, 10);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return now >= (expiryTime - fiveMinutes);
}

/**
 * Refreshes the access token using the stored refresh token
 */
async function refreshAccessToken(config: OAuthConfig): Promise<TokenResponse | null> {
  const refreshToken = sessionStorage.getItem(k(config.clientId, 'refresh_token'));

  if (!refreshToken) {
    console.warn('No refresh token available');
    return null;
  }

  console.log('Refreshing access token...');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  try {
    const res = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json() as Record<string, unknown>;

    if (!res.ok || data['error']) {
      console.error('Token refresh failed:', data['error_description'] ?? data['error']);
      // Clear invalid tokens
      clearStoredToken(config.clientId);
      return null;
    }

    const token = data as unknown as TokenResponse;
    console.log('Token refreshed successfully:', {
      expires_in: token.expires_in,
      expires_in_hours: token.expires_in ? token.expires_in / 3600 : null,
      has_new_refresh_token: !!token.refresh_token,
    });

    storeTokens(config.clientId, token);
    return token;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

/** Returns the stored access token for this client, or `null`. */
export function getStoredToken(clientId: string): string | null {
  return sessionStorage.getItem(k(clientId, 'token'));
}

/** Removes all stored tokens and expiry data. */
export function clearStoredToken(clientId: string): void {
  sessionStorage.removeItem(k(clientId, 'token'));
  sessionStorage.removeItem(k(clientId, 'refresh_token'));
  sessionStorage.removeItem(k(clientId, 'token_expiry'));
}

/**
 * Gets a valid access token, automatically refreshing if needed.
 * Returns null if no token exists or refresh fails.
 */
export async function getValidToken(config: OAuthConfig): Promise<string | null> {
  const token = getStoredToken(config.clientId);

  if (!token) {
    return null;
  }

  // Check if token is expiring soon and needs refresh
  if (isTokenExpiringSoon(config.clientId)) {
    const refreshed = await refreshAccessToken(config);
    if (refreshed) {
      return refreshed.access_token;
    }
    // If refresh failed, return null (token is invalid)
    return null;
  }

  return token;
}
