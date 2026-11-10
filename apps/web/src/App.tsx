import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LegacyPanelRedirect } from './components/panels/LegacyPanelRedirect';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedAppLayout } from './layouts/ProtectedAppLayout';
import { CalendarPage } from './pages/CalendarPage';
import { HoyPage } from './pages/HoyPage';
import { EstadisticasPage } from './pages/EstadisticasPage';
import { BloqueoPage } from './pages/BloqueoPage';
import { ProyectosPage } from './pages/ProyectosPage';
import { ProyectoPage } from './pages/ProyectoPage';
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { RegisterPage } from './pages/RegisterPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedAppLayout />}>
            <Route path="/" element={<Navigate to="/calendar" replace />} />
            <Route path="/calendar" element={<CalendarPage />} />
            {/* agenda-redesign (2026-11-09): full pages, not tabs beside the calendar. */}
            <Route path="/hoy" element={<HoyPage />} />
            <Route path="/proyectos" element={<ProyectosPage />} />
            <Route path="/proyectos/:id" element={<ProyectoPage />} />
            <Route path="/investigacion" element={<Navigate to="/proyectos" replace />} />
            <Route path="/estadisticas" element={<EstadisticasPage />} />
            <Route path="/bloqueo" element={<BloqueoPage />} />
            <Route path="/tasks" element={<Navigate to="/calendar" replace />} />
            <Route path="/schedule" element={<Navigate to="/calendar" replace />} />
            {/* These used to be full pages; they're slide-over panels now (task 5.1). Old
                links/bookmarks still work, redirected to the calendar with the panel open. */}
            <Route path="/fitness" element={<LegacyPanelRedirect panel="fitness" />} />
            <Route path="/pomodoro" element={<LegacyPanelRedirect panel="pomodoro" />} />
            <Route path="/blocklist" element={<Navigate to="/bloqueo" replace />} />
            <Route path="/detox" element={<LegacyPanelRedirect panel="detox" />} />
            <Route path="/dashboard" element={<Navigate to="/estadisticas" replace />} />
            <Route path="/suggestions" element={<LegacyPanelRedirect panel="suggestions" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
