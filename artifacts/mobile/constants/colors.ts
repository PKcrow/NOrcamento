/**
 * Brand color tokens — synced from the web artifact's index.css.
 * Primary: #f97316 (orange), navy background for dark mode.
 */

const Colors = {
  light: {
    text: '#1e293b',
    tint: '#f97316',

    background: '#fafafa',
    foreground: '#1e293b',

    card: '#ffffff',
    cardForeground: '#1e293b',

    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#f1f5f9',
    secondaryForeground: '#1e293b',

    muted: '#f1f5f9',
    mutedForeground: '#64748b',

    accent: '#f1f5f9',
    accentForeground: '#1e293b',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#e2e8f0',
    input: '#e2e8f0',

    tabIconDefault: '#94a3b8',
    tabIconSelected: '#f97316',
  },
  dark: {
    text: '#f8fafc',
    tint: '#f97316',

    background: '#0f172a',
    foreground: '#f8fafc',

    card: '#1e293b',
    cardForeground: '#f8fafc',

    primary: '#f97316',
    primaryForeground: '#ffffff',

    secondary: '#1e293b',
    secondaryForeground: '#f8fafc',

    muted: '#1e293b',
    mutedForeground: '#94a3b8',

    accent: '#1e293b',
    accentForeground: '#f8fafc',

    destructive: '#b91c1c',
    destructiveForeground: '#ffffff',

    border: '#334155',
    input: '#334155',

    tabIconDefault: '#64748b',
    tabIconSelected: '#f97316',
  },
  radius: 8,
};

export default Colors;
