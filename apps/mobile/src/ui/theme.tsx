import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

// Match the named palette in the web app's globals.css.
export const palettes = {
  light: {
    background: '#F3EFE0', surface: '#F3EFE0', text: '#2B2D26', muted: '#635F4E',
    border: '#D8CBB6', subtle: '#E8E3D3', primary: '#635F4E', onPrimary: '#F3EFE0',
    route: '#828B6A', positive: '#526344', negative: '#923F2A', notice: '#ECE1D3',
  },
  dark: {
    background: '#2B2D26', surface: '#383B30', text: '#F3EFE0', muted: '#D8CBB6',
    border: '#505247', subtle: '#42453A', primary: '#B9C09E', onPrimary: '#2B2D26',
    route: '#B9C09E', positive: '#B9C09E', negative: '#F1AD91', notice: '#4A382F',
  },
};
type Theme = { colors: typeof palettes.light; dark: boolean; fontsReady: boolean; toggle: () => void };
const ThemeContext = createContext<Theme>({ colors: palettes.light, dark: false, fontsReady: false, toggle: () => {} });

export function MobileThemeProvider({ children, fontsReady = false }: { children: ReactNode; fontsReady?: boolean }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<boolean | null>(null);
  const dark = override ?? systemScheme === 'dark';
  return <ThemeContext.Provider value={{ colors: dark ? palettes.dark : palettes.light, dark, fontsReady, toggle: () => setOverride(!dark) }}>{children}</ThemeContext.Provider>;
}

export const useMobileTheme = () => useContext(ThemeContext);
