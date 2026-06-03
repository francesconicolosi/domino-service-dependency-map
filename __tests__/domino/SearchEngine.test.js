import { SearchEngine } from '../../js/domino/SearchEngine.js';

function makeEngine(searchTerm = '') {
    const app = {
        graph: { updateVisualization: jest.fn(), clickedNode: null },
        drawer: { showNodeDetails: jest.fn() },
    };
    const engine = new SearchEngine(app);
    engine.searchTerm = searchTerm;
    return engine;
}

// ─── normalizeForCompare ──────────────────────────────────────────────────────

describe('normalizeForCompare', () => {
    const engine = makeEngine();

    test('lowercases the value', () => {
        expect(engine.normalizeForCompare('HELLO')).toBe('hello');
    });

    test('removes spaces and newlines', () => {
        expect(engine.normalizeForCompare('hello world\ntest')).toBe('helloworldtest');
    });

    test('handles null/undefined', () => {
        expect(engine.normalizeForCompare(null)).toBe('');
        expect(engine.normalizeForCompare(undefined)).toBe('');
    });

    test('handles numbers via toString', () => {
        expect(engine.normalizeForCompare(42)).toBe('42');
    });
});

// ─── parseActiveKeyValueSearch ────────────────────────────────────────────────

describe('parseActiveKeyValueSearch', () => {
    const engine = makeEngine();

    test('returns null when no colon in term', () => {
        expect(engine.parseActiveKeyValueSearch('hello')).toBeNull();
    });

    test('returns null for negation term', () => {
        expect(engine.parseActiveKeyValueSearch('!key:value')).toBeNull();
    });

    test('returns null for empty/falsy term', () => {
        expect(engine.parseActiveKeyValueSearch('')).toBeNull();
        expect(engine.parseActiveKeyValueSearch(null)).toBeNull();
    });

    test('parses simple key:value', () => {
        const result = engine.parseActiveKeyValueSearch('name:alice');
        expect(result).toEqual({ key: 'name', values: ['alice'], quoted: false });
    });

    test('parses key:"quoted value"', () => {
        const result = engine.parseActiveKeyValueSearch('name:"alice smith"');
        expect(result.key).toBe('name');
        expect(result.quoted).toBe(true);
        expect(result.values).toContain('alice smith');
    });

    test('parses multi-value key:a,b,c', () => {
        const result = engine.parseActiveKeyValueSearch('status:active,stopped');
        expect(result.key).toBe('status');
        expect(result.values).toContain('active');
        expect(result.values).toContain('stopped');
    });

    test('handles key with colon in value (splits at first colon)', () => {
        const result = engine.parseActiveKeyValueSearch('url:https://example.com');
        expect(result.key).toBe('url');
        expect(result.values[0]).toContain('example');
    });
});

// ─── buildKeyValueSearch ──────────────────────────────────────────────────────

describe('buildKeyValueSearch', () => {
    const engine = makeEngine();

    test('builds unquoted key:value string', () => {
        expect(engine.buildKeyValueSearch('name', ['alice'], false)).toBe('name:alice');
    });

    test('builds quoted key:value string', () => {
        expect(engine.buildKeyValueSearch('name', ['alice smith'], true)).toBe('name:"alice smith"');
    });

    test('joins multiple values with comma', () => {
        expect(engine.buildKeyValueSearch('status', ['active', 'stopped'], false)).toBe('status:active,stopped');
    });

    test('returns empty string for missing key', () => {
        expect(engine.buildKeyValueSearch('', ['value'], false)).toBe('');
    });

    test('returns empty string for empty values array', () => {
        expect(engine.buildKeyValueSearch('key', [], false)).toBe('');
    });
});

// ─── isSearchResultWithKeyValue ───────────────────────────────────────────────

describe('isSearchResultWithKeyValue', () => {
    test('returns false when searchTerm has no colon', () => {
        const engine = makeEngine('hello');
        expect(engine.isSearchResultWithKeyValue({ hello: 'world' })).toBe(false);
    });

    test('returns false when parts.length !== 2 after split', () => {
        const engine = makeEngine('a:b:c');
        expect(engine.isSearchResultWithKeyValue({ a: 'b' })).toBe(false);
    });

    test('returns false when key not in node', () => {
        const engine = makeEngine('missing:value');
        expect(engine.isSearchResultWithKeyValue({ name: 'alice' })).toBe(false);
    });

    test('partial match — unquoted search matches substring', () => {
        const engine = makeEngine('name:ali');
        expect(engine.isSearchResultWithKeyValue({ name: 'alice' })).toBe(true);
    });

    test('exact match — quoted search requires full match', () => {
        const engineExact = makeEngine('name:"alice"');
        expect(engineExact.isSearchResultWithKeyValue({ name: 'alice' })).toBe(true);
        expect(engineExact.isSearchResultWithKeyValue({ name: 'alice smith' })).toBe(false);
    });

    test('negation — returns true when value does NOT match', () => {
        const engine = makeEngine('!name:alice');
        expect(engine.isSearchResultWithKeyValue({ name: 'bob' })).toBe(true);
        expect(engine.isSearchResultWithKeyValue({ name: 'alice' })).toBe(false);
    });

    test('negation with empty value — returns true when field is non-empty', () => {
        const engine = makeEngine('!name:');
        expect(engine.isSearchResultWithKeyValue({ name: 'alice' })).toBe(true);
        expect(engine.isSearchResultWithKeyValue({ name: '' })).toBe(false);
    });

    test('multi-value OR — matches any of the values', () => {
        const engine = makeEngine('status:active,stopped');
        expect(engine.isSearchResultWithKeyValue({ status: 'active' })).toBe(true);
        expect(engine.isSearchResultWithKeyValue({ status: 'stopped' })).toBe(true);
        expect(engine.isSearchResultWithKeyValue({ status: 'decommissioned' })).toBe(false);
    });
});

