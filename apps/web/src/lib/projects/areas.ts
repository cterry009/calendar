// 2026-11-09: where a project lives on the Proyectos page. Stored in Project.area (a plain string, no
// migration); older free-text areas map to the closest one.

export const PROJECT_AREAS = [
  { key: 'habitos-deporte', label: 'Hábitos y deporte' },
  { key: 'trabajo', label: 'Trabajo' },
  { key: 'personal', label: 'Personal' },
  { key: 'ocio', label: 'Ocio' },
  { key: 'academico-estudio', label: 'Estudio', group: 'academico' },
  { key: 'academico-maestria', label: 'Maestría', group: 'academico' },
  { key: 'academico-papers', label: 'Papers e investigadores', group: 'academico' },
] as const;

export type ProjectAreaKey = (typeof PROJECT_AREAS)[number]['key'];

const LEGACY: Record<string, ProjectAreaKey> = {
  posgrado: 'academico-maestria',
  maestría: 'academico-maestria',
  investigación: 'academico-papers',
  estudio: 'academico-estudio',
  trabajo: 'trabajo',
  docencia: 'trabajo',
  desarrollo: 'personal',
  personal: 'personal',
  ocio: 'ocio',
};

export function projectArea(area: string | null | undefined): ProjectAreaKey {
  if (!area) return 'personal';
  if (PROJECT_AREAS.some((a) => a.key === area)) return area as ProjectAreaKey;
  return LEGACY[area.trim().toLowerCase()] ?? 'personal';
}

export function areaLabel(area: string | null | undefined): string {
  const key = projectArea(area);
  return PROJECT_AREAS.find((a) => a.key === key)?.label ?? 'Personal';
}
