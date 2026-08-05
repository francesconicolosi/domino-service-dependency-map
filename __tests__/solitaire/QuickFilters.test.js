import { QuickFilters } from '../../js/solitaire/QuickFilters.js';

function makeApp() {
    return {
        db: { cachedCsvText: 'csv-data' },
        loadAndRender: jest.fn(),
    };
}

const SAMPLE_CSV = `Name,Description,Visible Streams,Visible Themes,Visible Teams
Digital Only,Show digital streams only,"Stream A||Stream B",,
Agile Teams,Show agile teams,,"Theme X","Team Alpha||Team Beta"
All Streams,No stream constraint,,,
`;

// ─── constructor ──────────────────────────────────────────────────────────────

describe('QuickFilters constructor', () => {
    test('initializes with empty filters array', () => {
        const qf = new QuickFilters(makeApp());
        expect(qf.filters).toEqual([]);
    });

    test('initializes activeFilter as null', () => {
        const qf = new QuickFilters(makeApp());
        expect(qf.activeFilter).toBeNull();
    });

    test('has correct localStorage key', () => {
        const qf = new QuickFilters(makeApp());
        expect(qf.LS_KEY).toBe('dsm-quick-filters-v1');
    });

    test('stores app reference', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        expect(qf.app).toBe(app);
    });
});

// ─── load ─────────────────────────────────────────────────────────────────────

describe('QuickFilters.load', () => {
    afterEach(() => {
        localStorage.clear();
    });

    test('parses CSV and populates filters array', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters).toHaveLength(3);
    });

    test('parses filter name correctly', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[0].name).toBe('Digital Only');
    });

    test('parses filter description correctly', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[0].description).toBe('Show digital streams only');
    });

    test('parses Visible Streams into a Set', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[0].visibleStreams).toBeInstanceOf(Set);
        expect(qf.filters[0].visibleStreams.has('Stream A')).toBe(true);
        expect(qf.filters[0].visibleStreams.has('Stream B')).toBe(true);
    });

    test('empty Visible Streams column produces null (no constraint)', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        // "Agile Teams" has no stream constraint
        expect(qf.filters[1].visibleStreams).toBeNull();
    });

    test('parses Visible Themes into a Set', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[1].visibleThemes).toBeInstanceOf(Set);
        expect(qf.filters[1].visibleThemes.has('Theme X')).toBe(true);
    });

    test('empty Visible Themes column produces null', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[0].visibleThemes).toBeNull();
    });

    test('parses Visible Teams into a Set', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[1].visibleTeams).toBeInstanceOf(Set);
        expect(qf.filters[1].visibleTeams.has('Team Alpha')).toBe(true);
        expect(qf.filters[1].visibleTeams.has('Team Beta')).toBe(true);
    });

    test('empty Visible Teams column produces null', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[0].visibleTeams).toBeNull();
    });

    test('all columns empty produces all-null constraints', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.filters[2].visibleStreams).toBeNull();
        expect(qf.filters[2].visibleThemes).toBeNull();
        expect(qf.filters[2].visibleTeams).toBeNull();
    });

    test('restores activeFilter from localStorage after load', () => {
        localStorage.setItem('dsm-quick-filters-v1', 'Digital Only');
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.activeFilter).toBe('Digital Only');
    });

    test('activeFilter stays null when localStorage is empty', () => {
        localStorage.clear();
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(qf.activeFilter).toBeNull();
    });
});

// ─── getConstraints ───────────────────────────────────────────────────────────

describe('QuickFilters.getConstraints', () => {
    test('returns null when no active filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = null;
        expect(qf.getConstraints()).toBeNull();
    });

    test('returns constraint object for active filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        const c = qf.getConstraints();
        expect(c).not.toBeNull();
        expect(c.visibleStreams).toBeInstanceOf(Set);
        expect(c.visibleStreams.has('Stream A')).toBe(true);
    });

    test('returns null when activeFilter name does not match any filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Nonexistent Filter';
        expect(qf.getConstraints()).toBeNull();
    });

    test('constraint has null visibleThemes when Visible Themes was empty', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        expect(qf.getConstraints().visibleThemes).toBeNull();
    });

    test('two active filters: visibleStreams is intersected (AND)', () => {
        const csv = `Name,Description,Visible Streams,Visible Themes,Visible Teams,Visible People,Hidden Streams,Hidden Themes,Hidden Teams,Hidden People
F1,,Stream A||Stream B,,,,,,,
F2,,Stream B||Stream C,,,,,,,
`;
        const qf = new QuickFilters(makeApp());
        qf.load(csv);
        qf.activeFilters = new Set(['F1', 'F2']);
        const c = qf.getConstraints();
        expect(c.visibleStreams.has('Stream B')).toBe(true);
        expect(c.visibleStreams.has('Stream A')).toBe(false);
        expect(c.visibleStreams.has('Stream C')).toBe(false);
    });

    test('two active filters: hiddenStreams is unioned', () => {
        const csv = `Name,Description,Visible Streams,Visible Themes,Visible Teams,Visible People,Hidden Streams,Hidden Themes,Hidden Teams,Hidden People
F1,,,,,,Stream X,,,
F2,,,,,,Stream Y,,,
`;
        const qf = new QuickFilters(makeApp());
        qf.load(csv);
        qf.activeFilters = new Set(['F1', 'F2']);
        const c = qf.getConstraints();
        expect(c.hiddenStreams.has('Stream X')).toBe(true);
        expect(c.hiddenStreams.has('Stream Y')).toBe(true);
    });
});

