import { AppButton, AppCard, H2, Paragraph, Text, YStack } from '@calendar/ui';
import type { FitnessCorrelationReport } from '@calendar/shared';

interface FitnessCorrelationPanelProps {
  report: FitnessCorrelationReport;
  onOpenSuggestions: () => void;
}

export function FitnessCorrelationPanel({ report, onOpenSuggestions }: FitnessCorrelationPanelProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Correlacion fitness-productividad
          </H2>
          <Paragraph color="$muted" margin={0}>
            Relacion entre dias con ejercicio y resultados en tareas/pomodoros.
          </Paragraph>
        </YStack>

        <YStack gap="$2">
          <Text>
            Dias de muestra: {report.sampleDays} · Dias con ejercicio: {report.exerciseDays} · Dias sin ejercicio: {report.restDays}
          </Text>
          <Text color="$muted">
            Tareas por dia con ejercicio: {report.avgTasksOnExerciseDays} · sin ejercicio: {report.avgTasksOnRestDays}
          </Text>
          <Text color="$muted">
            Pomodoros por dia con ejercicio: {report.avgPomodorosOnExerciseDays} · sin ejercicio: {report.avgPomodorosOnRestDays}
          </Text>
          <Text color={report.insight === 'positive' ? '$accent' : '$muted'}>{report.message}</Text>
        </YStack>

        <AppButton type="button" variant="ghost" onPress={onOpenSuggestions}>
          Ver todas las sugerencias
        </AppButton>
      </YStack>
    </AppCard>
  );
}
