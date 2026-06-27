import { useEffect, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface TutorialStep {
  title: string;
  description: string;
  tip: string;
  route?: string;
  highlightTarget?: string;
  actionLabel?: string;
}

interface OnboardingTutorialProps {
  open: boolean;
  currentPath: string;
  pendingRoute: string | null;
  onNavigate: (route: string) => void;
  onFinish: () => void;
  onSkip: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Bienvenida',
    description: 'Esta app te ayuda a planificar tareas, calendario, descansos y bienestar digital en un solo lugar.',
    tip: 'Empieza por revisar la pagina de inicio y tus atajos principales.',
    route: '/',
    highlightTarget: '[data-tutorial="home-hero"]',
  },
  {
    title: 'Tareas con estimacion',
    description: 'Crea tareas con dificultad, complejidad y tiempo estimado para mejorar tu precision.',
    tip: 'Al completar una tarea, registra minutos reales para tus metricas.',
    route: '/tasks',
    highlightTarget: '[data-tutorial="tasks-header"]',
    actionLabel: 'Ir a tareas',
  },
  {
    title: 'Calendario y horarios',
    description: 'Combina vistas de calendario con bloques recurrentes de trabajo y descanso por dia.',
    tip: 'Configura horarios en la pagina Horarios para crear una semana repetible.',
    route: '/schedule',
    highlightTarget: '[data-tutorial="schedule-header"]',
    actionLabel: 'Ir a horarios',
  },
  {
    title: 'Plan de desintoxicacion',
    description:
      'El plan de 7 dias guia la reduccion selectiva de estimulos digitales con checklist diaria y horarios por intensidad.',
    tip: 'Completa la auditoria base el dia 1 antes de avanzar.',
    route: '/detox',
    highlightTarget: '[data-tutorial="detox-header"]',
    actionLabel: 'Ver plan detox',
  },
  {
    title: 'Modo serotonina',
    description: 'Activa un flujo de baja estimulacion para rituales, pilares y seguimiento de estado de animo.',
    tip: 'Usalo en bloques cortos para mantener constancia sin saturarte.',
    route: '/',
    highlightTarget: '[data-tutorial="serotonin-mode"]',
    actionLabel: 'Volver al inicio',
  },
  {
    title: 'Sincronizacion en tiempo real',
    description:
      'Con tu cuenta activa, los cambios se sincronizan entre dispositivos. Si pierdes conexion, la cola local guarda tus cambios.',
    tip: 'Los datos offline se envian automaticamente al reconectar.',
    route: '/',
  },
  {
    title: 'Listo para empezar',
    description: 'Ya conoces el recorrido principal. Puedes volver a abrir este tutorial cuando quieras.',
    tip: 'Siguiente paso recomendado: inicia el plan de desintoxicacion o crea tu primer horario semanal.',
    route: '/detox',
    actionLabel: 'Iniciar plan detox',
  },
];

function getHighlightRect(selector?: string): DOMRect | null {
  if (!selector || typeof document === 'undefined') {
    return null;
  }

  const element = document.querySelector(selector);
  return element ? element.getBoundingClientRect() : null;
}

export function OnboardingTutorial({
  open,
  currentPath,
  pendingRoute,
  onNavigate,
  onFinish,
  onSkip,
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const isOnStepRoute = !step.route || currentPath === step.route;
  const isNavigating = Boolean(pendingRoute && pendingRoute !== currentPath);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setHighlightRect(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updateHighlight = () => {
      setHighlightRect(getHighlightRect(step.highlightTarget));
    };

    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [open, step.highlightTarget, currentPath, currentStep]);

  useEffect(() => {
    if (!open || !step.route || currentPath === step.route) {
      return;
    }

    onNavigate(step.route);
  }, [open, step.route, currentPath, onNavigate]);

  if (!open) {
    return null;
  }

  function goToStep(nextStep: number) {
    const target = TUTORIAL_STEPS[nextStep];
    setCurrentStep(nextStep);
    if (target.route && target.route !== currentPath) {
      onNavigate(target.route);
    }
  }

  return (
    <YStack position="fixed" top={0} left={0} right={0} bottom={0} zIndex={1000} pointerEvents="box-none">
      <YStack position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.55)" />

      {highlightRect ? (
        <YStack
          position="absolute"
          top={highlightRect.top - 8}
          left={highlightRect.left - 8}
          width={highlightRect.width + 16}
          height={highlightRect.height + 16}
          borderWidth={2}
          borderColor="$primary"
          borderRadius="$4"
          pointerEvents="none"
          zIndex={1001}
        />
      ) : null}

      <YStack flex={1} padding="$6" justifyContent="center" alignItems="center" pointerEvents="box-none">
        <AppCard width="min(760px, 96vw)" zIndex={1002}>
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

            {isNavigating ? (
              <Paragraph margin={0} color="$muted">
                Navegando a la seccion del tutorial...
              </Paragraph>
            ) : null}

            <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
              <AppButton
                type="button"
                variant="ghost"
                onPress={() => goToStep(Math.max(currentStep - 1, 0))}
                disabled={currentStep === 0}
              >
                Anterior
              </AppButton>

              <XStack gap="$2" flexWrap="wrap">
                {step.actionLabel && step.route && !isOnStepRoute ? (
                  <AppButton type="button" variant="ghost" onPress={() => onNavigate(step.route!)}>
                    {step.actionLabel}
                  </AppButton>
                ) : null}

                {isLast ? (
                  <AppButton type="button" variant="primary" onPress={onFinish}>
                    Finalizar tutorial
                  </AppButton>
                ) : (
                  <AppButton
                    type="button"
                    variant="primary"
                    onPress={() => goToStep(Math.min(currentStep + 1, TUTORIAL_STEPS.length - 1))}
                    disabled={isNavigating}
                  >
                    Siguiente
                  </AppButton>
                )}
              </XStack>
            </XStack>
          </YStack>
        </AppCard>
      </YStack>
    </YStack>
  );
}
