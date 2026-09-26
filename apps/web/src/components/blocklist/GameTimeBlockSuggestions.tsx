import { useMemo, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useBlockList } from '../../hooks/useBlockList';
import { useGameTime } from '../../hooks/useGameTime';
import { isDesktop } from '../../lib/desktop';
import { formatNightWindowMinutes, DEFAULT_NIGHT_END_MINUTES, DEFAULT_NIGHT_START_MINUTES } from '../../lib/desktop/nightWindow';
import type { BlockListScope } from '@calendar/shared';
import type { SyncTopGameUsage } from '../../lib/calendar/types';

const MAX_SUGGESTIONS = 5;

// Desktop counterpart of apps/mobile's screen-time.tsx "Sugerencias de bloqueo" panel
// (tasks 7.20/7.21): today's most-used Steam/Riot Client/Battle.net games (task: game-time
// tracking, game_tracking.rs), each addable to the block list with one tap. Same single
// whole-panel scope choice mobile uses (a user picking "block my games" is choosing one strategy
// for all of them at once, not per-suggestion).
//
// A Steam game's `key` is its numeric appid, not a process name -- blocking.rs resolves a
// `steam:<appid>` identifier to the game's real install folder and kills anything running from
// it. Riot/Battle.net entries' `key` is already the matched exe name (game_tracking.rs's
// KNOWN_GAME_PROCESSES table), so it's used as the block-list identifier directly, identical to
// any other DESKTOP_APP entry.
function identifierFor(game: SyncTopGameUsage): string {
  return game.source === 'STEAM' ? `steam:${game.key}` : game.key;
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function GameTimeBlockSuggestions() {
  const gameTime = useGameTime();
  const [blockScope, setBlockScope] = useState<BlockListScope>('FOCUS');
  const blockList = useBlockList('ALL');

  const scopeOptions = useMemo<{ scope: BlockListScope; label: string }[]>(
    () => [
      { scope: 'FOCUS', label: 'Bloqueo total (enfoque)' },
      {
        scope: 'NIGHT',
        label: `Solo de noche (${formatNightWindowMinutes(DEFAULT_NIGHT_START_MINUTES)}-${formatNightWindowMinutes(DEFAULT_NIGHT_END_MINUTES)})`,
      },
    ],
    [],
  );

  // An identifier already blocked in the *selected* scope shouldn't be suggested again; being
  // blocked in the other scope doesn't disqualify it -- FOCUS and NIGHT are independent lists.
  const blockedIdentifiersInScope = useMemo(
    () =>
      new Set(
        blockList.entries
          .filter((entry) => entry.kind === 'DESKTOP_APP' && (entry.scope ?? 'FOCUS') === blockScope)
          .map((entry) => entry.identifier),
      ),
    [blockList.entries, blockScope],
  );

  const suggestions = useMemo(
    () =>
      gameTime.todayUsage
        .filter((game) => !blockedIdentifiersInScope.has(identifierFor(game)))
        .slice(0, MAX_SUGGESTIONS),
    [gameTime.todayUsage, blockedIdentifiersInScope],
  );

  if (!isDesktop) return null;
  if (!gameTime.isLoading && gameTime.todayUsage.length === 0) return null;

  function blockSuggestion(game: SyncTopGameUsage) {
    void blockList.createEntry({
      kind: 'DESKTOP_APP',
      identifier: identifierFor(game),
      label: game.label,
      platform: 'WINDOWS',
      highDopamine: true,
      enabled: true,
      hardMode: false,
      scope: blockScope,
    });
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$5">
            Sugerencias de bloqueo -- tiempo de juego
          </H2>
          <Paragraph margin={0} color="$muted">
            Juegos mas usados hoy (Steam, Riot Client, Battle.net). Agregalos a la lista de
            bloqueo con un toque.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {scopeOptions.map((option) => (
            <AppButton
              key={option.scope}
              type="button"
              variant={blockScope === option.scope ? 'primary' : 'ghost'}
              onPress={() => setBlockScope(option.scope)}
            >
              {option.label}
            </AppButton>
          ))}
        </XStack>

        {gameTime.isLoading ? (
          <Paragraph margin={0} color="$muted">
            Cargando...
          </Paragraph>
        ) : suggestions.length === 0 ? (
          <Paragraph margin={0} color="$muted">
            Nada para sugerir -- ya bloqueaste todo lo jugado hoy en este modo, o todavia no hay
            datos.
          </Paragraph>
        ) : (
          <YStack gap="$2">
            {suggestions.map((game) => (
              <XStack
                key={identifierFor(game)}
                justifyContent="space-between"
                alignItems="center"
                gap="$3"
                flexWrap="wrap"
              >
                <YStack gap="$0">
                  <Text fontWeight="700">{game.label}</Text>
                  <Text fontSize="$2" color="$muted">
                    {formatMinutes(game.minutes)} hoy
                  </Text>
                </YStack>
                <AppButton
                  type="button"
                  variant="primary"
                  disabled={blockList.isMutating}
                  onPress={() => blockSuggestion(game)}
                >
                  Bloquear
                </AppButton>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    </AppCard>
  );
}
