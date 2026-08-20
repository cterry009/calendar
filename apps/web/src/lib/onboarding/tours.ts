import type { PanelId } from '../../context/PanelContext';

export interface TourStep {
  target: string;
  title: string;
  description: string;
}

export interface TourDefinition {
  // Panel that must be open for this tour's targets to exist in the DOM.
  // `null` means the tour lives on the calendar hub page -- any open panel
  // gets closed before the tour starts so its targets aren't hidden behind it.
  panel: PanelId | null;
  steps: TourStep[];
}

export const TOUR_IDS = ['global', 'calendar', 'tasks', 'pomodoro', 'blocklist', 'wellness', 'habits', 'detox'] as const;

export type TourId = (typeof TOUR_IDS)[number];

export const TOURS: Record<TourId, TourDefinition> = {
  global: {
    panel: null,
    steps: [
      {
        target: 'app-nav',
        title: 'El calendario es el centro',
        description:
          'Todo pasa desde ahi: horarios, tareas, pomodoros y bloqueo de distracciones. Los iconos de arriba abren cada seccion como un panel, sin salir nunca del calendario.',
      },
      {
        target: 'calendar-hero',
        title: 'Tu calendario',
        description: 'Vista de dia, semana o mes. Selecciona un dia y la barra derecha se filtra a lo que corresponde a ese dia.',
      },
      {
        target: 'schedule-header',
        title: 'Horarios de trabajo y descanso',
        description:
          'Un horario de Trabajo y uno de Descanso por dia alcanza para empezar -- son la base que usa el calendario para organizar tareas, fitness y bloqueo.',
      },
      {
        target: 'tasks-header',
        title: 'Tareas del dia',
        description: 'Vista compacta de las tareas programadas para el dia seleccionado: marcalas, edita o inicia un pomodoro directo desde aca.',
      },
      {
        target: 'nav-quick-add',
        title: 'Captura rapida',
        description:
          'Presiona la tecla "Q" en cualquier momento (o este boton) para anotar una tarea con lenguaje natural, ej. "Preparar informe 3 pomodoros" -- sin necesidad de elegir fecha ni estimacion.',
      },
      {
        target: 'nav-blocklist',
        title: 'Bloqueo durante el trabajo',
        description:
          'Mientras un horario de Trabajo esta activo se activa una pantalla de enfoque con tu lista de distracciones. Configura apps, sitios y programas aca, incluyendo modo estricto para las que no queres poder desactivar a mitad de sesion.',
      },
      {
        target: 'nav-wellness',
        title: 'Bienestar diario',
        description: 'Pilares de presencia, rituales y tentaciones evitadas corren siempre, sin activarlos aparte -- no es un modo que prendes y apagas.',
      },
      {
        target: 'nav-detox',
        title: 'Plan de desintoxicacion',
        description: 'Programa guiado de 7 dias para reducir dependencia de estimulos de alta dopamina, con auditoria inicial y progreso por fase.',
      },
      {
        target: 'nav-habits',
        title: 'Habitos',
        description: 'Segui habitos con un score que crece con la constancia, no con rachas perfectas -- un dia salteado explicitamente no penaliza.',
      },
      {
        target: 'nav-ritual',
        title: 'Ritual diario',
        description: 'Una revision matutina para darle horario a tus tareas pendientes, y un cierre nocturno para marcar lo que avanzaste.',
      },
    ],
  },
  calendar: {
    panel: null,
    steps: [
      {
        target: 'calendar-hero',
        title: 'Vistas del calendario',
        description: 'Cambia entre dia, semana y mes. La vista de dia divide cada horario de trabajo en bloques de pomodoro y descanso automaticamente.',
      },
      {
        target: 'schedule-header',
        title: 'Horarios',
        description:
          'Crea un horario de Trabajo (define cuando se activa el bloqueo y se dividen los pomodoros) y uno de Descanso. Un mismo horario puede cubrir varios dias de la semana a la vez.',
      },
    ],
  },
  tasks: {
    panel: null,
    steps: [
      {
        target: 'tasks-header',
        title: 'Tareas del dia seleccionado',
        description:
          'Se filtran automaticamente al dia que elegiste en el calendario (hoy por defecto). Toca el circulo para completar, el titulo para editar, o la flecha para iniciar un pomodoro vinculado.',
      },
      {
        target: 'nav-quick-add',
        title: 'Captura rapida ("Q")',
        description:
          'La forma mas rapida de anotar una tarea: presiona "Q" desde cualquier pantalla (deshabilitado mientras escribis en un campo) o toca este boton. Entiende frases como "Escribir informe 2 pomodoros".',
      },
      {
        target: 'day-work-block',
        title: 'Captura desde el bloque de trabajo',
        description: 'En la vista Dia, cada bloque de trabajo tiene su propia casilla para escribir una tarea directo ahi, sin salir del calendario.',
      },
    ],
  },
  pomodoro: {
    panel: 'pomodoro',
    steps: [
      {
        target: 'pomodoro-streak',
        title: 'Racha de pomodoros',
        description:
          'Cuenta dias seguidos con al menos un pomodoro completado. Perdona hasta 2 dias salteados con tokens de gracia antes de reiniciar la racha, en vez de resetear al primer dia perdido.',
      },
      {
        target: 'pomodoro-task-select',
        title: 'Vincula una tarea',
        description: 'Elegi una tarea pendiente o en progreso para que el pomodoro quede asociado a ella, mejorando la trazabilidad de tu tiempo.',
      },
      {
        target: 'pomodoro-timer',
        title: 'Temporizador',
        description: 'Foco, descanso corto y descanso largo se alternan solos. Mientras un pomodoro esta activo, la pantalla de enfoque bloquea tus distracciones configuradas.',
      },
    ],
  },
  blocklist: {
    panel: 'blocklist',
    steps: [
      {
        target: 'blocklist-header',
        title: 'Lista de distracciones',
        description: 'Apps, sitios web y programas de escritorio que queres evitar durante pomodoros, horarios de trabajo o modo enfoque manual.',
      },
      {
        target: 'blocklist-new-entry',
        title: 'Modo estricto',
        description:
          'Al crear o editar una entrada podes activar "modo estricto": una vez prendido, no se puede apagar ni borrar la entrada sin una confirmacion explicita y separada -- pensado para las distracciones que de verdad te cuesta evitar.',
      },
      {
        target: 'blocklist-triggers',
        title: 'Condiciones de activacion',
        description:
          'Ademas de un pomodoro o un horario activo, el bloqueo se puede activar por ubicacion (se evalua en tiempo real en el navegador) o por red Wi-Fi (guardado como especificacion para las apps nativas de Android/Windows, que son las unicas que pueden leer la red conectada).',
      },
    ],
  },
  wellness: {
    panel: 'wellness',
    steps: [
      {
        target: 'wellness-header',
        title: 'Bienestar diario',
        description: 'Corre siempre en segundo plano, sin necesidad de activarlo -- una sesion nueva arranca sola cada dia.',
      },
      {
        target: 'wellness-panel',
        title: 'Pilares, rituales y tentaciones evitadas',
        description:
          'Registra pilares de presencia y rituales (la respiracion 4-7-8 corre una pausa guiada real, no un solo toque). El puntaje tambien suma las veces que decidiste volver al enfoque en vez de romper un bloqueo activo -- tentaciones evitadas de verdad, no un contador simulado.',
      },
    ],
  },
  habits: {
    panel: 'habits',
    steps: [
      {
        target: 'habits-header',
        title: 'Habitos',
        description: 'Segui habitos positivos o negativos con un score que premia la constancia real, no las rachas perfectas.',
      },
      {
        target: 'habits-list',
        title: 'Registro del dia',
        description:
          'Marca cada habito como hecho o saltealo con un motivo explicito -- un dia salteado a proposito no penaliza tu score, pero un dia sin registrar si.',
      },
    ],
  },
  detox: {
    panel: 'detox',
    steps: [
      {
        target: 'detox-header',
        title: 'Plan de desintoxicacion',
        description: 'Programa guiado de 7 dias: auditoria inicial, reduccion selectiva, reintroduccion con limites y mantenimiento.',
      },
      {
        target: 'detox-progress',
        title: 'Tu progreso por fase',
        description: 'Muestra en que dia y fase del plan estas, con la checklist diaria y los rituales/pilares sugeridos para hoy.',
      },
    ],
  },
};
