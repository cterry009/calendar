import { AppCard, H2, Paragraph, Text, YStack } from '@calendar/ui';
import type { FitnessCorrelationReport, Suggestion } from '@calendar/shared';

interface FitnessCorrelationPanelProps {
  report: FitnessCorrelationReport;
  suggestions: Suggestion[];
}

export function FitnessCorrelationPanel({ report, suggestions }: FitnessCorrelationPanelProps) {
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

        <YStack gap="$2">
          <Paragraph margin={0}>Sugerencias automaticas</Paragraph>
          {suggestions.length === 0 ? (
            <Paragraph color="$muted" margin={0}>
              Aun no hay suficientes patrones para generar sugerencias.
            </Paragraph>
          ) : (
            suggestions.slice(0, 3).map((suggestion) => (
              <YStack key={`${suggestion.kind}-${suggestion.title}`} gap="$1" padding="$2" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
                <Text fontWeight="700">{suggestion.title}</Text>
                <Text color="$muted">{suggestion.message}</Text>
              </YStack>
            ))
          )}
        </YStack>
      </YStack>
    </AppCard>
  );
}
