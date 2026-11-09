import type { CSSProperties } from 'react';
import { palette, paletteAgenda, paletteAgendaDark, paletteLight } from '@calendar/ui';
import { useAppearance } from '../context/AppearanceContext';

/**
 * Native `<select>`/`<textarea>` elements can't read Tamagui theme tokens (those only resolve
 * inside Tamagui components), so every form using a raw HTML field had its own hardcoded dark
 * inline style -- invisible in dark mode, but a dark box floating on a white card once light mode
 * shipped. This reads the palette directly so those fields track the current appearance mode too.
 */
export function useNativeFieldStyle(): CSSProperties {
  const { mode } = useAppearance();
  const tokens = { dark: palette, light: paletteLight, agendaLight: paletteAgenda, agendaDark: paletteAgendaDark }[mode];
  const agenda = mode === 'agendaLight' || mode === 'agendaDark';

  return {
    border: `1px solid ${tokens.border}`,
    background: tokens.surface,
    color: tokens.text,
    fontFamily: agenda
      ? "'IBM Plex Sans', -apple-system, system-ui, sans-serif"
      : "'Outfit', -apple-system, system-ui, sans-serif",
  };
}
