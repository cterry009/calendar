import { useEffect, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface TutorialStep {
  title: string;
  description: string;
  tip: string;
}

interface OnboardingTutorialProps {
  open: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Bienvenida',
    description: 'Esta app te ayuda a planificar tareas, calendario y descansos en un solo lugar.',
    tip: 'Empieza por revisar la pagina de inicio y tus atajos principales.',
  },
  {
    title: 'Autenticacion y sincronizacion',
    description: 'Con tu cuenta activa, los cambios se sincronizan entre dispositivos desde el endpoint de sync.',
    tip: 'Si algo no aparece, usa el boton de refrescar en cada modulo.',
  },
  {
    title: 'Tareas',
    description: 'Crea tareas con dificultad, complejidad y tiempo estimado para mejorar tu precision.',
    tip: 'Al completar una tarea, registra minutos reales para tus metricas.',
  },
  {
    title: 'Calendario y horarios',
    description: 'Combina vistas de calendario con bloques recurrentes de trabajo y descanso por dia.',
    tip: 'Configura horarios en la pagina Horarios para crear una semana repetible.',
  },
  {
    title: 'Modo serotonina',
    description: 'Activa un flujo de baja estimulacion para rituales, pilares y seguimiento de estado de animo.',
    tip: 'Usalo en bloques cortos para mantener constancia sin saturarte.',
  },
  {
    title: 'Finalizar',
    description: 'Ya conoces el recorrido principal. Puedes volver a abrir este tutorial cuando quieras.',
    tip: 'Siguiente paso recomendado: crea tu primer horario semanal.',
  },
];

export function OnboardingTutorial({ open, onFinish, onSkip }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const step = TUTORIAL_STEPS[currentStep];
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;

  return (
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={1000}
      backgroundColor="rgba(0,0,0,0.6)"
      padding="$6"
      justifyContent="center"
      alignItems="center"
    >
      <AppCard width="min(760px, 96vw)">
        <YStack gap="$4">
          <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
            <YStack gap="$1">
              <Text color="$muted" fontSize="$2">
                Tutorial guiado · Paso {currentStep + 1} de {TUTORIAL_STEPS.length}
              </Text>
              <H2 margin={0}>{step.title}</H2>
            </YStack>
            <AppButton type="button" variant="ghost" onPress={onSkip}>
              Omitir tutorial
            </AppButton>
          </XStack>

          <Paragraph margin={0}>{step.description}</Paragraph>

          <AppCard backgroundColor="rgba(255,255,255,0.04)">
            <Paragraph margin={0} color="$muted">
              Tip: {step.tip}
            </Paragraph>
          </AppCard>

          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
            <AppButton
              type="button"
              variant="ghost"
              onPress={() => setCurrentStep((value) => Math.max(value - 1, 0))}
              disabled={currentStep === 0}
            >
              Anterior
            </AppButton>

            {isLast ? (
              <AppButton type="button" variant="primary" onPress={onFinish}>
                Finalizar tutorial
              </AppButton>
            ) : (
              <AppButton
                type="button"
                variant="primary"
                onPress={() => setCurrentStep((value) => Math.min(value + 1, TUTORIAL_STEPS.length - 1))}
              >
                Siguiente
              </AppButton>
            )}
          </XStack>
        </YStack>
      </AppCard>
    </YStack>
  );
}
