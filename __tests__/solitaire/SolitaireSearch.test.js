import { SolitaireSearch } from '../../js/solitaire/SolitaireSearch.js';

function makeApp(overrides = {}) {
    return {
        searchParam: '',
        renderer: {
            fitToContent: jest.fn(),
            zoomToElement: jest.fn(),
            fitElementToView: jest.fn(),
            _getCollapsedKeys: jest.fn(() => new Set()),
            _expandInPlace: jest.fn(),
            _collapseInPlace: jest.fn(),
        },
        drawer: { open: jest.fn(), close: jest.fn() },
        db: { roleDetailsMapping: new Map(), cachedCsvText: '' },
        loadAndRender: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

describe('SolitaireSearch constructor', () => {
    test('initializes with empty lastSearch and index 0', () => {
        const ss = new SolitaireSearch(makeApp());
        expect(ss.lastSearch).toBe('');
        expect(ss.currentIndex).toBe(0);
    });
});

describe('SolitaireSearch.clear', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/?search=hello');
        document.body.innerHTML = `
            <span id="output">some text</span>
            <input id="drawer-search-input" value="hello"/>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('clears the output element', () => {
        const ss = new SolitaireSearch(makeApp());
        ss.clear();
        expect(document.getElementById('output').textContent).toBe('');
    });

    test('clears the search input value', () => {
        const ss = new SolitaireSearch(makeApp());
        ss.clear();
        expect(document.getElementById('drawer-search-input').value).toBe('');
    });

    test('calls renderer.fitToContent', () => {
        const app = makeApp();
        new SolitaireSearch(app).clear();
        expect(app.renderer.fitToContent).toHaveBeenCalled();
    });

    test('calls drawer.close', () => {
        const app = makeApp();
        new SolitaireSearch(app).clear();
        expect(app.drawer.close).toHaveBeenCalled();
    });

    test('sets app.searchParam to empty string', () => {
        const app = makeApp();
        app.searchParam = 'hello';
        new SolitaireSearch(app).clear();
        expect(app.searchParam).toBe('');
    });
});

describe('SolitaireSearch.search — empty query', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calls clear() when query is empty', () => {
        const app = makeApp();
        document.body.innerHTML = '<span id="output"></span><input id="drawer-search-input"/>';
        const ss = new SolitaireSearch(app);
        ss.clear = jest.fn();
        ss.search('');
        expect(ss.clear).toHaveBeenCalled();
    });
});

describe('SolitaireSearch.search — no match', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <svg><g class="profile-name">Team Alpha</g></svg>
            <input id="drawer-search-input"/>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('shows toast when no match found', () => {
        const app = makeApp();
        const ss = new SolitaireSearch(app);
        ss.search('xyznotfound');
        expect(app.showToast).toHaveBeenCalledWith(expect.stringContaining('No result found'));
    });
});

describe('SolitaireSearch.search — with match', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <svg>
                <g data-key="card::s::t::team::alice">
                    <text class="profile-name">Alice Engineer</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('shows toast with match count', () => {
        const app = makeApp();
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        expect(app.showToast).toHaveBeenCalledWith(expect.stringContaining('result'));
    });

    test('calls renderer.zoomToElement with a target', () => {
        const app = makeApp();
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        expect(app.renderer.zoomToElement).toHaveBeenCalled();
    });

    test('cycles currentIndex on repeated same search', () => {
        const app = makeApp();
        document.body.innerHTML = `
            <svg>
                <g data-key="card::s::t::team::alice1">
                    <text class="profile-name">Alice</text>
                </g>
                <g data-key="card::s::t::team::alice2">
                    <text class="profile-name">Alice</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        expect(ss.currentIndex).toBe(0);
        ss.search('alice');
        expect(ss.currentIndex).toBe(1);
    });

    test('resets currentIndex when query changes', () => {
        const app = makeApp();
        document.body.innerHTML = `
            <svg>
                <g data-key="card::s::t::team::alice">
                    <text class="profile-name">Alice</text>
                </g>
                <g data-key="card::s::t::team::bob">
                    <text class="profile-name">Bob</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        ss.search('bob');
        expect(ss.currentIndex).toBe(0);
    });
});

describe('SolitaireSearch.search — missing mode', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <svg>
                <g data-key="card::s::t::team::bob" data-role=""></g>
            </svg>
            <input id="drawer-search-input"/>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('finds cards with unknown/empty role when missing=true and field=role', () => {
        const app = makeApp();
        const ss = new SolitaireSearch(app);
        ss.search('', { missing: true, field: 'role', noZoom: true });
        expect(app.showToast).toHaveBeenCalledWith(expect.stringContaining('result'));
    });
});

describe('SolitaireSearch.search — fitElementToView routing', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('calls fitElementToView (not zoomToElement) when match is a theme title', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="theme::stream::svcmgmt">
                    <text class="theme-title">Service Management</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const app = makeApp();
        new SolitaireSearch(app).search('service management');
        expect(app.renderer.fitElementToView).toHaveBeenCalled();
        expect(app.renderer.zoomToElement).not.toHaveBeenCalled();
    });

    test('calls fitElementToView (not zoomToElement) when match is a team title', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="team::stream::theme::myteam">
                    <text class="team-title">My Team</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const app = makeApp();
        new SolitaireSearch(app).search('my team');
        expect(app.renderer.fitElementToView).toHaveBeenCalled();
        expect(app.renderer.zoomToElement).not.toHaveBeenCalled();
    });

    test('calls fitElementToView (not zoomToElement) when match is a stream title', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::mystream">
                    <text class="stream-title">My Stream</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const app = makeApp();
        new SolitaireSearch(app).search('my stream');
        expect(app.renderer.fitElementToView).toHaveBeenCalled();
        expect(app.renderer.zoomToElement).not.toHaveBeenCalled();
    });

    test('calls zoomToElement (not fitElementToView) for a profile-name match', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="card::stream::theme::team::alice">
                    <text class="profile-name">Alice Engineer</text>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const app = makeApp();
        new SolitaireSearch(app).search('alice');
        expect(app.renderer.zoomToElement).toHaveBeenCalled();
        expect(app.renderer.fitElementToView).not.toHaveBeenCalled();
    });
});

// ─── Auto-expand collapsed streams on search ─────────────────────────────────

describe('SolitaireSearch — auto-expand collapsed streams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    test('uses in-place expand/collapse only to find matches, not for display', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::s1">
                    <g data-key="card::s1::t::team::alice">
                        <text class="profile-name">Alice</text>
                    </g>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const expandInPlace = jest.fn();
        const collapseInPlace = jest.fn();
        const app = makeApp({
            renderer: {
                fitToContent: jest.fn(), zoomToElement: jest.fn(), fitElementToView: jest.fn(),
                _getCollapsedKeys: jest.fn(() => new Set(['stream::s1'])),
                _expandInPlace: expandInPlace,
                _collapseInPlace: collapseInPlace,
            },
        });
        new SolitaireSearch(app).search('alice');
        // in-place expand used for query discovery
        expect(expandInPlace).toHaveBeenCalledWith('stream::s1');
        // in-place collapse used to undo the temporary expansion
        expect(collapseInPlace).toHaveBeenCalledWith('stream::s1');
    });

    test('calls loadAndRender to expand the matching stream so others reposition', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::s1">
                    <g data-key="card::s1::t::team::alice">
                        <text class="profile-name">Alice</text>
                    </g>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        // _getCollapsedKeys returns the saved state (s1 is collapsed) on first call,
        // then the state after our localStorage.setItem on subsequent calls
        const app = makeApp({
            renderer: {
                fitToContent: jest.fn(), zoomToElement: jest.fn(), fitElementToView: jest.fn(),
                _getCollapsedKeys: jest.fn()
                    .mockReturnValueOnce(new Set(['stream::s1']))  // saved state
                    .mockReturnValue(new Set(['stream::s1'])),     // stored state for diff check
                _expandInPlace: jest.fn(),
                _collapseInPlace: jest.fn(),
            },
        });
        new SolitaireSearch(app).search('alice');
        expect(app.loadAndRender).toHaveBeenCalled();
    });

    test('cycling to result in a different collapsed stream triggers loadAndRender', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::s1">
                    <g data-key="card::s1::t::team::alice">
                        <text class="profile-name">Alice</text>
                    </g>
                </g>
                <g data-key="stream::s2">
                    <g data-key="card::s2::t::team::alice2">
                        <text class="profile-name">Alice 2</text>
                    </g>
                </g>
            </svg>
            <input id="drawer-search-input"/>
        `;
        const savedKeys = new Set(['stream::s1', 'stream::s2']);
        // After first search: localStorage has s2 collapsed (s1 opened)
        // After cycling: current stored state is {s2} (s1 open), wanted state is {s1} (s2 open)
        const app = makeApp({
            renderer: {
                fitToContent: jest.fn(), zoomToElement: jest.fn(), fitElementToView: jest.fn(),
                _getCollapsedKeys: jest.fn()
                    .mockReturnValueOnce(new Set(savedKeys))   // capture saved state
                    .mockReturnValueOnce(new Set(savedKeys))   // restore localStorage check (new query)
                    .mockReturnValueOnce(new Set(savedKeys))   // stateChanged diff (first _showResult)
                    .mockReturnValueOnce(new Set(['stream::s2'])) // stateChanged diff (cycling to s2)
                    .mockReturnValue(new Set(['stream::s2'])),
                _expandInPlace: jest.fn(),
                _collapseInPlace: jest.fn(),
            },
        });
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        app.loadAndRender.mockClear();
        ss.search('alice'); // cycle to next result (stream::s2)
        expect(app.loadAndRender).toHaveBeenCalled();
    });

    test('clear() restores original collapsed state via loadAndRender', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::s1">
                    <g data-key="card::s1::t::team::alice">
                        <text class="profile-name">Alice</text>
                    </g>
                </g>
            </svg>
            <span id="output"></span>
            <input id="drawer-search-input"/>
        `;
        const app = makeApp({
            renderer: {
                fitToContent: jest.fn(), zoomToElement: jest.fn(), fitElementToView: jest.fn(),
                // After search, stored state is {s1} minus {s1} = {} (s1 open)
                // On clear, savedCollapsedKeys is {s1}, currentStored is {}  → stateChanged
                _getCollapsedKeys: jest.fn()
                    .mockReturnValueOnce(new Set(['stream::s1']))  // capture saved state
                    .mockReturnValueOnce(new Set(['stream::s1']))  // restore check (new query)
                    .mockReturnValueOnce(new Set(['stream::s1']))  // stateChanged in _showResult
                    .mockReturnValue(new Set()),                   // stateChanged in clear()
                _expandInPlace: jest.fn(),
                _collapseInPlace: jest.fn(),
            },
        });
        const ss = new SolitaireSearch(app);
        ss.search('alice');
        app.loadAndRender.mockClear();
        ss.clear();
        expect(app.loadAndRender).toHaveBeenCalled();
    });
});