// ─── toggle ───────────────────────────────────────────────────────────────────

describe('QuickFilters.toggle', () => {
    afterEach(() => {
        localStorage.clear();
    });

    test('sets activeFilter to the given name', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.toggle('Digital Only');
        expect(qf.activeFilter).toBe('Digital Only');
    });

    test('deactivates filter when toggling the already-active filter', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.toggle('Digital Only');
        expect(qf.activeFilter).toBeNull();
    });

    test('calls app.loadAndRender with cachedCsvText', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.toggle('Digital Only');
        expect(app.loadAndRender).toHaveBeenCalledWith('csv-data');
    });

    test('persists active filter to localStorage', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.toggle('Digital Only');
        expect(localStorage.getItem('dsm-quick-filters-v1')).toBe('Digital Only');
    });

    test('persists empty string to localStorage when deactivating', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.toggle('Digital Only');
        expect(localStorage.getItem('dsm-quick-filters-v1')).toBe('');
    });
});

// ─── _persist / _restore ──────────────────────────────────────────────────────

describe('QuickFilters._persist and _restore', () => {
    afterEach(() => {
        localStorage.clear();
    });

    test('_persist saves activeFilter to localStorage', () => {
        const qf = new QuickFilters(makeApp());
        qf.activeFilter = 'Agile Teams';
        qf._persist();
        expect(localStorage.getItem('dsm-quick-filters-v1')).toBe('Agile Teams');
    });

    test('_persist saves empty string when activeFilter is null', () => {
        const qf = new QuickFilters(makeApp());
        qf.activeFilter = null;
        qf._persist();
        expect(localStorage.getItem('dsm-quick-filters-v1')).toBe('');
    });

    test('_restore reads activeFilter from localStorage when filter exists', () => {
        localStorage.setItem('dsm-quick-filters-v1', 'Digital Only');
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV); // populates filters before _restore is called by load
        expect(qf.activeFilter).toBe('Digital Only');
    });

    test('_restore sets activeFilter to null when localStorage is empty', () => {
        localStorage.clear();
        const qf = new QuickFilters(makeApp());
        qf._restore();
        expect(qf.activeFilter).toBeNull();
    });
});

// ─── render ───────────────────────────────────────────────────────────────────

describe('QuickFilters.render', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="qf-filters-btn-slot"></div><div id="quick-filters-bar"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('renders a dropdown item for each filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        // 3 CSV filters + 2 builtin (Communities Only / Teams Only)
        expect(document.querySelectorAll('.qf-dropdown-item')).toHaveLength(5);
    });

    test('dropdown item text matches filter name', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        const items = Array.from(document.querySelectorAll('.qf-dropdown-item'));
        expect(items.some(el => el.textContent.includes('Digital Only'))).toBe(true);
    });

    test('active filter item has qf-dropdown-item--active class', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        const items = Array.from(document.querySelectorAll('.qf-dropdown-item'));
        const active = items.find(el => el.textContent.includes('Digital Only'));
        expect(active.classList.contains('qf-dropdown-item--active')).toBe(true);
    });

    test('inactive filter items do not have qf-dropdown-item--active class', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = null;
        qf.render();
        const items = Array.from(document.querySelectorAll('.qf-dropdown-item'));
        items.forEach(el => expect(el.classList.contains('qf-dropdown-item--active')).toBe(false));
    });

    test('does not throw when #quick-filters-bar is missing', () => {
        document.body.innerHTML = '';
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        expect(() => qf.render()).not.toThrow();
    });

    test('dropdown item has data-tooltip attribute with description', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        const item = document.querySelector('.qf-dropdown-item[data-filter-name="Digital Only"]');
        expect(item.getAttribute('data-tooltip')).toBe('Show digital streams only');
    });
});

// ─── initEvents ───────────────────────────────────────────────────────────────

