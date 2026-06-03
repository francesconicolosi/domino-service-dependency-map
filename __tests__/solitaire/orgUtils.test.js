import {
    getAllowedStreamsSet,
    buildCompositeKey,
    collectMembersFromOrganization,
    filterOrganizationByStreams,
    getVisiblePeopleForLegend,
    countTeamsForMemberInOrg,
    getNameFromTitleEl,
    isOnlyContributorsRow,
    hasTeamDrawerContent,
} from '../../js/solitaire/orgUtils.js';

// ─── getAllowedStreamsSet ──────────────────────────────────────────────────────

describe('getAllowedStreamsSet', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('returns null when no stream param', () => {
        window.history.pushState({}, '', '/');
        expect(getAllowedStreamsSet()).toBeNull();
    });

    test('returns Set with raw and normalized stream names', () => {
        window.history.pushState({}, '', '?stream=Omni,Data');
        const result = getAllowedStreamsSet();
        expect(result).toBeInstanceOf(Set);
        expect(result.has('Omni')).toBe(true);
        expect(result.has('omni')).toBe(true);
        expect(result.has('Data')).toBe(true);
        expect(result.has('data')).toBe(true);
    });

    test('ignores empty items from trailing commas', () => {
        window.history.pushState({}, '', '?stream=Alpha,');
        const result = getAllowedStreamsSet();
        expect(result.has('')).toBe(false);
    });
});

// ─── buildCompositeKey ────────────────────────────────────────────────────────

describe('buildCompositeKey', () => {
    test('builds key from Name and Email', () => {
        const person = { Name: 'John Doe', Email: 'john@example.com' };
        expect(buildCompositeKey(person)).toBe('John Doe::john@example.com');
    });

    test('uses name only when email is missing', () => {
        const person = { Name: 'Jane' };
        expect(buildCompositeKey(person)).toBe('Jane::');
    });

    test('returns empty string when both are missing', () => {
        expect(buildCompositeKey({})).toBe('');
    });

    test('normalizes whitespace in name and email', () => {
        const person = { Name: '  John  Doe  ', Email: '  j@b.com  ' };
        expect(buildCompositeKey(person)).toBe('John Doe::j@b.com');
    });

    test('accepts custom email field name', () => {
        const person = { Name: 'Alice', 'Work Email': 'alice@work.com' };
        expect(buildCompositeKey(person, 'Work Email')).toBe('Alice::alice@work.com');
    });

    test('handles null person', () => {
        expect(buildCompositeKey(null)).toBe('');
        expect(buildCompositeKey(undefined)).toBe('');
    });
});

// ─── collectMembersFromOrganization ───────────────────────────────────────────

describe('collectMembersFromOrganization', () => {
    const org = {
        StreamA: {
            ThemeX: {
                Team1: [{ Name: 'Alice' }, { Name: 'Bob' }],
                Team2: [{ Name: 'Charlie' }],
            },
        },
        StreamB: {
            ThemeY: {
                Team3: [{ Name: 'Dave' }],
            },
        },
    };

    test('collects all members from all streams, themes, and teams', () => {
        const members = collectMembersFromOrganization(org);
        expect(members).toHaveLength(4);
        const names = members.map(m => m.Name);
        expect(names).toContain('Alice');
        expect(names).toContain('Bob');
        expect(names).toContain('Charlie');
        expect(names).toContain('Dave');
    });

    test('returns empty array for empty org', () => {
        expect(collectMembersFromOrganization({})).toEqual([]);
    });
});

// ─── filterOrganizationByStreams ──────────────────────────────────────────────

describe('filterOrganizationByStreams', () => {
    const org = {
        Alpha: { Theme1: { Team1: [] } },
        Beta:  { Theme2: { Team2: [] } },
        Gamma: { Theme3: { Team3: [] } },
    };

    test('returns full org when allowed is null', () => {
        expect(filterOrganizationByStreams(org, null)).toBe(org);
    });

    test('returns full org when allowed is empty set', () => {
        expect(filterOrganizationByStreams(org, new Set())).toBe(org);
    });

    test('filters to only allowed streams by exact name', () => {
        const result = filterOrganizationByStreams(org, new Set(['Alpha']));
        expect(Object.keys(result)).toEqual(['Alpha']);
    });

    test('filters by normalized key (lowercase underscore)', () => {
        const result = filterOrganizationByStreams(org, new Set(['alpha']));
        expect(Object.keys(result)).toEqual(['Alpha']);
    });

    test('returns empty object when no streams match', () => {
        const result = filterOrganizationByStreams(org, new Set(['Nonexistent']));
        expect(Object.keys(result)).toHaveLength(0);
    });

    test('handles null org', () => {
        const result = filterOrganizationByStreams(null, new Set(['Alpha']));
        expect(result).toEqual({});
    });
});

// ─── getVisiblePeopleForLegend ────────────────────────────────────────────────

