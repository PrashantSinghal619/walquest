import { useState } from 'react';
import { AccountView } from './account-view';
import { useAuth } from '../auth/provider';
import { getAuthClient } from '../auth/client';
import { AUTH_REDIRECT } from '../auth/callback';
import { pauseRecorder } from '../recording/controller';

export function AccountPanel() {
  const { session, loading, configured, error } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function signIn() {
    const client = getAuthClient();
    if (!client || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Enter a valid email address.'); return; }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: AUTH_REDIRECT } });
      setMessage(error ? 'Could not send the link. Check the address and connection, then try again shortly.' : 'Check your email. Open the newest sign-in link on this phone.');
    } catch { setMessage('Could not send the sign-in link. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    const client = getAuthClient();
    if (!client || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await pauseRecorder();
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) setMessage('Could not sign out. Try again when connected.');
    } catch { setMessage('Could not sign out safely. Pause your walk and try again.'); }
    finally { setBusy(false); }
  }
  return <AccountView loading={loading} configured={configured} signedIn={!!session} accountEmail={session?.user.email}
    email={email} onEmailChange={setEmail} busy={busy} message={message ?? error}
    onSignIn={() => { void signIn(); }} onSignOut={() => { void signOut(); }} />;
}
