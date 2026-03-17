export const theme = {
  // Primary Colors
  primary: '#1E3A8A',
  primaryDark: '#172554',
  primaryLight: '#E0E7FF',
  primaryExtraLight: '#EEF2FF',

  // Secondary Colors
  secondary: '#0E7490',
  secondaryLight: '#D7F0F7',

  // Background Colors
  headerBg: '#142A66',
  background: '#F2F6F9',
  cardBg: '#FFFFFF',
  inputBg: '#EEF4F8',
  surfaceAlt: '#E9F1F6',

  // Text Colors
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // UI Colors
  borderColor: '#E2E8F0',
  borderColorDark: '#CBD5E1',
  divider: '#E2E8F0',

  // Button Colors
  buttonPrimary: '#1E3A8A',
  buttonHover: '#172554',
  buttonSecondary: '#FFFFFF',
  buttonText: '#FFFFFF',

  // Status Colors
  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Accent Colors
  accent: '#D4A017',
  accentLight: '#FEF3C7',

  // Shadow
  shadowColor: '#0B2F3B',

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },

  // Border Radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },

  // Breakpoints
  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
  },
};

export type Theme = typeof theme;
