import { AppButton, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { SectionTitle, StripeCard } from '../components/agenda/parts';
import { isDesktop } from '../lib/desktop';
import { openExternalPage } from '../lib/desktop/openPage';

// 2026-11-09: the radars and the reading log exactly as they are in their Claude conversations. Their
// data lives in each artifact's own database, so they open as the live pages (an app window on the
// desktop, signed in to claude.ai once); research-tracking brings the same data into the calendar.

const PAGES = [
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

export function InvestigacionPage() {
  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4" maxWidth={1240} width="100%" alignSelf="center">
      <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
        Investigación
      </H1>
      <Paragraph margin={0} color="$muted">
        Maestrías, investigadores y lecturas tal como están en sus conversaciones.{' '}
        {isDesktop ? 'Se abren en una ventana de la app; la primera vez inicia sesión en Claude.' : 'Se abren en una pestaña nueva.'}
      </Paragraph>
      <SectionTitle>Radares y bitácora</SectionTitle>
      <XStack gap="$3" flexWrap="wrap">
        {PAGES.map((p) => (
          <YStack key={p.url} flexBasis={320} flexGrow={1} maxWidth={560}>
            <StripeCard color={p.color}>
              <Text fontWeight="700" fontSize="$5">
                {p.title}
              </Text>
              <Paragraph margin={0} size="$2" color="$muted">
                {p.note}
              </Paragraph>
              <AppButton variant="primary" alignSelf="flex-start" onPress={() => void openExternalPage(p.url, p.title)}>
                Abrir
              </AppButton>
            </StripeCard>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}