describe('getVisiblePeopleForLegend', () => {
    const people = [
        { Name: 'Alice', 'Team Stream': 'Alpha' },
        { Name: 'Bob', 'Team Stream': 'Beta\nAlpha' },
        { Name: 'Charlie', 'Team Stream': 'Gamma' },
        { Name: 'Dave', 'Team Stream': '' },
    ];

    test('returns all people when allowedStreams is null', () => {
        expect(getVisiblePeopleForLegend(people, null, 'Team Stream')).toBe(people);
    });

    test('returns all people when allowedStreams is empty', () => {
        expect(getVisiblePeopleForLegend(people, new Set(), 'Team Stream')).toBe(people);
    });

    test('filters people by stream name', () => {
        const result = getVisiblePeopleForLegend(people, new Set(['Alpha']), 'Team Stream');
        expect(result.map(p => p.Name)).toContain('Alice');
        expect(result.map(p => p.Name)).toContain('Bob');
        expect(result.map(p => p.Name)).not.toContain('Charlie');
    });

    test('excludes people with empty stream', () => {
        const result = getVisiblePeopleForLegend(people, new Set(['Alpha']), 'Team Stream');
        expect(result.map(p => p.Name)).not.toContain('Dave');
    });

    test('matches by normalized key', () => {
        const result = getVisiblePeopleForLegend(people, new Set(['gamma']), 'Team Stream');
        expect(result.map(p => p.Name)).toContain('Charlie');
    });
});

// ─── countTeamsForMemberInOrg ─────────────────────────────────────────────────

describe('countTeamsForMemberInOrg', () => {
    const org = {
        'StreamA': {
            'ThemeX': {
                'Team1': [{ Name: 'Alice', Email: 'a@a.com' }],
                'Team2': [{ Name: 'Alice', Email: 'a@a.com' }, { Name: 'Bob', Email: 'b@b.com' }],
            },
        },
        'No Team Stream': {
            'ThemeY': {
                'Team3': [{ Name: 'Alice', Email: 'a@a.com' }],
            },
        },
    };

    test('counts all teams in valid streams where member appears', () => {
        const alice = { Name: 'Alice', Email: 'a@a.com' };
        expect(countTeamsForMemberInOrg(alice, org)).toBe(2);
    });

    test('returns 0 for member not in any team', () => {
        const nobody = { Name: 'Nobody', Email: 'no@no.com' };
        expect(countTeamsForMemberInOrg(nobody, org)).toBe(0);
    });

    test('skips NA-sentinel streams', () => {
        const alice = { Name: 'Alice', Email: 'a@a.com' };
        // Team3 is in 'No Team Stream' which should be skipped
        expect(countTeamsForMemberInOrg(alice, org)).toBe(2);
    });

    test('returns 0 for empty key', () => {
        expect(countTeamsForMemberInOrg({}, org)).toBe(0);
    });
});

// ─── getNameFromTitleEl ───────────────────────────────────────────────────────

describe('getNameFromTitleEl', () => {
    test('returns text content without the gear emoji suffix', () => {
        const el = document.createElement('div');
        el.textContent = 'Team Alpha - ⚙️ 3 members';
        expect(getNameFromTitleEl(el)).toBe('Team Alpha');
    });

    test('returns plain text when no suffix', () => {
        const el = document.createElement('div');
        el.textContent = 'Team Beta';
        expect(getNameFromTitleEl(el)).toBe('Team Beta');
    });

    test('handles null/undefined gracefully', () => {
        expect(getNameFromTitleEl(null)).toBe('');
        expect(getNameFromTitleEl(undefined)).toBe('');
    });
});

// ─── isOnlyContributorsRow ────────────────────────────────────────────────────

describe('isOnlyContributorsRow', () => {
    test('matches OnlyContributors# pattern (case-insensitive)', () => {
        expect(isOnlyContributorsRow({ Name: 'OnlyContributors#1' })).toBe(true);
        expect(isOnlyContributorsRow({ Name: 'onlycontributors#999' })).toBe(true);
    });

    test('does not match normal names', () => {
        expect(isOnlyContributorsRow({ Name: 'Alice' })).toBe(false);
        expect(isOnlyContributorsRow({ Name: 'OnlyContributors' })).toBe(false);
    });

    test('handles null/undefined', () => {
        expect(isOnlyContributorsRow(null)).toBe(false);
        expect(isOnlyContributorsRow({})).toBe(false);
    });
});

// ─── hasTeamDrawerContent ─────────────────────────────────────────────────────

describe('hasTeamDrawerContent', () => {
    test('returns true when description is present', () => {
        expect(hasTeamDrawerContent({ description: 'Some description' })).toBe(true);
    });

    test('returns true when services has items', () => {
        expect(hasTeamDrawerContent({ services: { items: [1, 2] } })).toBe(true);
    });

    test('returns true when channels array is non-empty', () => {
        expect(hasTeamDrawerContent({ channels: ['#general'] })).toBe(true);
    });

    test('returns true when email is present', () => {
        expect(hasTeamDrawerContent({ email: 'team@example.com' })).toBe(true);
    });

    test('returns false when all fields are empty/missing', () => {
        expect(hasTeamDrawerContent({})).toBe(false);
        expect(hasTeamDrawerContent({ description: '', services: { items: [] }, channels: [], email: '' })).toBe(false);
    });

    test('returns false when description is only whitespace', () => {
        expect(hasTeamDrawerContent({ description: '   ' })).toBe(false);
    });
});
