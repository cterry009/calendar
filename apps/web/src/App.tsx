import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedAppLayout } from './layouts/ProtectedAppLayout';
import { CalendarPage } from './pages/CalendarPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { FitnessPage } from './pages/FitnessPage';
import { PomodoroPage } from './pages/PomodoroPage';
import { RegisterPage } from './pages/RegisterPage';
import { SchedulePage } from './pages/SchedulePage';
import { TasksPage } from './pages/TasksPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedAppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/fitness" element={<FitnessPage />} />
            <Route path="/pomodoro" element={<PomodoroPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