describe('QuickFilters.initEvents', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="qf-filters-btn-slot"></div><div id="quick-filters-bar"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    test('click on dropdown item calls toggle with filter name', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.render();
        qf.initEvents();

        Array.from(document.querySelectorAll('.qf-dropdown-item'))
            .find(el => el.textContent.includes('Digital Only'))
            .click();
        expect(qf.activeFilter).toBe('Digital Only');
        expect(app.loadAndRender).toHaveBeenCalled();
    });

    test('second click on active dropdown item deactivates it', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.render();
        qf.initEvents();

        // First click — activates; toggle() re-renders
        Array.from(document.querySelectorAll('.qf-dropdown-item'))
            .find(el => el.textContent.includes('Digital Only'))
            .click();

        // Re-query after render() replaced DOM
        Array.from(document.querySelectorAll('.qf-dropdown-item'))
            .find(el => el.textContent.includes('Digital Only'))
            .click();

        expect(qf.activeFilter).toBeNull();
    });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('QuickFilters.clearAll', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="qf-filters-btn-slot"></div><div id="quick-filters-bar"></div>';
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    test('sets activeFilter to null', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.clearAll();
        expect(qf.activeFilter).toBeNull();
    });

    test('calls app.loadAndRender', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.clearAll();
        expect(app.loadAndRender).toHaveBeenCalledWith('csv-data');
    });

    test('persists empty string to localStorage', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.clearAll();
        expect(localStorage.getItem('dsm-quick-filters-v1')).toBe('');
    });
});

// ─── render — new two-row design ─────────────────────────────────────────────

describe('QuickFilters.render — new design', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="qf-filters-btn-slot"></div><div id="quick-filters-bar"></div>';
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    test('renders a Filters dropdown button', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        expect(document.getElementById('qf-dropdown-btn')).not.toBeNull();
    });

    test('Filters button shows count 0 when no filter active', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = null;
        qf.render();
        const btn = document.getElementById('qf-dropdown-btn');
        expect(btn.textContent).toMatch(/Filters/);
        // count is omitted when 0
        expect(btn.textContent).not.toMatch(/\(/);
    });

    test('Filters button shows count 1 when one filter is active', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        expect(document.getElementById('qf-dropdown-btn').textContent).toMatch(/1/);
    });

    test('renders dropdown menu with one item per filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        // 3 CSV filters + 2 builtin (Communities Only / Teams Only)
        expect(document.querySelectorAll('.qf-dropdown-item')).toHaveLength(5);
    });

    test('active filter item has qf-dropdown-item--active class', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        const active = Array.from(document.querySelectorAll('.qf-dropdown-item'))
            .find(el => el.textContent.includes('Digital Only'));
        expect(active.classList.contains('qf-dropdown-item--active')).toBe(true);
    });

    test('renders a chip for the active filter', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        const chips = document.querySelectorAll('.qf-chip');
        expect(chips).toHaveLength(1);
        expect(chips[0].textContent).toContain('Digital Only');
    });

    test('chip has a remove button', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        expect(document.querySelector('.qf-chip__remove')).not.toBeNull();
    });

    test('renders no chips when no filter is active', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        expect(document.querySelectorAll('.qf-chip')).toHaveLength(0);
    });

    test('renders Clear all in dropdown when a filter is active', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        expect(document.querySelector('.qf-dropdown-clear')).not.toBeNull();
    });

    test('renders no Clear all in dropdown when no filter is active', () => {
        const qf = new QuickFilters(makeApp());
        qf.load(SAMPLE_CSV);
        qf.render();
        expect(document.querySelector('.qf-dropdown-clear')).toBeNull();
    });
});

// ─── initEvents — new design ──────────────────────────────────────────────────

describe('QuickFilters.initEvents — new design', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="qf-filters-btn-slot"></div><div id="quick-filters-bar"></div>';
        localStorage.clear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    test('click on dropdown item activates that filter', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.render();
        qf.initEvents();
        Array.from(document.querySelectorAll('.qf-dropdown-item'))
            .find(el => el.textContent.includes('Digital Only'))
            .click();
        expect(qf.activeFilter).toBe('Digital Only');
    });

    test('click on chip remove button deactivates filter', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        qf.initEvents();
        document.querySelector('.qf-chip__remove').click();
        expect(qf.activeFilter).toBeNull();
    });

    test('click on Clear all calls clearAll and sets activeFilter null', () => {
        const app = makeApp();
        const qf = new QuickFilters(app);
        qf.load(SAMPLE_CSV);
        qf.activeFilter = 'Digital Only';
        qf.render();
        qf.initEvents();
        document.querySelector('.qf-dropdown-clear').click();
        expect(qf.activeFilter).toBeNull();
    });
});
