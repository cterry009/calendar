// Mirrors apps/web's lib/onboarding/tours.ts shape (TourStep/TourDefinition, a global tour plus
// one per screen) but a deliberately smaller registry -- mobile doesn't have the calendar grid,
// tasks panel, quick-add, wellness, detox, or ritual screens web's tour covers, so those tours
// don't exist here. Scoped to the six real screens this app has: home ("global"), pomodoro,
// fitness, dashboard, blocklist, habits. Independent completion state and storage key from web's
// tutorial (see storage.ts) -- these are two separate onboarding flows, not a synced setting.
export interface TourStep {
  target: string;
  title: string;
  description: string;
}

export interface TourDefinition {
  steps: TourStep[];
}

export const TOUR_IDS = ['global', 'pomodoro', 'fitness', 'dashboard', 'blocklist', 'habits', 'screen-time'] as const;

export type TourId = (typeof TOUR_IDS)[number];

export const TOURS: Record<TourId, TourDefinition> = {
  global: {
    steps: [
      {
        target: 'home-nav',
        title: 'Navega desde aca',
        description:
          'Estos botones te llevan a Pomodoro, Fitness, Dashboard, tu Lista de bloqueo, tus Habitos y tu Tiempo de pantalla. El calendario de hoy y tu racha se ven directo en esta pantalla.',
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
        target: 'fitness-steps',
        title: 'Pasos de hoy',
        description:
          'En dispositivos con Health Connect, tus pasos se cuentan las 24 horas aunque tengas la app cerrada. Cuando el sensor detecta que estas trotando, se registra un entrenamiento de "Trote" solo -- y si tenes el habito "Deporte / trotar", se marca como cumplido sin que hagas nada.',
      },
      {
        target: 'fitness-floors',
        title: 'Pisos subidos hoy',
        description: 'Calculado con el barometro del telefono mientras la app esta abierta.',
      },
      {
        target: 'fitness-notification',
        title: 'Notificacion de progreso',
        description:
          'Un servicio en segundo plano cuenta tus pasos con el sensor del telefono directamente, sin depender de Health Connect ni de que la app este abierta. La notificacion fija muestra tu progreso hacia la meta diaria, que podes cambiar aca.',
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
        target: 'blocklist-scope-tabs',
        title: 'Dos listas independientes',
        description:
          'Enfoque bloquea durante un pomodoro o un horario de trabajo activo. Nocturna bloquea automaticamente todas las noches de 22:30 a 8:00 -- y si te despertas antes de las 7, sigue bloqueada hasta que salgas a trotar (si la deteccion de actividad esta activa) o hasta las 8:00. Son listas separadas: una app puede estar en una, en la otra, en las dos, o en ninguna.',
      },
      {
        target: 'blocklist-real',
        title: 'Bloqueo real',
        description:
          'Para que las apps bloqueadas se cierren de verdad (no solo aparezcan en una lista), activa el servicio de accesibilidad de esta app en Ajustes de Android. Tambien conviene excluir la app de la optimizacion de bateria, para que Android no cierre el servicio de bloqueo de noche.',
      },
      {
        target: 'blocklist-list',
        title: 'Tu lista',
        description: 'Todo lo que agregaste a la lista activa (Enfoque o Nocturna, segun la pestana elegida arriba).',
      },
      {
        target: 'blocklist-apps',
        title: 'Apps instaladas',
        description: 'Carga la lista real de apps de este dispositivo y elegi cuales bloquear con un toque -- se agregan a la lista activa.',
      },
    ],
  },
  habits: {
    steps: [
      {
        target: 'habits-today',
        title: 'Tus habitos de hoy',
        description:
          'Marca Si o No para cada habito. Si le configuraste un horario de recordatorio, tambien te va a llegar una notificacion con esos mismos botones para responder sin abrir la app.',
      },
      {
        target: 'habits-templates',
        title: 'Plantillas rapidas',
        description:
          'Un toque para agregar habitos comunes con su horario ya configurado: despertarte antes de las 7, arreglarte, deporte/trotar (vinculado a la deteccion automatica de trote), sacar al perro, horario de trabajo y de estudio, y socializar.',
      },
      {
        target: 'habits-create',
        title: 'Agregar un habito propio',
        description: 'Si ninguna plantilla te sirve, crea el tuyo con su propia meta diaria.',
      },
    ],
  },
  'screen-time': {
    steps: [
      {
        target: 'screen-time-access',
        title: 'Acceso a datos de uso',
        description:
          'Este permiso solo se puede activar desde Ajustes de Android (no se puede pedir con un dialogo normal). Una vez activado, esta pantalla puede leer cuanto tiempo usas cada app.',
      },
      {
        target: 'screen-time-today',
        title: 'Hoy',
        description: 'Tiempo en primer plano de cada app desde la medianoche, de mayor a menor.',
      },
      {
        target: 'screen-time-week',
        title: 'Apps mas usadas',
        description: 'Lo mismo, pero sumado sobre los ultimos 7 dias -- para ver tus habitos de uso reales, no solo el dia de hoy.',
      },
      {
        target: 'screen-time-suggestions',
        title: 'Sugerencias de bloqueo',
        description:
          'Detecta redes sociales y apps de video conocidas entre tus apps mas usadas. Elegi si querer bloquearlas indefinidamente (lista de Enfoque) o solo de noche (22:30-8:00), y agregalas con un toque.',
      },
    ],
  },
};
