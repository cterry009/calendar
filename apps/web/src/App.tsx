import { useMemo, useState } from 'react';
import {
  MOOD_LABELS,
  MOOD_STATES,
  PILLAR_LABELS,
  RITUAL_LABELS,
  SEROTONIN_RITUALS,
  type MoodState,
  type SerotoninPillar,
  type SerotoninRitual,
  type SerotoninSession,
  completeRitual,
  createSerotoninSession,
  endSerotoninSession,
  logMood,
  logPillarActivity,
  suggestNextPillar,
  suggestNextRitual,
} from '@calendar/shared';
import { SerotoninModePanel } from './components/SerotoninModePanel';

export default function App() {
  const [session, setSession] = useState<SerotoninSession | null>(null);

  const calmMode = session?.active ?? false;
  const nextPillar = session ? suggestNextPillar(session.pillars) : null;
  const nextRitual = session ? suggestNextRitual(session.completedRituals) : null;

  const streakHint = useMemo(
    () =>
      session && session.score >= 60
        ? '¡Buen día serotoninérgico! Mantén la racha mañana.'
        : 'Completa pilares y rituales para subir tu puntuación.',
    [session],
  );

  function startMode() {
    setSession(createSerotoninSession(crypto.randomUUID()));
  }

  function stopMode() {
    if (session) setSession(endSerotoninSession(session));
  }

  function handleRitual(ritual: SerotoninRitual) {
    if (!session) return;
    setSession(completeRitual(session, ritual));
  }

  function handlePillar(pillar: SerotoninPillar, minutes: number) {
    if (!session) return;
    setSession(logPillarActivity(session, pillar, minutes));
  }

  function handleMood(mood: MoodState) {
    if (!session) return;
    setSession(logMood(session, mood));
  }

  return (
    <div className={`app ${calmMode ? 'app--calm' : ''}`}>
      <header className="header">
        <div>
          <p className="eyebrow">Calendar Productivity</p>
          <h1>Calendario inteligente + Modo Serotonina</h1>
          <p className="subtitle">
            Reduce estímulos digitales de alta dopamina y promueve actividades que apoyan tu
            equilibrio natural (luz solar, ejercicio, conexión social, meditación).
          </p>
        </div>
        {!session?.active ? (
          <button className="btn btn--primary" onClick={startMode}>
            Activar Modo Serotonina
          </button>
        ) : (
          <button className="btn btn--ghost" onClick={stopMode}>
            Finalizar modo
          </button>
        )}
      </header>

      <main className="layout">
        <section className="card card--info">
          <h2>Próximamente</h2>
          <ul>
            <li>Calendario con tareas (dificultad, complejidad, estimación)</li>
            <li>Pomodoros y bloqueo de distracciones</li>
            <li>Estadísticas de productividad y deporte</li>
            <li>Sync móvil + escritorio</li>
          </ul>
        </section>

        <SerotoninModePanel
          session={session}
          nextPillar={nextPillar}
          nextRitual={nextRitual}
          streakHint={streakHint}
          onRitual={handleRitual}
          onPillar={handlePillar}
          onMood={handleMood}
          pillarLabels={PILLAR_LABELS}
          ritualLabels={RITUAL_LABELS}
          moodLabels={MOOD_LABELS}
          allRituals={SEROTONIN_RITUALS}
          allMoods={MOOD_STATES}
        />
      </main>
    </div>
  );
}
