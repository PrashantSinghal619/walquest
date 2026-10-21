import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useURL } from 'expo-linking';
import { router } from 'expo-router';
import { exchangeAuthCode } from '../../auth/client';
import { parseAuthCallback } from '../../auth/callback';

export default function AuthCallback() {
  const url = useURL();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const incomingUrl = url;
    let alive = true;
    async function complete() {
      const parsed = parseAuthCallback(incomingUrl);
      if ('error' in parsed) throw new Error(parsed.error);
      await exchangeAuthCode(parsed.code);
      if (alive) router.replace('/');
    }
    void complete().catch(() => {
      if (alive) setError('This sign-in link could not be used. Request a fresh link and open it on this phone.');
    });
    return () => { alive = false; };
  }, [url]);
  return (
    <View style={styles.screen}>
      <Text accessibilityRole={error ? 'alert' : undefined}>{error ?? 'Completing sign-in…'}</Text>
      <Button title="Back to Walquest" onPress={() => router.replace('/')} />
    </View>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: '#F5F1E8' } });
