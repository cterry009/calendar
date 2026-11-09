import { projectProgress } from './progress';

describe('projectProgress', () => {
  it('prefers the stored estimate', () => {
    expect(projectProgress({ progress: 40, specificObjectives: [{ done: true }] })).toEqual({ value: 40, source: 'estimate' });
  });
  it('falls back to the share of done objectives', () => {
    expect(projectProgress({ progress: null, specificObjectives: [{ done: true }, { done: false }, { done: false }] })).toEqual({
      value: 33,
      source: 'objectives',
    });
  });
  it('is null with neither', () => {
    expect(projectProgress({ progress: null, specificObjectives: [] })).toBeNull();
    expect(projectProgress({ progress: null })).toBeNull();
  });
});
