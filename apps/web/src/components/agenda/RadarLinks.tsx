import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { isDesktop } from '../../lib/desktop';
import { openExternalPage } from '../../lib/desktop/openPage';
import { StripeCard } from './parts';

// The radars and the reading log (Claude artifacts). They open as the live pages for now; loading
// them inside the app comes next (snapshot of their data).
export const RADAR_PAGES = [
  {
    title: 'Radar de maestrías',
    url: 'https://claude.ai/artifact/KY1hkR6gbT7BsEE4PUuxXZ',
    note: 'La página del radar diario: pocas cartas, procesos estocásticos, fechas de cierre, tus marcas.',
    color: '#c43a3a',
  },
  {
    title: 'Radar de investigadores – PINNs y control estocástico',
    url: 'https://claude.ai/artifact/C5kYThpi8dCNjefVegyhKw',
    note: 'Personas, papers nuevos de la semana y la sección «Para el paper».',
    color: '#2d56c8',
  },
  {
    title: 'Bitácora de lectura PINN',
    url: 'https://claude.ai/artifact/FK2tX6g1oYNtiCSZTxBcVr',
    note: 'Los papers del radar por nivel de lectura; cada nota sube si respondes bien la pregunta.',
    color: '#9b3fb5',
  },
  {
    title: 'Radar de maestrías – documento',
    url: 'https://claude.ai/artifact/PMJJXgtoU9TNJnSLNCvdLA',
    note: 'El documento de la primera corrida (2026-11-08).',
    color: '#6b5b2e',
  },
];

export function RadarLinks({ only }: { only?: string[] }) {
  const pages = RADAR_PAGES.filter((p) => !only || only.includes(p.title));
  return (
    <YStack gap="$2">
      <Paragraph margin={0} size="$2" color="$muted">
        {isDesktop ? 'Se abren en una ventana de la app.' : 'Se abren en una pestaña nueva.'}
      </Paragraph>
      <XStack gap="$3" flexWrap="wrap">
        {pages.map((p) => (
          <YStack key={p.url} flexBasis={300} flexGrow={1} maxWidth={520}>
            <StripeCard color={p.color}>
              <Text fontWeight="700">{p.title}</Text>
              <Paragraph margin={0} size="$2" color="$muted">
                {p.note}
              </Paragraph>
              <AppButton variant="small" alignSelf="flex-start" onPress={() => void openExternalPage(p.url, p.title)}>
                Abrir
              </AppButton>
            </StripeCard>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}