// ─── isSearchResultValueOnly ──────────────────────────────────────────────────

describe('isSearchResultValueOnly', () => {
    test('returns false when searchTerm is empty', () => {
        const engine = makeEngine('');
        expect(engine.isSearchResultValueOnly({ name: 'alice' })).toBe(false);
    });

    test('returns false when searchTerm contains colon', () => {
        const engine = makeEngine('name:alice');
        expect(engine.isSearchResultValueOnly({ name: 'alice' })).toBe(false);
    });

    test('returns true when any string value includes the term', () => {
        const engine = makeEngine('alice');
        expect(engine.isSearchResultValueOnly({ name: 'alice smith', role: 'engineer' })).toBe(true);
    });

    test('returns false when no value matches', () => {
        const engine = makeEngine('xyz');
        expect(engine.isSearchResultValueOnly({ name: 'alice', role: 'engineer' })).toBe(false);
    });

    test('is case-insensitive', () => {
        const engine = makeEngine('ALICE');
        expect(engine.isSearchResultValueOnly({ name: 'alice' })).toBe(true);
    });

    test('comma-separated terms are OR logic', () => {
        const engine = makeEngine('alice,bob');
        expect(engine.isSearchResultValueOnly({ name: 'bob' })).toBe(true);
        expect(engine.isSearchResultValueOnly({ name: 'charlie' })).toBe(false);
    });
});

// ─── prepareSearchTerm ────────────────────────────────────────────────────────

describe('prepareSearchTerm', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('wraps bare term in id:"…" when relaxed-search is unchecked', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox"/><input id="drawer-search-input"/>';
        const engine = makeEngine('alice');
        engine.prepareSearchTerm();
        expect(engine.searchTerm).toBe('id:"alice"');
    });

    test('does not wrap when relaxed-search is checked', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox" checked/><input id="drawer-search-input"/>';
        const engine = makeEngine('alice');
        engine.prepareSearchTerm();
        expect(engine.searchTerm).toBe('alice');
    });

    test('does not wrap when term already contains colon', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox"/>';
        const engine = makeEngine('name:alice');
        engine.prepareSearchTerm();
        expect(engine.searchTerm).toBe('name:alice');
    });

    test('does not wrap when term contains comma', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox"/>';
        const engine = makeEngine('alice,bob');
        engine.prepareSearchTerm();
        expect(engine.searchTerm).toBe('alice,bob');
    });

    test('does nothing when searchTerm is empty', () => {
        const engine = makeEngine('');
        engine.prepareSearchTerm();
        expect(engine.searchTerm).toBe('');
    });
});

// ─── updateSearchAndRefresh ───────────────────────────────────────────────────

describe('updateSearchAndRefresh', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('sets searchTerm and calls graph.updateVisualization', () => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
        const engine = makeEngine();
        engine.updateSearchAndRefresh('alice');
        expect(engine.searchTerm).toBe('alice');
        expect(engine.app.graph.updateVisualization).toHaveBeenCalledWith(true);
    });

    test('calls drawer.showNodeDetails when clickedNode is set', () => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
        const engine = makeEngine();
        const node = { id: 'SvcA' };
        engine.app.graph.clickedNode = node;
        engine.updateSearchAndRefresh('alice');
        expect(engine.app.drawer.showNodeDetails).toHaveBeenCalledWith(node, true);
    });

    test('clears searchTerm when called with falsy value', () => {
        const engine = makeEngine('previous');
        engine.updateSearchAndRefresh(null);
        expect(engine.searchTerm).toBe('');
    });
});

// ─── handleQuery ─────────────────────────────────────────────────────────────

describe('handleQuery', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('sets searchTerm and calls graph.updateVisualization', () => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
        const engine = makeEngine();
        engine.handleQuery('alice');
        expect(engine.searchTerm).toBe('alice');
        expect(engine.app.graph.updateVisualization).toHaveBeenCalled();
    });

    test('resets clickedNode to null', () => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
        const engine = makeEngine();
        engine.app.graph.clickedNode = { id: 'X' };
        engine.handleQuery('alice');
        expect(engine.app.graph.clickedNode).toBeNull();
    });

    test('passes showDrawer=false when specified', () => {
        document.body.innerHTML = '<input id="drawer-search-input"/>';
        const engine = makeEngine();
        engine.handleQuery('alice', false);
        expect(engine.app.graph.updateVisualization).toHaveBeenCalledWith(false);
    });
});

// ─── initRelaxedSearchPersistence ────────────────────────────────────────────

describe('initRelaxedSearchPersistence', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    test('does nothing when relaxed-search element is absent', () => {
        const engine = makeEngine();
        expect(() => engine.initRelaxedSearchPersistence()).not.toThrow();
    });

    test('restores checked state from localStorage', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox"/>';
        localStorage.setItem('solitaire_relaxed_search', '1');
        const engine = makeEngine();
        engine.initRelaxedSearchPersistence();
        expect(document.getElementById('relaxed-search').checked).toBe(true);
    });

    test('restores unchecked state from localStorage', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox" checked/>';
        localStorage.setItem('solitaire_relaxed_search', '0');
        const engine = makeEngine();
        engine.initRelaxedSearchPersistence();
        expect(document.getElementById('relaxed-search').checked).toBe(false);
    });

    test('attaches change listener that persists state', () => {
        document.body.innerHTML = '<input id="relaxed-search" type="checkbox"/>';
        const engine = makeEngine();
        engine.initRelaxedSearchPersistence();
        const input = document.getElementById('relaxed-search');
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(localStorage.getItem('solitaire_relaxed_search')).toBe('1');
    });
});
