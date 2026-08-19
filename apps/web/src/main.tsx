import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CalendarProvider } from '@calendar/ui';
import App from './App';
import { AppearanceProvider, useAppearance } from './context/AppearanceContext';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// Reads the appearance mode chosen in Configuracion and feeds it to CalendarProvider, which only
// accepts a static prop -- this is what makes the theme switch at runtime.
function Root() {
  const { mode } = useAppearance();

  return (
    <CalendarProvider theme={mode}>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </CalendarProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppearanceProvider>
      <Root />
    </AppearanceProvider>
  </React.StrictMode>,
);
