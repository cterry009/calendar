import React from 'react';
import ReactDOM from 'react-dom/client';
import { CalendarProvider } from '@calendar/ui';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CalendarProvider theme="dark">
      <App />
    </CalendarProvider>
  </React.StrictMode>,
);
