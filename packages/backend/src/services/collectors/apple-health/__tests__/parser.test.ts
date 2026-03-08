import { describe, it, expect } from 'vitest';
import { parseAppleHealthExport } from '../parser.js';

const makeXml = (records: string): string =>
  `<?xml version="1.0"?><HealthData>${records}</HealthData>`;

describe('parseAppleHealthExport', () => {
  it('parses a weight record in kg', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierBodyMass"
        sourceName="Apple Watch"
        unit="kg"
        value="80.5"
        startDate="2026-03-01 08:00:00 +0000"
        endDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements).toHaveLength(1);
    expect(measurements[0].metric).toBe('weight_kg');
    expect(measurements[0].value).toBe(80.5);
    expect(measurements[0].unit).toBe('kg');
    expect(measurements[0].category).toBe('biometric');
    expect(measurements[0].source).toBe('apple_health');
  });

  it('converts weight from lbs to kg', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierBodyMass"
        unit="lb"
        value="176.37"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements[0].value).toBeCloseTo(80.0, 0);
    expect(measurements[0].unit).toBe('kg');
  });

  it('converts distance from miles to meters', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning"
        unit="mi"
        value="3.1"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements[0].metric).toBe('distance_meters');
    expect(measurements[0].value).toBeCloseTo(4988.97, 0);
  });

  it('parses step count', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierStepCount"
        unit="count"
        value="8500"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements[0].metric).toBe('steps');
    expect(measurements[0].value).toBe(8500);
  });

  it('parses nutrition calories', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierDietaryEnergyConsumed"
        unit="kcal"
        value="2150"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements[0].metric).toBe('calories');
    expect(measurements[0].category).toBe('nutrition');
  });

  it('skips unknown record types silently', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierUnknownMetric"
        unit="unit"
        value="42"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements).toHaveLength(0);
  });

  it('skips records with missing or invalid value', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierBodyMass"
        unit="kg"
        value="not-a-number"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements).toHaveLength(0);
  });

  it('skips records with missing startDate', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierBodyMass"
        unit="kg"
        value="80.0"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements).toHaveLength(0);
  });

  it('sets userId correctly', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierStepCount"
        unit="count"
        value="5000"
        startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'my-user-id');
    expect(measurements[0].userId).toBe('my-user-id');
  });

  it('parses multiple records', () => {
    const xml = makeXml(`
      <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" value="80" startDate="2026-03-01 08:00:00 +0000"/>
      <Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="8000" startDate="2026-03-01 08:00:00 +0000"/>
      <Record type="HKQuantityTypeIdentifierDietaryProtein" unit="g" value="150" startDate="2026-03-01 08:00:00 +0000"/>
    `);
    const { measurements } = parseAppleHealthExport(xml, 'user-uuid');
    expect(measurements).toHaveLength(3);
  });

  it('parses workout elements', () => {
    const xml = makeXml(`
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
        duration="45"
        durationUnit="min"
        startDate="2026-03-01 07:00:00 +0000"
        endDate="2026-03-01 07:45:00 +0000"/>
    `);
    const { workoutSets } = parseAppleHealthExport(xml, 'user-uuid');
    expect(workoutSets).toHaveLength(1);
    expect(workoutSets[0].source).toBe('apple_health');
    expect(workoutSets[0].durationSeconds).toBe(45 * 60);
  });

  it('returns empty arrays for empty XML', () => {
    const { measurements, workoutSets } = parseAppleHealthExport(
      '<HealthData></HealthData>',
      'user-uuid',
    );
    expect(measurements).toEqual([]);
    expect(workoutSets).toEqual([]);
  });
});
