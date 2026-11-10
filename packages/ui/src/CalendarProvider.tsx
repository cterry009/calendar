import type { ReactNode } from 'react';
import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from './tamagui.config';
import type { CalendarTheme } from './tokens';

// Tamagui's runtime only inserts *component* style rules on its own (via the `#_tamagui-styles`
// tag it manages). The theme and token CSS variables every one of those rules refers to come from
// `config.getCSS()`, which nothing calls outside the dev server's HMR path -- so a production
// bundle renders with every `var(--background)` unresolved unless the static extractor emitted
// them, and the extractor is off here (it crashes bundling this config). Emitting them once at
// startup is what makes `vite build` produce the same styling `vite dev` shows.
//
// Runs in dev too, deliberately: identical values, and it keeps production from depending on a
// code path dev never exercises -- which is the exact trap that hid this bug until `tauri build`.
function injectThemeCSS() {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'tamagui-theme-css';
  if (document.getElementById(STYLE_ID)) return;

  const styleTag = document.createElement('style');
  styleTag.id = STYLE_ID;
  styleTag.textContent = rootAgendaSelectors(tamaguiConfig.getCSS());
  document.head.appendChild(styleTag);
}

// Tamagui emits the themes added on top of dark/light (agendaLight, agendaDark) only as descendant
// selectors (`:root .t_agendaDark`), but the active theme's class sits on <html> itself, so the
// root kept the old green variables (seen 2026-11-09 in the installed app). Each such selector also
// gets its `:root.t_…` form.
export function rootAgendaSelectors(css: string): string {
  return css.replace(/:root \.t_(agendaDark|agendaLight)((?: \.t_[A-Za-z_]+)*)/g, ':root.t_$1$2, :root .t_$1$2');
}

injectThemeCSS();

interface CalendarProviderProps {
  children: ReactNode;
  theme?: CalendarTheme;
}

export function CalendarProvider({ children, theme = 'dark' }: CalendarProviderProps) {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <Theme name={theme}>{children}</Theme>
    </TamaguiProvider>
  );
}

export { tamaguiConfig };
