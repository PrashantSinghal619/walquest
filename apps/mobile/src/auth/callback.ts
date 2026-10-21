export const AUTH_REDIRECT = 'walquest://auth/callback';

export function parseAuthCallback(value: string): { code: string } | { error: string } {
  const error = 'This sign-in link is invalid or expired. Request a new link and open it on this phone.';
  try {
    const url = new URL(value);
    if (url.protocol !== 'walquest:' || url.hostname !== 'auth' || url.pathname !== '/callback' ||
      url.username || url.password || url.port || url.hash || url.searchParams.has('error')) return { error };
    const codes = url.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0] || codes[0].length > 2048) return { error };
    return { code: codes[0] };
  } catch { return { error }; }
}
