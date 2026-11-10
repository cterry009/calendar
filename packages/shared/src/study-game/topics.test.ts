import { canRetire, fillTopics, masteryPercent, retireTopic, type TopicRef } from './topics';

const t = (section: string, noteCode = 'F'): TopicRef => ({ noteCode, section });
const pensum = ['1', '2', '3', '4', '5', '6', '7'].map((s) => t(s));

describe('tutor topics', () => {
  it('fills five topics in pensum order, skipping mastered ones', () => {
    const levels: Record<string, number> = { 'F#2': 3 };
    const set = fillTopics(pensum, { active: [], retired: [] }, (x) => levels[`${x.noteCode}#${x.section}`]);
    expect(set.active.map((x) => x.section)).toEqual(['1', '3', '4', '5', '6']);
  });

  it('keeps the current active topics and their order', () => {
    const set = fillTopics(pensum, { active: [t('6'), t('1')], retired: [] }, () => 1);
    expect(set.active.map((x) => x.section)).toEqual(['6', '1', '2', '3', '4']);
  });

  it('drops topics that left the pensum', () => {
    const set = fillTopics(pensum, { active: [t('9', 'X')], retired: [] }, () => 1);
    expect(set.active.map((x) => x.section)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('retires a mastered topic and brings in the next one', () => {
    const levels: Record<string, number> = { 'F#3': 3 };
    const levelOf = (x: TopicRef) => levels[`${x.noteCode}#${x.section}`] ?? 1;
    const start = { active: pensum.slice(0, 5), retired: [] };
    const next = retireTopic(pensum, start, t('3'), levelOf);
    expect(next.active.map((x) => x.section)).toEqual(['1', '2', '4', '5', '6']);
    expect(next.retired.map((x) => x.section)).toEqual(['3']);
  });

  it('does not retire an unmastered topic', () => {
    const start = { active: pensum.slice(0, 5), retired: [] };
    expect(retireTopic(pensum, start, t('1'), () => 2)).toBe(start);
    expect(canRetire(2)).toBe(false);
    expect(canRetire(3)).toBe(true);
  });

  it('maps θ to the share of the way to mastery', () => {
    const thresholds = [-1, 0, 1, 2];
    expect(masteryPercent(undefined, thresholds)).toBe(0);
    expect(masteryPercent(-2, thresholds)).toBe(0);
    expect(masteryPercent(-1, thresholds)).toBe(50);
    expect(masteryPercent(0, thresholds)).toBe(100);
    expect(masteryPercent(1.5, thresholds)).toBe(100);
  });
});
