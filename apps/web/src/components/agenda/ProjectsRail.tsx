import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey, projectsNeedingAttention } from '@calendar/shared';
import { Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useToday } from '../../hooks/useNow';
import { areaLabel } from '../../lib/projects/areas';
import { byPriority, PRIORITY_LABEL } from '../../lib/projects/order';
import { Pill } from './parts';

// 2026-11-10: the right-hand rail of the projects pages -- every open project with its priority,
// alta first; a click opens the project's page.

const TONE = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'muted' } as const;

export function ProjectsRail({ currentId }: { currentId?: string }) {
  const data = useCalendarData();
  const today = useToday();
  const navigate = useNavigate();
  const attention = useMemo(
    () =>
      new Set(
        projectsNeedingAttention(data.projects, data.projectLogEntries.map((l) => ({ ...l, date: l.date.slice(0, 10) })), localDateKey(today)).map((a) => a.projectId),
      ),
    [data.projects, data.projectLogEntries, today],
  );
  const list = data.projects.filter((p) => p.status !== 'DONE').sort(byPriority(attention));

  return (
    <YStack flexGrow={0} flexShrink={0} flexBasis={280} width={280} gap="$1" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4" backgroundColor="$surface" alignSelf="flex-start" style={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
      <Text fontSize={12} fontWeight="700" letterSpacing={1.2} color="$muted" textTransform="uppercase" marginBottom="$1">
        Proyectos por prioridad
      </Text>
      {list.map((p, i) => {
        const header = i === 0 || list[i - 1].priority !== p.priority;
        const selected = p.id === currentId;
        return (
          <YStack key={p.id} gap="$1">
            {header ? (
              <Text fontSize="$2" fontWeight="700" color={`$${TONE[p.priority]}` as never} marginTop={i === 0 ? 0 : '$2'}>
                Prioridad {PRIORITY_LABEL[p.priority].toLowerCase()}
              </Text>
            ) : null}
            <XStack
              gap="$2"
              alignItems="center"
              padding="$2"
              borderRadius="$2"
              borderLeftWidth={3}
              borderLeftColor={p.color ?? '$accent'}
              backgroundColor={selected ? '$accentBackground' : 'transparent'}
              hoverStyle={{ backgroundColor: '$surfaceHover' }}
              cursor="pointer"
              role="link"
              aria-current={selected ? 'page' : undefined}
              onPress={() => navigate(`/proyectos/${p.id}`)}
            >
              <YStack flex={1} minWidth={0}>
                <Text fontSize="$3" fontWeight={selected ? '700' : '500'} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text fontSize="$1" color="$muted">
                  {areaLabel(p.area)}
                  {attention.has(p.id) ? ' · pide atención' : ''}
                </Text>
              </YStack>
              <Pill tone={TONE[p.priority]}>{PRIORITY_LABEL[p.priority]}</Pill>
            </XStack>
          </YStack>
        );
      })}
    </YStack>
  );
}
