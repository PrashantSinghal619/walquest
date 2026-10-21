import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
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
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Account</Text>
      {loading ? <Text>Restoring sign-in…</Text> : !configured ? <Text>Sign-in needs the Supabase settings in this build. Local recording is available.</Text> : session ? (
        <><Text>Signed in as {session.user.email ?? 'walker'}</Text><Button title="Sign out on this phone" disabled={busy} onPress={() => { void signOut(); }} /></>
      ) : (
        <>
          <TextInput accessibilityLabel="Email address" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} style={styles.input} />
          <Button title={busy ? 'Sending…' : 'Email me a sign-in link'} disabled={busy} onPress={() => { void signIn(); }} />
        </>
      )}
      {(message || error) && <Text accessibilityRole="alert">{message ?? error}</Text>}
      <Text style={styles.note}>Recorded walks stay on this phone during this preview, including after sign-out. Use Delete saved walk to remove them.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { gap: 10, borderTopWidth: 1, borderTopColor: '#D0D2C9', paddingTop: 14 },
  title: { fontSize: 19, fontWeight: '600', color: '#394434' },
  input: { padding: 12, borderWidth: 1, borderColor: '#838A79', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#394434' },
  note: { fontSize: 13, lineHeight: 19, color: '#595C54' },
});
