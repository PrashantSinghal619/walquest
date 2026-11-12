import { StyleSheet, TextInput, View } from 'react-native';
import { ActionButton, AppText } from '../ui/primitives';
import { useMobileTheme } from '../ui/theme';

export type AccountViewProps = {
  loading: boolean; configured: boolean; signedIn: boolean; accountEmail?: string;
  email: string; onEmailChange: (email: string) => void; busy: boolean;
  message: string | null; onSignIn: () => void; onSignOut: () => void;
};

export function AccountView(props: AccountViewProps) {
  const { colors, fontsReady } = useMobileTheme();
  return <View style={styles.panel}>
    <AppText weight="semibold" style={styles.title}>{props.signedIn ? 'Your account' : 'Walk it. Claim it. Defend it.'}</AppText>
    {props.loading ? <AppText muted>Restoring sign-in…</AppText> : !props.configured ? <AppText muted>Sign-in is unavailable in this build. You can still record and save walks on this phone.</AppText> : props.signedIn ? <>
      <AppText muted>Signed in as</AppText>
      <AppText weight="medium" selectable>{props.accountEmail ?? 'walker'}</AppText>
      <ActionButton title="Sign out on this phone" variant="secondary" disabled={props.busy} onPress={props.onSignOut} />
    </> : <>
      <AppText muted>Sign in with an email link. No password needed.</AppText>
      <View style={styles.field}>
        <AppText weight="medium">Email address</AppText>
        <TextInput accessibilityLabel="Email address"
          value={props.email} onChangeText={props.onEmailChange} keyboardType="email-address" autoCapitalize="none"
          autoCorrect={false} autoComplete="email" editable={!props.busy} returnKeyType="go" onSubmitEditing={props.onSignIn}
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, fontFamily: fontsReady ? 'Geist' : undefined }]} />
      </View>
      <ActionButton title={props.busy ? 'Sending link…' : 'Email me a sign-in link'} disabled={props.busy} onPress={props.onSignIn} />
    </>}
    {props.message && <View style={[styles.message, { backgroundColor: colors.subtle }]}><AppText accessibilityRole="alert">{props.message}</AppText></View>}
    <View style={[styles.note, { borderTopColor: colors.border }]}>
      <AppText weight="medium">Your walks stay with you</AppText>
      <AppText muted>Walks are saved on this phone during this preview, including after sign-out. Territory claiming is coming next.</AppText>
      <AppText muted style={styles.small}>To remove a route, open Walk details and choose Delete saved walk.</AppText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { gap: 16 }, title: { fontSize: 22, lineHeight: 30, letterSpacing: -0.4 }, field: { marginTop: 8, gap: 8 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  message: { borderRadius: 8, padding: 12 }, note: { marginTop: 16, paddingTop: 24, borderTopWidth: 1, gap: 8 }, small: { fontSize: 12, lineHeight: 18 },
});
