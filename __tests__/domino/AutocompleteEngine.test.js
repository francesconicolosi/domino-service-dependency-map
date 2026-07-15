import { AutocompleteEngine } from '../../js/shared/AutocompleteEngine.js';

function makeApp(nodes = []) {
    return { store: { nodes } };
}

const SAMPLE_NODES = [
    { id: 'SvcA', Type: 'Application', Status: 'Active', 'Depends on': 'SvcB||SvcC' },
    { id: 'SvcB', Type: 'Library', Status: 'Stopped', 'Depends on': '' },
];

describe('AutocompleteEngine constructor', () => {
    test('initializes with empty keys and valuesByKey', () => {
        const ae = new AutocompleteEngine(makeApp());
        expect(ae.keys).toEqual([]);
        expect(ae.valuesByKey).toBeInstanceOf(Map);
    });
});

describe('AutocompleteEngine.buildIndex', () => {
    test('does nothing when nodes is empty', () => {
        const ae = new AutocompleteEngine(makeApp([]));
        ae.buildIndex();
        expect(ae.keys).toEqual([]);
    });

    test('builds keys list from node fields', () => {
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        expect(ae.keys).toContain('id');
        expect(ae.keys).toContain('Type');
        expect(ae.keys).toContain('Status');
    });

    test('maps "Service Name" key to "id"', () => {
        const nodes = [{ id: 'SvcA', 'Service Name': 'SvcA', Type: 'App' }];
        const ae = new AutocompleteEngine(makeApp(nodes));
        ae.buildIndex();
        expect(ae.keys).toContain('id');
        expect(ae.keys).not.toContain('Service Name');
    });

    test('excludes internal D3 keys', () => {
        const nodes = [{ id: 'SvcA', x: 10, y: 20, vx: 0, vy: 0, color: '#fff', Type: 'App' }];
        const ae = new AutocompleteEngine(makeApp(nodes));
        ae.buildIndex();
        ['x', 'y', 'vx', 'vy', 'color'].forEach(k => {
            expect(ae.keys).not.toContain(k);
        });
    });

    test('populates valuesByKey with sorted values', () => {
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        const types = ae.valuesByKey.get('Type');
        expect(types).toContain('Application');
        expect(types).toContain('Library');
        // Should be sorted
        const sorted = [...types].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        expect(types).toEqual(sorted);
    });

    test('splits multi-value fields when indexing', () => {
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        const deps = ae.valuesByKey.get('Depends on');
        expect(deps).toContain('SvcB');
        expect(deps).toContain('SvcC');
    });
});

describe('AutocompleteEngine.computeSuggestions', () => {
    let ae;

    beforeEach(() => {
        ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
    });

    test('returns key suggestions when no colon in input', () => {
        const sug = ae.computeSuggestions('ty');
        expect(sug.some(s => s.startsWith('Type:'))).toBe(true);
    });

    test('returns all key suggestions for empty input', () => {
        const sug = ae.computeSuggestions('');
        expect(sug.length).toBeGreaterThan(0);
        sug.forEach(s => expect(s).toMatch(/:$/));
    });

    test('returns value suggestions when colon is present', () => {
        const sug = ae.computeSuggestions('Type:Ap');
        expect(sug.some(s => s.includes('Application'))).toBe(true);
    });

    test('supports negation prefix with !', () => {
        const sug = ae.computeSuggestions('!ty');
        expect(sug.some(s => s.startsWith('!Type:'))).toBe(true);
    });

    test('returns empty array for unrecognized key after colon', () => {
        const sug = ae.computeSuggestions('NonExistentKey:abc');
        expect(sug).toEqual([]);
    });

    test('adds comma suggestion when exact value matches and no trailing comma', () => {
        const sug = ae.computeSuggestions('Type:Application');
        expect(sug.some(s => s.endsWith(','))).toBe(true);
    });

    test('quoted mode wraps values in double quotes', () => {
        const sug = ae.computeSuggestions('Type:"Ap');
        expect(sug.some(s => s.includes('"Application"'))).toBe(true);
    });
});

describe('AutocompleteEngine.refreshSuggestions', () => {
    beforeEach(() => {
        document.body.innerHTML = '<datalist id="search-suggestions"></datalist>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('populates datalist with option elements', () => {
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        ae.refreshSuggestions('ty');
        const opts = document.querySelectorAll('#search-suggestions option');
        expect(opts.length).toBeGreaterThan(0);
    });

    test('clears datalist before repopulating', () => {
        const dl = document.getElementById('search-suggestions');
        dl.innerHTML = '<option value="old"></option>';
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        ae.refreshSuggestions('xyz');
        // If no suggestions, datalist is empty
        const opts = document.querySelectorAll('#search-suggestions option');
        opts.forEach(opt => {
            expect(opt.value).not.toBe('old');
        });
    });

    test('does nothing when datalist element is missing', () => {
        document.body.innerHTML = '';
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        expect(() => ae.refreshSuggestions('ty')).not.toThrow();
    });
});

describe('AutocompleteEngine.init', () => {
    beforeEach(() => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('creates datalist and attaches to input', () => {
        const ae = new AutocompleteEngine(makeApp(SAMPLE_NODES));
        ae.buildIndex();
        ae.init();
        const dl = document.getElementById('search-suggestions');
        expect(dl).toBeTruthy();
        const input = document.getElementById('drawer-search-input');
        expect(input.getAttribute('list')).toBe('search-suggestions');
    });

    test('does nothing when input is missing', () => {
        document.body.innerHTML = '';
        const ae = new AutocompleteEngine(makeApp());
        expect(() => ae.init()).not.toThrow();
    });
});
