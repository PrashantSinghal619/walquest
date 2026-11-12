import '../recording/task';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth/provider';
import { useFonts } from 'expo-font';
import { MobileThemeProvider, useMobileTheme } from '../ui/theme';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  const [fontsReady] = useFonts({
    Geist: require('../../assets/fonts/Geist-Regular.ttf'),
    GeistMedium: require('../../assets/fonts/Geist-Medium.ttf'),
    GeistSemibold: require('../../assets/fonts/Geist-SemiBold.ttf'),
  });
  return (
    <SafeAreaProvider>
      <MobileThemeProvider fontsReady={fontsReady}>
        <AuthProvider><Navigation /></AuthProvider>
      </MobileThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { colors, dark } = useMobileTheme();
  return <><StatusBar style={dark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} /></>;
}
