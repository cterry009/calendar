import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CalendarProvider } from '@calendar/ui';
import App from './App';
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CalendarProvider theme="dark">
      <AuthProvider>
        <App />
      </AuthProvider>
    </CalendarProvider>
  </React.StrictMode>,
);
