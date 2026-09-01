import { TextStyle, ViewStyle } from 'react-native';

// Space Grotesk is loaded in App.tsx via @expo-google-fonts/space-grotesk.
// Weights are baked into the font family name (not picked via fontWeight on iOS).
const fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
};
const sans = fonts.regular;

export const theme = {
  colors: {
    // Brand palette — Batterycheck identity
    primary: '#0F7AEF',           // Pantone 2172 C
    primaryContainer: '#E3EEFB',  // soft tint of primary, derived for chips/wells
    secondary: '#DADADA',         // Cool Gray 1C
    background: '#FAF9F8',        // White 1C
    surface: '#FFFFFF',
    foreground: '#0D0C14',        // Black 6C
    foregroundSoft: '#3A3946',    // dimmed ink for body text
    muted: '#6E6C77',             // tertiary text
    mutedSoft: '#DADADA',
    line: '#E5E4E2',
    danger: '#D9534F',
    accent: '#0D0C14',
    confetti: ['#0F7AEF', '#0D0C14', '#DADADA'] as const,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
  fonts,
  typography: {
    display: { fontSize: 36, fontFamily: fonts.bold, letterSpacing: -0.5 } as TextStyle,
    title: { fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.3 } as TextStyle,
    heading: { fontSize: 22, fontFamily: fonts.semibold, letterSpacing: -0.2 } as TextStyle,
    subheading: { fontSize: 17, fontFamily: fonts.semibold } as TextStyle,
    body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 23 } as TextStyle,
    bodyMedium: { fontSize: 16, fontFamily: fonts.medium } as TextStyle,
    caption: { fontSize: 13, fontFamily: fonts.medium, color: '#6E6C77' } as TextStyle,
    label: { fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 0.4 } as TextStyle,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    } as ViewStyle,
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    } as ViewStyle,
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 6,
    } as ViewStyle,
  },
} as const;

export type Theme = typeof theme;
