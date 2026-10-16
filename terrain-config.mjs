// Public deployment configuration only. Never put AWS keys or client secrets here.
export const terrainConfig = Object.freeze({
  enabled: false,
  guestEnabled: false,
  activitySharingEnabled: false,
  librarySharingEnabled: false,
  apiBase: '',
  issuer: '',
  clientId: '',
  authDomain: '',
  scope: 'openid',
  // Register this exact URL on a public Cognito OAuth client (code + PKCE).
  redirectUri: '',
});
