import { Paragraph, Text, YStack } from '@calendar/ui';
import { SectionTitle, StripeCard } from './parts';

// research-tracking (2026-11-09): until the research tables and the local radars exist, this tab points
// to what the daily radars already produce, so nothing has to be looked up elsewhere.

const LINKS = [
  { title: 'Radar de maestrías – procesos estocásticos', url: 'https://claude.ai/artifact/PMJJXgtoU9TNJnSLNCvdLA', note: 'Documento diario: pocas cartas, procesos estocásticos, fechas de cierre.' },
  { title: 'Radar de maestrías (página)', url: 'https://claude.ai/artifact/KY1hkR6gbT7BsEE4PUuxXZ', note: 'La página que creó la corrida de hoy.' },
  { title: 'Radar de investigadores – PINNs y control estocástico', url: 'https://claude.ai/artifact/C5kYThpi8dCNjefVegyhKw', note: 'Personas, papers nuevos y la sección «Para el paper».' },
];

export function InvestigacionTab() {
  return (
    <YStack gap="$3">
      <Paragraph margin={0} color="$muted">
        Maestrías, investigadores y lecturas llegan aquí, con filtros y tu opinión editable, cuando los radares escriban en el calendario
        (research-tracking). Por ahora, sus documentos:
      </Paragraph>
      <SectionTitle>Radares</SectionTitle>
      {LINKS.map((l) => (
        <StripeCard key={l.url}>
          <a href={l.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'none' }}>
            {l.title} ↗
          </a>
          <Text fontSize="$2" color="$muted">
            {l.note}
          </Text>
        </StripeCard>
      ))}
    </YStack>
  );
}
