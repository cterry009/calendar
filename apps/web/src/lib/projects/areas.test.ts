import { describe, expect, it } from 'vitest';
import { areaLabel, projectArea } from './areas';

describe('projectArea', () => {
  it('keeps known keys and maps the older free-text areas', () => {
    expect(projectArea('academico-maestria')).toBe('academico-maestria');
    expect(projectArea('Posgrado')).toBe('academico-maestria');
    expect(projectArea('Investigación')).toBe('academico-papers');
    expect(projectArea('Docencia')).toBe('trabajo');
    expect(projectArea(null)).toBe('personal');
    expect(projectArea('algo raro')).toBe('personal');
    expect(areaLabel('ocio')).toBe('Ocio');
  });
});
