import type {
  MoodState,
  SerotoninPillar,
  SerotoninRitual,
  SerotoninSession,
} from '@calendar/shared';

interface Props {
  session: SerotoninSession | null;
  nextPillar: SerotoninPillar | null;
  nextRitual: SerotoninRitual | null;
  streakHint: string;
  onRitual: (ritual: SerotoninRitual) => void;
  onPillar: (pillar: SerotoninPillar, minutes: number) => void;
  onMood: (mood: MoodState) => void;
  pillarLabels: Record<SerotoninPillar, string>;
  ritualLabels: Record<SerotoninRitual, { title: string; durationMin: number; description: string }>;
  moodLabels: Record<MoodState, string>;
  allRituals: readonly SerotoninRitual[];
  allMoods: readonly MoodState[];
}

export function SerotoninModePanel({
  session,
  nextPillar,
  nextRitual,
  streakHint,
  onRitual,
  onPillar,
  onMood,
  pillarLabels,
  ritualLabels,
  moodLabels,
  allRituals,
  allMoods,
}: Props) {
  if (!session) {
    return (
      <section className="card card--serotonin card--idle">
        <h2>Modo Control de Serotonina</h2>
        <p>
          Activa el modo para bloquear distracciones (en móvil/escritorio), seguir 6 pilares de
          bienestar y completar rituales breves de calma.
        </p>
      </section>
    );
  }

  return (
    <section className="card card--serotonin">
      <div className="score-row">
        <div>
          <h2>Modo Serotonina activo</h2>
          <p className="muted">{streakHint}</p>
        </div>
        <div className="score" aria-label="Puntuación serotonina">
          <span className="score__value">{session.score}</span>
          <span className="score__label">/ 100</span>
        </div>
      </div>

      {nextPillar && (
        <p className="suggestion">
          Sugerencia: dedica 15 min a <strong>{pillarLabels[nextPillar]}</strong>
        </p>
      )}

      <h3>Pilares de presencia</h3>
      <div className="pillars">
        {session.pillars.map((p) => (
          <div key={p.pillar} className={`pillar ${p.completed ? 'pillar--done' : ''}`}>
            <span>{pillarLabels[p.pillar]}</span>
            <span className="pillar__progress">
              {p.minutes}/{p.targetMinutes} min
            </span>
            {!p.completed && session.active && (
              <button className="btn btn--small" onClick={() => onPillar(p.pillar, 15)}>
                +15 min
              </button>
            )}
          </div>
        ))}
      </div>

      <h3>Rituales guiados</h3>
      <div className="rituals">
        {allRituals.map((ritual) => {
          const meta = ritualLabels[ritual];
          const done = session.completedRituals.includes(ritual);
          return (
            <article key={ritual} className={`ritual ${done ? 'ritual--done' : ''}`}>
              <header>
                <strong>{meta.title}</strong>
                <span>{meta.durationMin} min</span>
              </header>
              <p>{meta.description}</p>
              {!done && session.active && (
                <button
                  className={`btn btn--small ${nextRitual === ritual ? 'btn--primary' : ''}`}
                  onClick={() => onRitual(ritual)}
                >
                  Completar
                </button>
              )}
            </article>
          );
        })}
      </div>

      <h3>Check-in de ánimo</h3>
      <div className="moods">
        {allMoods.map((mood) => (
          <button
            key={mood}
            className="btn btn--mood"
            disabled={!session.active}
            onClick={() => onMood(mood)}
          >
            {moodLabels[mood]}
          </button>
        ))}
      </div>
    </section>
  );
}
