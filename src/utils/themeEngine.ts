export type ThemePresetId =
  | 'editorial-dark'
  | 'crisp-light'
  | 'midnight-slate'
  | 'warm-sepia'
  | 'high-contrast';

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  mode: 'dark' | 'light';
  bgMain: string;
  bgSecondary: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  defaultAccent: string;
  statusSuccess: string;
  statusWarning: string;
  statusDanger: string;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'editorial-dark',
    name: 'Editorial Forest',
    description: 'Deep carbon obsidian with warm parchment ink and acid-lime accent',
    mode: 'dark',
    bgMain: '#101210',
    bgSecondary: '#171A17',
    bgElevated: '#1E221E',
    textPrimary: '#F2F2E9',
    textSecondary: '#B3B8AF',
    textMuted: '#889085',
    borderSubtle: '#30362F',
    defaultAccent: '#C6F36B',
    statusSuccess: '#83C995',
    statusWarning: '#E7B96A',
    statusDanger: '#EF8B85',
  },
  {
    id: 'crisp-light',
    name: 'Crisp Paper',
    description: 'Warm archival ivory paper with ink-black editorial typography',
    mode: 'light',
    bgMain: '#F6F6F0',
    bgSecondary: '#ECECE4',
    bgElevated: '#FFFFFF',
    textPrimary: '#141714',
    textSecondary: '#434A41',
    textMuted: '#636B61',
    borderSubtle: '#D4D7CE',
    defaultAccent: '#2D6A00',
    statusSuccess: '#1A7437',
    statusWarning: '#9E610B',
    statusDanger: '#BD2E26',
  },
  {
    id: 'midnight-slate',
    name: 'Midnight Slate',
    description: 'Cool deep-navy workspace tuned for long evening focus blocks',
    mode: 'dark',
    bgMain: '#0D131F',
    bgSecondary: '#131B2B',
    bgElevated: '#1A2438',
    textPrimary: '#F1F5F9',
    textSecondary: '#B0BDD1',
    textMuted: '#8495AE',
    borderSubtle: '#2A3752',
    defaultAccent: '#38BDF8',
    statusSuccess: '#4ADE80',
    statusWarning: '#FBBF24',
    statusDanger: '#F87171',
  },
  {
    id: 'warm-sepia',
    name: 'Warm Sepia',
    description: 'Low-glare bookish sand tones with espresso ink for daylight reading',
    mode: 'light',
    bgMain: '#F5EFE4',
    bgSecondary: '#EBE2D2',
    bgElevated: '#FBF7F0',
    textPrimary: '#241D15',
    textSecondary: '#54473A',
    textMuted: '#6F6152',
    borderSubtle: '#D5C7B3',
    defaultAccent: '#B45309',
    statusSuccess: '#1D6E3B',
    statusWarning: '#9A5B06',
    statusDanger: '#B42E27',
  },
  {
    id: 'high-contrast',
    name: 'High-Contrast Obsidian',
    description: 'Maximum WCAG AAA legibility with pure charcoal and luminous ink',
    mode: 'dark',
    bgMain: '#080908',
    bgSecondary: '#111311',
    bgElevated: '#181B18',
    textPrimary: '#FFFFFF',
    textSecondary: '#D8DDD7',
    textMuted: '#A8B0A7',
    borderSubtle: '#434A42',
    defaultAccent: '#FFE14D',
    statusSuccess: '#6EE7B7',
    statusWarning: '#FCD34D',
    statusDanger: '#FCA5A5',
  },
];

