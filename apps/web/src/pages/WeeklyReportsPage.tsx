import { useCallback, useEffect, useState } from 'react';
import { AppButton, Paragraph, XStack, YStack } from '@calendar/ui';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { apiFetch, apiFetchText } from '../lib/api';
import { todayKey } from '../lib/habits/today';

interface WeekRow {
  weekStart: string;
  sentAt: string | null;
}

/** "2026-11-02" -> "2 nov". */
function shortDate(key: string): string {
  const [, month, day] = key.split('-').map(Number);
  return `${day} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month - 1]}`;
}

// Reportes → Semana (weekend-mode): the Sunday presentation, this week's so far and the past ones.
// The server renders it (weekly-report/presentation.ts) so it's the same file as the email's
// attachment; it needs the token, so it's fetched and shown with srcDoc instead of a plain URL.
export function WeeklyReportsPage() {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selected, setSelected] = useState<string>(todayKey());
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (week: string) => {
    setIsLoading(true);
    setError(null);
    try {
      setHtml(await apiFetchText(`/weekly-reports/${week}/presentation`));
      setWeeks((await apiFetch<{ weeks: WeekRow[] }>('/weekly-reports')).weeks);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'No se pudo cargar el reporte.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selected);
  }, [load, selected]);

  async function downloadCsv() {
    const csv = await apiFetchText(`/weekly-reports/${selected}/csv`);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `semana-${selected}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Reportes"
        title="Tu semana"
        description="La presentación del domingo: lo más relevante de cada semana, comparado con la anterior."
        maxWidth={780}
        actions={
          <AppButton type="button" variant="ghost" onPress={() => void downloadCsv()} disabled={isLoading}>
            Descargar CSV
          </AppButton>
        }
      />
      <XStack gap="$2" flexWrap="wrap">
        <AppButton type="button" variant={selected === todayKey() ? 'primary' : 'ghost'} onPress={() => setSelected(todayKey())}>
          Esta semana
        </AppButton>
        {weeks.map((week) => (
          <AppButton
            key={week.weekStart}
            type="button"
            variant={selected === week.weekStart ? 'primary' : 'ghost'}
            onPress={() => setSelected(week.weekStart)}
          >
            {shortDate(week.weekStart)}
          </AppButton>
        ))}
      </XStack>
      {error ? <StatusCard tone="error" message={error} /> : null}
      {isLoading && !html ? <StatusCard tone="loading" message="Armando la semana..." /> : null}
      {html ? (
        <iframe title="Presentación de la semana" srcDoc={html} sandbox="allow-scripts" style={{ width: '100%', height: 720, border: 0, borderRadius: 16 }} />
      ) : !isLoading && !error ? (
        <Paragraph color="$muted">Todavía no hay datos.</Paragraph>
      ) : null}
    </YStack>
  );
}
