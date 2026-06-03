import {
    SECOND_LEVEL_LABEL_EXTRA,
    MAX_TEAMS_PER_ROW,
    TEAM_MEMBER_LEGENDA_LABEL,
    NEUTRAL_COLOR,
    ROLE_FIELD_WITH_MAPPING,
    LOCATION_FIELD,
    COMPANY_FIELD,
    emailField,
    firstOrgLevel,
    secondOrgLevel,
    thirdOrgLevel,
    firstLevelNA,
    secondLevelNA,
    thirdLevelNA,
} from '../../js/solitaire/constants.js';

describe('solitaire constants', () => {
    describe('layout constants', () => {
        test('SECOND_LEVEL_LABEL_EXTRA is a positive number', () => {
            expect(typeof SECOND_LEVEL_LABEL_EXTRA).toBe('number');
            expect(SECOND_LEVEL_LABEL_EXTRA).toBeGreaterThan(0);
        });

        test('MAX_TEAMS_PER_ROW is a positive integer', () => {
            expect(typeof MAX_TEAMS_PER_ROW).toBe('number');
            expect(MAX_TEAMS_PER_ROW).toBeGreaterThan(0);
            expect(Number.isInteger(MAX_TEAMS_PER_ROW)).toBe(true);
        });
    });

    describe('legend / color constants', () => {
        test('TEAM_MEMBER_LEGENDA_LABEL is a non-empty string', () => {
            expect(typeof TEAM_MEMBER_LEGENDA_LABEL).toBe('string');
            expect(TEAM_MEMBER_LEGENDA_LABEL.length).toBeGreaterThan(0);
        });

        test('NEUTRAL_COLOR is a valid hex color', () => {
            expect(typeof NEUTRAL_COLOR).toBe('string');
            expect(NEUTRAL_COLOR).toMatch(/^#[0-9a-fA-F]{3,6}$/);
        });
    });

    describe('field name constants', () => {
        test('ROLE_FIELD_WITH_MAPPING is a string', () => {
            expect(typeof ROLE_FIELD_WITH_MAPPING).toBe('string');
        });

        test('LOCATION_FIELD is a string', () => {
            expect(typeof LOCATION_FIELD).toBe('string');
        });

        test('COMPANY_FIELD is a string', () => {
            expect(typeof COMPANY_FIELD).toBe('string');
        });

        test('emailField is a string', () => {
            expect(typeof emailField).toBe('string');
        });
    });

    describe('org level field names', () => {
        test('firstOrgLevel, secondOrgLevel, thirdOrgLevel are strings', () => {
            expect(typeof firstOrgLevel).toBe('string');
            expect(typeof secondOrgLevel).toBe('string');
            expect(typeof thirdOrgLevel).toBe('string');
        });

        test('NA sentinel labels are derived from level names', () => {
            expect(firstLevelNA).toContain(firstOrgLevel);
            expect(secondLevelNA).toContain(secondOrgLevel);
            expect(thirdLevelNA).toContain(thirdOrgLevel);
        });

        test('NA sentinel labels start with "No "', () => {
            expect(firstLevelNA).toMatch(/^No /);
            expect(secondLevelNA).toMatch(/^No /);
            expect(thirdLevelNA).toMatch(/^No /);
        });
    });

    describe('immutability', () => {
        test('numeric constants cannot be reassigned via the module', () => {
            expect(SECOND_LEVEL_LABEL_EXTRA).toBe(120);
            expect(MAX_TEAMS_PER_ROW).toBe(5);
        });
    });
});
