import { haversineDistanceMeters, isWithinRadius } from './distance.js';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    const point = { latitude: 40.4168, longitude: -3.7038 };
    expect(haversineDistanceMeters(point, point)).toBe(0);
  });

  it('matches the known distance between Madrid and Barcelona (~504km)', () => {
    const madrid = { latitude: 40.4168, longitude: -3.7038 };
    const barcelona = { latitude: 41.3874, longitude: 2.1686 };

    const distanceKm = haversineDistanceMeters(madrid, barcelona) / 1000;
    expect(distanceKm).toBeGreaterThan(490);
    expect(distanceKm).toBeLessThan(510);
  });

  it('is symmetric', () => {
    const a = { latitude: 10, longitude: 20 };
    const b = { latitude: -5, longitude: 45 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
  });
});

describe('isWithinRadius', () => {
  it('is true when the point is inside the radius', () => {
    const center = { latitude: 40.4168, longitude: -3.7038 };
    const nearby = { latitude: 40.417, longitude: -3.704 }; // a few meters away
    expect(isWithinRadius(nearby, center, 100)).toBe(true);
  });

  it('is false when the point is outside the radius', () => {
    const center = { latitude: 40.4168, longitude: -3.7038 };
    const farAway = { latitude: 41.3874, longitude: 2.1686 }; // Barcelona
    expect(isWithinRadius(farAway, center, 100)).toBe(false);
  });

  it('treats the boundary as inclusive', () => {
    const center = { latitude: 0, longitude: 0 };
    const point = { latitude: 0, longitude: 0.001 };
    const exactDistance = haversineDistanceMeters(center, point);
    expect(isWithinRadius(point, center, Math.ceil(exactDistance))).toBe(true);
  });
});
