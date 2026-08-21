// Mirrors apps/web's lib/onboarding/tours.ts shape (TourStep/TourDefinition, a global tour plus
// one per screen) but a deliberately smaller registry -- mobile doesn't have the calendar grid,
// tasks panel, quick-add, wellness, habits, detox, or ritual screens web's tour covers, so those
// tours don't exist here. Scoped to the five real screens this app has: home ("global"), pomodoro,
// fitness, dashboard, blocklist. Independent completion state and storage key from web's tutorial
// (see storage.ts) -- these are two separate onboarding flows, not a synced setting.
export interface TourStep {
  target: string;
  title: string;
  description: string;
}

export interface TourDefinition {
  steps: TourStep[];
}

export const TOUR_IDS = ['global', 'pomodoro', 'fitness', 'dashboard', 'blocklist'] as const;

export type TourId = (typeof TOUR_IDS)[number];

export const TOURS: Record<TourId, TourDefinition> = {
  global: {
    steps: [
      {
        target: 'home-nav',
        title: 'Navega desde aca',
        description:
          'Estos cuatro botones te llevan a Pomodoro, Fitness, Dashboard y tu Lista de bloqueo. El calendario de hoy y tu racha se ven directo en esta pantalla.',
      },
      {
        target: 'home-tasks',
        title: 'Tareas de hoy',
        description: 'Se filtran automaticamente al dia de hoy. Toca el circulo para marcarlas como completadas.',
      },
      {
        target: 'home-schedule',
        title: 'Horario de hoy',
        description: 'Tus horarios de trabajo y descanso activos hoy -- se configuran desde la version web por ahora.',
      },
      {
        target: 'home-streak',
        title: 'Racha de pomodoros',
        description: 'Cuenta cuantos dias seguidos completaste al menos un pomodoro.',
      },
    ],
  },
  pomodoro: {
    steps: [
      {
        target: 'pomodoro-timer',
        title: 'Temporizador',
        description:
          'Foco, descanso corto y descanso largo se alternan solos. Mientras un pomodoro de foco esta activo, tu lista de bloqueo se activa automaticamente.',
      },
      {
        target: 'pomodoro-notifications',
        title: 'Notificaciones',
        description: 'Activalas para enterarte cuando termina cada fase, aunque tengas la app en segundo plano.',
      },
    ],
  },
  fitness: {
    steps: [
      {
        target: 'fitness-summary',
        title: 'Resumen de hoy',
        description: 'Minutos totales y cantidad de sesiones que registraste hoy.',
      },
      {
        target: 'fitness-list',
        title: 'Tus registros',
        description: 'Cada entrada que agregues aparece aca, con su tipo, duracion e intensidad. Desliza para borrar una.',
      },
    ],
  },
  dashboard: {
    steps: [
      {
        target: 'dashboard-metrics',
        title: 'Metricas de la semana',
        description: 'Tareas completadas, pomodoros y horas de enfoque, comparado con la semana pasada.',
      },
      {
        target: 'dashboard-focus-chart',
        title: 'Enfoque por dia',
        description: 'Tus ultimos 14 dias de horas de enfoque, para ver la tendencia de un vistazo.',
      },
    ],
  },
  blocklist: {
    steps: [
      {
        target: 'blocklist-real',
        title: 'Bloqueo real',
        description:
          'Para que las apps bloqueadas se cierren de verdad durante un enfoque (no solo aparezcan en una lista), activa el servicio de accesibilidad de esta app en Ajustes de Android.',
      },
      {
        target: 'blocklist-list',
        title: 'Tu lista',
        description: 'Todo lo que agregaste para bloquear durante pomodoros, tareas u horarios de trabajo activos.',
      },
      {
        target: 'blocklist-apps',
        title: 'Apps instaladas',
        description: 'Carga la lista real de apps de este dispositivo y elegi cuales bloquear con un toque.',
      },
    ],
  },
};