export const ACCENT_SWATCHES: { name: string; hex: string }[] = [
  { name: 'Acid Lime', hex: '#C6F36B' },
  { name: 'Sky Cyan', hex: '#38BDF8' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Coral Rose', hex: '#FB7185' },
  { name: 'Mint Emerald', hex: '#34D399' },
  { name: 'Violet Iris', hex: '#A78BFA' },
  { name: 'Forest Moss', hex: '#2D6A00' },
  { name: 'Terracotta', hex: '#C2410C' },
];

export function normalizeHex(hex: string): string {
  const clean = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return '#C6F36B';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex).slice(1);
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * WCAG 2.1 relative luminance calculation.
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colors (1.0 to 21.0).
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Picks dark or white text ink for maximum readability on top of `bgHex`.
 */
export function getOptimalTextColor(bgHex: string): '#101210' | '#FFFFFF' {
  const darkRatio = getContrastRatio(bgHex, '#101210');
  const lightRatio = getContrastRatio(bgHex, '#FFFFFF');
  return darkRatio >= lightRatio ? '#101210' : '#FFFFFF';
}

/**
 * Mixes a hex color toward white (amount > 0) or black (amount < 0).
 */
function shiftBrightness(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (factor >= 0) {
    return rgbToHex(
      r + (255 - r) * factor,
      g + (255 - g) * factor,
      b + (255 - b) * factor
    );
  }
  const keep = 1 + factor;
  return rgbToHex(r * keep, g * keep, b * keep);
}

/**
 * Automatically adjusts an accent color so that text/icons rendered in that accent
 * on `bgHex` always satisfy WCAG AA (>= minRatio, default 4.5:1).
 */
export function adjustAccentForBackground(
  accentHex: string,
  bgHex: string,
  minRatio: number = 4.5
): string {
  const normAccent = normalizeHex(accentHex);
  if (getContrastRatio(normAccent, bgHex) >= minRatio) {
    return normAccent;
  }

  const bgIsDark = getRelativeLuminance(bgHex) < 0.25;
  let best = normAccent;
  let bestRatio = getContrastRatio(normAccent, bgHex);

  for (let step = 1; step <= 18; step++) {
    const factor = bgIsDark ? step * 0.05 : -step * 0.05;
    const candidate = shiftBrightness(normAccent, factor);
    const ratio = getContrastRatio(candidate, bgHex);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
    if (ratio >= minRatio) {
      return candidate;
    }
  }
  return best;
}

export function getPresetById(
  presetId?: string | null,
  fallbackTheme?: 'dark' | 'light' | 'system'
): ThemePresetDefinition {
  const found = THEME_PRESETS.find((p) => p.id === presetId);
  if (found) return found;
  if (fallbackTheme === 'light') return THEME_PRESETS[1];
  return THEME_PRESETS[0];
}

export interface ComputedThemeBundle {
  preset: ThemePresetDefinition;
  effectiveMode: 'dark' | 'light';
  variables: Record<string, string>;
  metrics: {
    textContrastRatio: number;
    accentContrastRatio: number;
    buttonContrastRatio: number;
    wcagGrade: 'AAA' | 'AA';
  };
}

export function buildThemeVariables(
  presetId: string | null | undefined,
  customAccentHex: string | null | undefined,
  themeModePreference: 'dark' | 'light' | 'system' = 'dark',
  systemPrefersDark: boolean = true
): ComputedThemeBundle {
  let preset = getPresetById(presetId, themeModePreference);

  // If user chose 'system' theme mode without picking a specific non-default preset, honor OS preference
  if (
    themeModePreference === 'system' &&
    (preset.id === 'editorial-dark' || preset.id === 'crisp-light')
  ) {
    preset = systemPrefersDark ? THEME_PRESETS[0] : THEME_PRESETS[1];
  }

  const rawAccent = normalizeHex(customAccentHex || preset.defaultAccent);
  // Accent text/borders on elevated cards must hit >= 4.5:1 WCAG AA
  const accessibleAccentText = adjustAccentForBackground(
    rawAccent,
    preset.bgElevated,
    4.5
  );
  // Button surface uses user's chosen accent, and button text is automatically computed for max contrast
  const buttonContrastText = getOptimalTextColor(rawAccent);

  const textContrastRatio = getContrastRatio(preset.textPrimary, preset.bgElevated);
  const accentContrastRatio = getContrastRatio(
    accessibleAccentText,
    preset.bgElevated
  );
  const buttonContrastRatio = getContrastRatio(buttonContrastText, rawAccent);

  const variables: Record<string, string> = {
    '--bg-main': preset.bgMain,
    '--bg-secondary': preset.bgSecondary,
    '--bg-elevated': preset.bgElevated,
    '--text-primary': preset.textPrimary,
    '--text-secondary': preset.textSecondary,
    '--text-muted': preset.textMuted,
    '--accent-primary': accessibleAccentText,
    '--accent-surface': rawAccent,
    '--accent-contrast': buttonContrastText,
    '--status-success': preset.statusSuccess,
    '--status-warning': preset.statusWarning,
    '--status-danger': preset.statusDanger,
    '--border-subtle': preset.borderSubtle,
  };

  return {
    preset,
    effectiveMode: preset.mode,
    variables,
    metrics: {
      textContrastRatio,
      accentContrastRatio,
      buttonContrastRatio,
      wcagGrade:
        textContrastRatio >= 7 && buttonContrastRatio >= 4.5 ? 'AAA' : 'AA',
    },
  };
}

export function applyThemeToDocument(
  presetId: string | null | undefined,
  customAccentHex: string | null | undefined,
  themeModePreference: 'dark' | 'light' | 'system' = 'dark'
): ComputedThemeBundle {
  const prefersDark =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  const bundle = buildThemeVariables(
    presetId,
    customAccentHex,
    themeModePreference,
    prefersDark
  );

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (bundle.effectiveMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    for (const [key, val] of Object.entries(bundle.variables)) {
      root.style.setProperty(key, val);
    }
  }
  return bundle;
}
