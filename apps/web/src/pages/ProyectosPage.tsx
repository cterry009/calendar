import { useState } from 'react';
import { H1, YStack } from '@calendar/ui';
import { ProyectosList } from '../components/agenda/ProyectosList';
import { SectionTitle } from '../components/agenda/parts';
import { RadarLinks } from '../components/agenda/RadarLinks';
import { rememberedTab, rememberTab, SubTabs } from '../components/agenda/SubTabs';
import { FitnessPage } from './FitnessPage';
import { HabitsPage } from './HabitsPage';
import { RitualPage } from './RitualPage';
import { WellnessPage } from './WellnessPage';

// agenda-redesign (2026-11-09, the user's structure): the projects by area, each area with what belongs
// to it -- habits, the daily ritual, wellness and exercise under "Hábitos y deporte"; study, the
// master's and papers/researchers under "Académico e investigación".

const AREAS = [
  { id: 'habitos', label: 'Hábitos y deporte' },
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'personal', label: 'Personal' },
  { id: 'ocio', label: 'Ocio' },
  { id: 'academico', label: 'Académico e investigación' },
] as const;
type AreaId = (typeof AREAS)[number]['id'];

const ACADEMIC = [
  { id: 'estudio', label: 'Estudio' },
  { id: 'maestria', label: 'Maestría' },
  { id: 'papers', label: 'Papers e investigadores' },
] as const;
type AcademicId = (typeof ACADEMIC)[number]['id'];

export function ProyectosPage() {
  const [area, setArea] = useState<AreaId>(() => rememberedTab('calendar.proyectos.area', AREAS.map((a) => a.id), 'academico'));
  const [academic, setAcademic] = useState<AcademicId>(() => rememberedTab('calendar.proyectos.academico', ACADEMIC.map((a) => a.id), 'estudio'));

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4" maxWidth={1240} width="100%" alignSelf="center">
      <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
        Proyectos
      </H1>
      <SubTabs
        tabs={AREAS}
        value={area}
        onChange={(id) => {
          setArea(id);
          rememberTab('calendar.proyectos.area', id);
        }}
      />

      {area === 'habitos' ? (
        <YStack gap="$5">
          <ProyectosList areas={['habitos-deporte']} />
          <HabitsPage />
          <RitualPage />
          <WellnessPage />
          <FitnessPage />
        </YStack>
      ) : null}
      {area === 'trabajo' ? <ProyectosList areas={['trabajo']} /> : null}
      {area === 'personal' ? <ProyectosList areas={['personal']} /> : null}
      {area === 'ocio' ? <ProyectosList areas={['ocio']} /> : null}

      {area === 'academico' ? (
        <YStack gap="$4">
          <SubTabs
            small
            tabs={ACADEMIC}
            value={academic}
            onChange={(id) => {
              setAcademic(id);
              rememberTab('calendar.proyectos.academico', id);
            }}
          />
          {academic === 'estudio' ? <ProyectosList areas={['academico-estudio']} /> : null}
          {academic === 'maestria' ? (
            <YStack gap="$4">
              <ProyectosList areas={['academico-maestria']} />
              <SectionTitle>Radar de maestrías</SectionTitle>
              <RadarLinks only={['Radar de maestrías', 'Radar de maestrías – documento']} />
            </YStack>
          ) : null}
          {academic === 'papers' ? (
            <YStack gap="$4">
              <ProyectosList areas={['academico-papers']} />
              <SectionTitle>Investigadores y lecturas</SectionTitle>
              <RadarLinks only={['Radar de investigadores – PINNs y control estocástico', 'Bitácora de lectura PINN']} />
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
