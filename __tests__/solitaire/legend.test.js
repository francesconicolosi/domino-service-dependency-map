import * as d3 from 'd3';
import {
    makeKeyColorScale,
    getLegendTitleFor,
    computeKeysAndCounts,
    computeKeysAndCountsFromVisibleOrg,
    updateLegend,
    buildLegendaColorScale,
} from '../../js/solitaire/legend.js';
import { ROLE_FIELD_WITH_MAPPING, COMPANY_FIELD, LOCATION_FIELD, NEUTRAL_COLOR } from '../../js/solitaire/constants.js';

// D3 is auto-mocked via __mocks__/d3.js

describe('makeKeyColorScale', () => {
    test('assigns colors from schemeTableau10 to each key', () => {
        const scale = makeKeyColorScale(['Alpha', 'Beta', 'Gamma'], null);
        expect(typeof scale('Alpha')).toBe('string');
        expect(scale('Alpha')).toMatch(/^#/);
    });

    test('topKey gets NEUTRAL_COLOR', () => {
        const scale = makeKeyColorScale(['Alpha', 'Beta'], 'Beta');
        expect(scale('Beta')).toBe(NEUTRAL_COLOR);
    });

    test('unknown key returns NEUTRAL_COLOR', () => {
        const scale = makeKeyColorScale(['Alpha'], null);
        expect(scale('Unknown Key')).toBeTruthy();
    });

    test('domain() returns the original keys array', () => {
        const keys = ['A', 'B', 'C'];
        const scale = makeKeyColorScale(keys, null);
        expect(scale.domain()).toEqual(keys);
    });

    test('colorOf(k) returns same as scale(k)', () => {
        const scale = makeKeyColorScale(['X', 'Y'], 'X');
        expect(scale.colorOf('X')).toBe(scale('X'));
        expect(scale.colorOf('Y')).toBe(scale('Y'));
    });
});

describe('getLegendTitleFor', () => {
    test('returns "Roles" for ROLE_FIELD_WITH_MAPPING', () => {
        expect(getLegendTitleFor(ROLE_FIELD_WITH_MAPPING)).toBe('Roles');
    });

    test('returns "Companies" for COMPANY_FIELD', () => {
        expect(getLegendTitleFor(COMPANY_FIELD)).toBe('Companies');
    });

    test('returns "Locations" for LOCATION_FIELD', () => {
        expect(getLegendTitleFor(LOCATION_FIELD)).toBe('Locations');
    });

    test('returns "Legend" for unknown field', () => {
        expect(getLegendTitleFor('SomeOtherField')).toBe('Legend');
    });
});

describe('computeKeysAndCounts', () => {
    const members = [
        { Role: 'Engineer' },
        { Role: 'Designer' },
        { Role: 'Engineer' },
        { Role: '' },
    ];

    test('counts occurrences per key', () => {
        const { counts } = computeKeysAndCounts(members, 'Role');
        expect(counts.get('Engineer')).toBe(2);
        expect(counts.get('Designer')).toBe(1);
    });

    test('maps empty/missing values to "Unknown"', () => {
        const { counts } = computeKeysAndCounts(members, 'Role');
        expect(counts.get('Unknown')).toBe(1);
    });

    test('returns sorted keys array', () => {
        const { keys } = computeKeysAndCounts(members, 'Role');
        const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
        expect(keys).toEqual(sorted);
    });

    test('identifies topKey as the most frequent key', () => {
        const { topKey } = computeKeysAndCounts(members, 'Role');
        expect(topKey).toBe('Engineer');
    });

    test('returns empty result for empty members array', () => {
        const { keys, topKey } = computeKeysAndCounts([], 'Role');
        expect(keys).toEqual([]);
        expect(topKey).toBeNull();
    });

    test('handles null members', () => {
        const { keys } = computeKeysAndCounts(null, 'Role');
        expect(keys).toEqual([]);
    });
});

describe('computeKeysAndCountsFromVisibleOrg', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    const org = {
        'StreamA': {
            'ThemeX': {
                'Team1': [
                    { Name: 'Alice', Email: 'a@a.com', Role: 'Engineer' },
                    { Name: 'Bob', Email: 'b@b.com', Role: 'Designer' },
                ],
                'Team2': [
                    { Name: 'Alice', Email: 'a@a.com', Role: 'Engineer' },
                ],
            },
        },
    };

    test('counts unique people by field (deduplicates by composite key)', () => {
        const { counts } = computeKeysAndCountsFromVisibleOrg(org, 'Role');
        expect(counts.get('Engineer')).toBe(1);
        expect(counts.get('Designer')).toBe(1);
    });

    test('returns empty result for null org', () => {
        const { keys } = computeKeysAndCountsFromVisibleOrg(null, 'Role');
        expect(keys).toEqual([]);
    });

    test('skips NA-sentinel streams', () => {
        const orgWithNA = {
            'No Team Stream': {
                'ThemeX': { 'Team1': [{ Name: 'Ghost', Email: 'g@g.com', Role: 'X' }] },
            },
        };
        const { keys } = computeKeysAndCountsFromVisibleOrg(orgWithNA, 'Role');
        expect(keys).toHaveLength(0);
    });
});

describe('updateLegend', () => {
    test('calls d3param.select("#legend") and builds legend items', () => {
        const legendSel = {
            html: jest.fn().mockReturnThis(),
            append: jest.fn().mockReturnThis(),
            attr: jest.fn().mockReturnThis(),
            text: jest.fn().mockReturnThis(),
            style: jest.fn().mockReturnThis(),
        };
        const d3param = { select: jest.fn(() => legendSel) };
        const scale = Object.assign(jest.fn(() => '#fff'), { domain: () => ['A', 'B'] });

        updateLegend(scale, 'Role', d3param);
        expect(d3param.select).toHaveBeenCalledWith('#legend');
        expect(legendSel.html).toHaveBeenCalledWith('');
    });
});

describe('buildLegendaColorScale', () => {
    test('calls d3param.scaleOrdinal for non-special field', () => {
        const d3param = {
            scaleOrdinal: jest.fn(() => jest.fn()),
        };
        buildLegendaColorScale('SomeField', [], d3param, [], '#f0f0f0', 'SpecialField', []);
        expect(d3param.scaleOrdinal).toHaveBeenCalled();
    });

    test('builds scale for special (mapped) field with guestValues', () => {
        const d3param = {
            scaleOrdinal: jest.fn((domain, palette) => {
                const fn = jest.fn(() => palette[0]);
                fn.isGuest = jest.fn();
                return fn;
            }),
        };
        const items = [
            { Role: 'Team Scrum Master' },
            { Role: 'Team Product Manager' },
        ];
        const scale = buildLegendaColorScale(
            'Role', items, d3param,
            ['#aaa', '#bbb'], '#fff',
            'Role',
            ['scrum master', 'product manager']
        );
        expect(d3param.scaleOrdinal).toHaveBeenCalled();
        expect(typeof scale.isGuest).toBe('function');
    });
});
