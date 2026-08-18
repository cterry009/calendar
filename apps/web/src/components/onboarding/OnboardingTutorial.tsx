import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface TutorialSection {
  title: string;
  description: string;
}

interface OnboardingTutorialProps {
  open: boolean;
  onFinish: () => void;
}

const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    title: 'El calendario es el centro',
    description:
      'Todo pasa desde ahi: horarios de trabajo y descanso, tareas, pomodoros y bloqueo de distracciones. Usa los iconos de la barra superior para abrir Dashboard, Sugerencias, Pomodoro, Bloqueo, Fitness, Detox o el Ritual diario como paneles, sin salir del calendario.',
  },
  {
    title: 'Horarios de trabajo y descanso',
    description:
      'Boton "Horarios" arriba del calendario. Un horario de Trabajo y uno de Descanso por dia alcanza para empezar -- son la base que usa el calendario para organizar tareas, fitness y bloqueo.',
  },
  {
    title: 'Tareas y pomodoros automaticos',
    description:
      'En la vista Dia, cada bloque de trabajo tiene una casilla para escribir la tarea directamente ahi (ej. "Preparar informe 3 pomodoros"). La app divide tu jornada en bloques de pomodoro con descansos solos, y ajusta la duracion sugerida con el tiempo segun cuanto te concentras de verdad.',
  },
  {
    title: 'Bloqueo durante el trabajo',
    description:
      'Mientras un horario de Trabajo esta activo, se activa automaticamente una pantalla de enfoque con tu lista de distracciones a evitar. Configura que apps, sitios o programas quieres evitar en el panel de Bloqueo.',
  },
  {
    title: 'Bienestar diario y plan de detox',
    description:
      'Rituales, pilares de presencia y el plan de desintoxicacion de 7 dias corren siempre, sin activarlos aparte -- no son un modo que prendes y apagas.',
  },
  {
    title: 'Ritual diario',
    description:
      'Panel "Ritual diario": una revision matutina para darle horario a tus tareas pendientes, y un cierre nocturno para marcar lo que avanzaste y postergar el resto.',
  },
];

export function OnboardingTutorial({ open, onFinish }: OnboardingTutorialProps) {
  if (!open) {
    return null;
  }

  return (
    <YStack position="fixed" top={0} left={0} right={0} bottom={0} zIndex={1000} pointerEvents="box-none">
      <YStack position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.55)" />

      <YStack flex={1} padding="$6" justifyContent="center" alignItems="center" pointerEvents="box-none">
        <AppCard width="min(720px, 96vw)" maxHeight="86vh" overflow="scroll">
          <YStack gap="$4">
            <YStack gap="$1">
              <Text color="$muted" fontSize="$2">
                Guia rapida
              </Text>
              <H2 margin={0}>Como funciona la app</H2>
            </YStack>

            <YStack gap="$4">
              {TUTORIAL_SECTIONS.map((section) => (
                <YStack key={section.title} gap="$1">
                  <Text fontWeight="700">{section.title}</Text>
                  <Paragraph margin={0} color="$muted">
                    {section.description}
                  </Paragraph>
                </YStack>
              ))}
            </YStack>

            <XStack justifyContent="flex-end">
              <AppButton type="button" variant="primary" onPress={onFinish}>
                Entendido, empezar
              </AppButton>
            </XStack>
          </YStack>
        </AppCard>
      </YStack>
    </YStack>
  );
}
