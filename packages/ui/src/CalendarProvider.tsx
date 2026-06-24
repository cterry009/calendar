import type { ReactNode } from 'react';
import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from './tamagui.config';
import type { CalendarTheme } from './tokens';

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
