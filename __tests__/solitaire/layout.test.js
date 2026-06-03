import {
    countRowsByTeamCapacity,
    computeStreamBoxWidthByCapacity,
    computeStreamBoxWidthWrapped,
} from '../../js/solitaire/layout.js';
import { secondLevelNA, SECOND_LEVEL_LABEL_EXTRA, MAX_TEAMS_PER_ROW } from '../../js/solitaire/constants.js';

// Default parameter values used in production
const SECOND_LEVEL_BOX_PAD_X = 20;
const THIRD_LEVEL_BOX_PAD_X = 10;
const THIRD_LEVEL_BOX_WIDTH = 200;

// Helpers to build second-level items (themes → teams)
function makeThemes(themeCount, teamsPerTheme) {
    const obj = {};
    for (let i = 0; i < themeCount; i++) {
        const teams = {};
        for (let j = 0; j < teamsPerTheme; j++) teams[`Team${i}_${j}`] = [];
        obj[`Theme${i}`] = teams;
    }
    return obj;
}

// ─── countRowsByTeamCapacity ──────────────────────────────────────────────────

describe('countRowsByTeamCapacity', () => {
    test('returns 1 when themes fit in one row', () => {
        const themes = makeThemes(2, 2); // 4 teams total, capacity 5
        expect(countRowsByTeamCapacity(themes, MAX_TEAMS_PER_ROW)).toBe(1);
    });

    test('returns 2 when teams exceed one row', () => {
        const themes = makeThemes(3, 2); // 6 teams total, capacity 5 → 2 rows
        expect(countRowsByTeamCapacity(themes, MAX_TEAMS_PER_ROW)).toBe(2);
    });

    test('returns 1 for empty themes object', () => {
        expect(countRowsByTeamCapacity({}, MAX_TEAMS_PER_ROW)).toBe(1);
    });

    test('skips NA sentinel themes', () => {
        const themes = {
            [`${secondLevelNA}`]: { Team1: [], Team2: [] },
            'RealTheme': { Team3: [], Team4: [] },
        };
        // NA theme is skipped; only 2 teams from RealTheme
        expect(countRowsByTeamCapacity(themes, MAX_TEAMS_PER_ROW)).toBe(1);
    });

    test('handles theme with 0 teams', () => {
        const themes = { Theme1: {}, Theme2: { T1: [] } };
        expect(countRowsByTeamCapacity(themes, MAX_TEAMS_PER_ROW)).toBe(1);
    });
});

// ─── computeStreamBoxWidthByCapacity ─────────────────────────────────────────

describe('computeStreamBoxWidthByCapacity', () => {
    test('returns a positive number for non-empty themes', () => {
        const themes = makeThemes(2, 2);
        const w = computeStreamBoxWidthByCapacity(
            themes,
            SECOND_LEVEL_BOX_PAD_X,
            secondLevelNA,
            THIRD_LEVEL_BOX_PAD_X,
            THIRD_LEVEL_BOX_WIDTH
        );
        expect(w).toBeGreaterThan(0);
    });

    test('returns just the padding for empty themes', () => {
        const w = computeStreamBoxWidthByCapacity(
            {},
            SECOND_LEVEL_BOX_PAD_X,
            secondLevelNA,
            THIRD_LEVEL_BOX_PAD_X,
            THIRD_LEVEL_BOX_WIDTH,
            SECOND_LEVEL_LABEL_EXTRA,
            60,
            60
        );
        // 0 themes: rowWidth starts at leftPad=60, final = max(60+60, 0) = 120
        expect(w).toBe(120);
    });

    test('increases width for more teams', () => {
        const small = makeThemes(1, 1);
        const large = makeThemes(1, 4);
        const wSmall = computeStreamBoxWidthByCapacity(small, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        const wLarge = computeStreamBoxWidthByCapacity(large, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        expect(wLarge).toBeGreaterThan(wSmall);
    });

    test('wraps to new row when exceeding MAX_TEAMS_PER_ROW', () => {
        // 6 teams split across 2 rows; one row has 5 teams (exactly max), next has 1
        const themes = makeThemes(6, 1);
        const w = computeStreamBoxWidthByCapacity(
            themes,
            SECOND_LEVEL_BOX_PAD_X,
            secondLevelNA,
            THIRD_LEVEL_BOX_PAD_X,
            THIRD_LEVEL_BOX_WIDTH
        );
        expect(w).toBeGreaterThan(0);
    });

    test('skips NA sentinel themes', () => {
        const themes = {
            [secondLevelNA]: { T1: [], T2: [] },
            'Theme1': { Team1: [] },
        };
        const wNA = computeStreamBoxWidthByCapacity(themes, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        const wNoNA = computeStreamBoxWidthByCapacity({ 'Theme1': { Team1: [] } }, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        expect(wNA).toBe(wNoNA);
    });
});

// ─── computeStreamBoxWidthWrapped ─────────────────────────────────────────────

describe('computeStreamBoxWidthWrapped', () => {
    test('returns minWidth for empty themes', () => {
        const w = computeStreamBoxWidthWrapped({}, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        expect(w).toBe(600); // default minWidth
    });

    test('returns minWidth when themes have only NA entries', () => {
        const themes = { [secondLevelNA]: { T1: [], T2: [] } };
        const w = computeStreamBoxWidthWrapped(themes, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        expect(w).toBe(600);
    });

    test('returns a value at least minWidth', () => {
        const themes = makeThemes(1, 1);
        const w = computeStreamBoxWidthWrapped(themes, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH);
        expect(w).toBeGreaterThanOrEqual(600);
    });

    test('respects custom minWidth', () => {
        const w = computeStreamBoxWidthWrapped({}, SECOND_LEVEL_BOX_PAD_X, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH, 4, 1200);
        expect(w).toBe(1200);
    });

    test('accounts for padding between themes in same row', () => {
        const themes = makeThemes(2, 1);
        const wWith = computeStreamBoxWidthWrapped(themes, 50, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH, 4, 0, 80);
        const wWithout = computeStreamBoxWidthWrapped(themes, 0, secondLevelNA, THIRD_LEVEL_BOX_PAD_X, THIRD_LEVEL_BOX_WIDTH, 4, 0, 80);
        expect(wWith).toBeGreaterThan(wWithout);
    });
});
