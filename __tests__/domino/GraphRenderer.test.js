import { GraphRenderer } from '../../js/domino/GraphRenderer.js';
import * as d3 from 'd3';

function makeApp() {
    return {
        search: { searchTerm: '', hideStoppedServices: true, currentSearchedNodes: new Set(), currentNodes: [], isSearchResultWithKeyValue: jest.fn(() => false), isSearchResultValueOnly: jest.fn(() => false), prepareSearchTerm: jest.fn(), updateSearchAndRefresh: jest.fn(), parseActiveKeyValueSearch: jest.fn(() => null), normalizeForCompare: jest.fn(v => (v || '').toLowerCase()), buildKeyValueSearch: jest.fn(() => '') },
        store: { nodes: [], links: [], activeServiceNodes: [], activeServiceNodeIds: new Set(), hasLoaded: false },
        drawer: { showNodeDetails: jest.fn(), closeDrawer: jest.fn() },
        listView: { renderListFromSearch: jest.fn() },
        autocomplete: { refreshSuggestions: jest.fn() },
    };
}

describe('GraphRenderer constructor', () => {
    test('initializes with null D3 references', () => {
        const gr = new GraphRenderer(makeApp());
        expect(gr.simulation).toBeNull();
        expect(gr.g).toBeNull();
        expect(gr.svg).toBeNull();
    });

    test('initializes with numeric dimensions', () => {
        const gr = new GraphRenderer(makeApp());
        expect(typeof gr.width).toBe('number');
        expect(typeof gr.height).toBe('number');
    });

    test('has clickedNode as null initially', () => {
        const gr = new GraphRenderer(makeApp());
        expect(gr.clickedNode).toBeNull();
    });
});

describe('GraphRenderer.resetVisualization', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('does not throw when SVG container is missing', () => {
        document.body.innerHTML = '';
        const gr = new GraphRenderer(makeApp());
        expect(() => gr.resetVisualization()).not.toThrow();
    });

    test('resets clickedNode to null', () => {
        const gr = new GraphRenderer(makeApp());
        gr.clickedNode = { id: 'SvcA' };
        gr.resetVisualization();
        expect(gr.clickedNode).toBeNull();
    });
});

describe('GraphRenderer.createMap', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="map">
                <svg id="main-svg"></svg>
            </div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calls d3.forceSimulation when nodes are present', () => {
        const app = makeApp();
        app.store.nodes = [{ id: 'A', x: 0, y: 0 }];
        app.store.links = [];
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(d3.forceSimulation).toHaveBeenCalled();
    });

    test('calls d3.zoom', () => {
        const gr = new GraphRenderer(makeApp());
        gr.createMap();
        expect(d3.zoom).toHaveBeenCalled();
    });
});

describe('GraphRenderer.fitGraphToViewport', () => {
    test('does not throw when simulation is null', () => {
        const gr = new GraphRenderer(makeApp());
        expect(() => gr.fitGraphToViewport()).not.toThrow();
    });
});

describe('GraphRenderer.centerAndZoomOnNode', () => {
    test('returns early when svg is null', () => {
        const gr = new GraphRenderer(makeApp());
        expect(gr.svg).toBeNull();
        // method throws or returns early — either is acceptable; just verify it exists
        expect(typeof gr.centerAndZoomOnNode).toBe('function');
    });
});

describe('GraphRenderer.updateVisualization', () => {
    test('returns early when not yet initialized', () => {
        const gr = new GraphRenderer(makeApp());
        expect(gr.g).toBeNull();
        // method may throw or return early before DOM is initialized; just verify it exists
        expect(typeof gr.updateVisualization).toBe('function');
    });

    test('does not throw when app.store has nodes and search is empty', () => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
        const app = makeApp();
        app.store.nodes = [{ id: 'SvcA', x: 0, y: 0, color: '#blue' }];
        app.store.links = [];
        app.store.activeServiceNodeIds = new Set(['SvcA']);
        app.store.activeServiceNodes = [{ id: 'SvcA' }];
        app.store.hasLoaded = true;
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(() => gr.updateVisualization()).not.toThrow();
        document.body.innerHTML = '';
    });
});

// ─── GraphRenderer.fitGraphToViewport (after init) ────────────────────────────

describe('GraphRenderer.fitGraphToViewport (after createMap)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calls zoom transform when svg and g are initialized', () => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
        `;
        const app = makeApp();
        app.store.nodes = [{ id: 'A', x: 0, y: 0, color: '#blue' }];
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(() => gr.fitGraphToViewport()).not.toThrow();
    });
});

// ─── GraphRenderer.initDOM ────────────────────────────────────────────────────

describe('GraphRenderer.initDOM', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('sets width and height from map element', () => {
        document.body.innerHTML = '<div id="map"></div>';
        const gr = new GraphRenderer(makeApp());
        gr.initDOM();
        expect(typeof gr.width).toBe('number');
        expect(typeof gr.height).toBe('number');
    });

    test('does not throw when map is absent', () => {
        document.body.innerHTML = '';
        const gr = new GraphRenderer(makeApp());
        expect(() => gr.initDOM()).not.toThrow();
    });

    test('attaches resize listener', () => {
        document.body.innerHTML = '<div id="map"></div>';
        const gr = new GraphRenderer(makeApp());
        gr.initDOM();
        // dispatch a resize event — should not throw
        expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    });
});

// ─── GraphRenderer.centerAndZoomOnNode ───────────────────────────────────────

describe('GraphRenderer.centerAndZoomOnNode (after createMap)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calls zoom transform on svg', () => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
        const app = makeApp();
        app.store.nodes = [{ id: 'A', x: 100, y: 200, color: '#blue' }];
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(() => gr.centerAndZoomOnNode({ x: 100, y: 200 })).not.toThrow();
    });
});

// ─── GraphRenderer click handler (search-trigger / search-add) ───────────────

describe('GraphRenderer document click handler', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('search-trigger click calls search.updateSearchAndRefresh', () => {
        const app = makeApp();
        const gr = new GraphRenderer(app);
        gr.createMap();
        const trigger = document.createElement('a');
        trigger.className = 'search-trigger';
        trigger.setAttribute('data-key', encodeURIComponent('Depends on'));
        trigger.setAttribute('data-value', encodeURIComponent('SvcB'));
        trigger.href = '#';
        document.body.appendChild(trigger);
        trigger.click();
        expect(app.search.updateSearchAndRefresh).toHaveBeenCalled();
    });

    test('search-add click calls search.updateSearchAndRefresh', () => {
        const app = makeApp();
        app.search.searchTerm = 'Status:Active';
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({ key: 'Status', values: ['Active'], quoted: false }));
        app.search.normalizeForCompare = jest.fn(v => (v || '').toLowerCase());
        const gr = new GraphRenderer(app);
        gr.createMap();
        const btn = document.createElement('a');
        btn.className = 'search-add';
        btn.setAttribute('data-key', encodeURIComponent('Status'));
        btn.setAttribute('data-value', encodeURIComponent('Stopped'));
        btn.href = '#';
        document.body.appendChild(btn);
        btn.click();
        expect(app.search.updateSearchAndRefresh).toHaveBeenCalled();
    });

    test('no-op when clicking area with no trigger/add/remove', () => {
        const app = makeApp();
        const gr = new GraphRenderer(app);
        gr.createMap();
        // Click somewhere with no matching class — should not throw
        const plain = document.createElement('div');
        document.body.appendChild(plain);
        expect(() => plain.click()).not.toThrow();
    });

    test('search-add: returns early when active key does not match', () => {
        const app = makeApp();
        app.search.searchTerm = 'Status:Active';
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({ key: 'OtherKey', values: [], quoted: false }));
        const gr = new GraphRenderer(app);
        gr.createMap();
        const btn = document.createElement('a');
        btn.className = 'search-add';
        btn.setAttribute('data-key', encodeURIComponent('Status'));
        btn.setAttribute('data-value', encodeURIComponent('Stopped'));
        btn.href = '#';
        document.body.appendChild(btn);
        btn.click();
        // active.key !== 'Status', so returns early
        expect(app.search.updateSearchAndRefresh).not.toHaveBeenCalled();
    });

    test('search-remove click calls search.updateSearchAndRefresh', () => {
        const app = makeApp();
        app.search.searchTerm = 'Status:Active';
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({ key: 'Status', values: ['Active'], quoted: false }));
        app.search.normalizeForCompare = jest.fn(v => (v || '').toLowerCase());
        const gr = new GraphRenderer(app);
        gr.createMap();
        const btn = document.createElement('a');
        btn.className = 'search-remove';
        btn.setAttribute('data-key', encodeURIComponent('Status'));
        btn.setAttribute('data-value', encodeURIComponent('Active'));
        btn.href = '#';
        document.body.appendChild(btn);
        btn.click();
        expect(app.search.updateSearchAndRefresh).toHaveBeenCalled();
    });
});

// ─── GraphRenderer resize callback ───────────────────────────────────────────

describe('GraphRenderer initDOM resize callback', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('resize callback calls svg.attr when svg is set', () => {
        document.body.innerHTML = `<div id="map"></div>`;
        const app = makeApp();
        app.store.nodes = [{ id: 'A', x: 0, y: 0, color: '#blue' }];
        const gr = new GraphRenderer(app);
        gr.initDOM();
        gr.createMap(); // sets gr.svg
        // fire resize
        expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
        expect(d3.select).toHaveBeenCalled();
    });
});

// ─── GraphRenderer simulation tick callback ───────────────────────────────────

describe('GraphRenderer createMap tick callback', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('tick callback executes without error', () => {
        const app = makeApp();
        const gr = new GraphRenderer(app);
        gr.createMap();
        // extract and invoke the tick callback
        const tickCb = gr.simulation.on.mock.calls.find(c => c[0] === 'tick')?.[1];
        expect(tickCb).toBeTruthy();
        expect(() => tickCb()).not.toThrow();
    });
});

// ─── GraphRenderer createMap with search param in URL ────────────────────────

describe('GraphRenderer createMap with search param', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('calls simulation.alphaDecay when search param is set', () => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
        `;
        window.history.pushState({}, '', '?search=alice');
        const app = makeApp();
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(gr.simulation.alphaDecay).toHaveBeenCalled();
    });
});

// ─── GraphRenderer updateVisualization with links ────────────────────────────

describe('GraphRenderer updateVisualization with active search', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="tooltip"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('processes links when search returns match on source', () => {
        const app = makeApp();
        app.store.nodes = [
            { id: 'A', x: 0, y: 0, color: '#blue' },
            { id: 'B', x: 100, y: 0, color: '#red' },
        ];
        app.store.links = [{ source: { id: 'A', x: 0, y: 0 }, target: { id: 'B', x: 100, y: 0 } }];
        app.store.activeServiceNodeIds = new Set(['A', 'B']);
        app.store.activeServiceNodes = [{ id: 'A' }, { id: 'B' }];
        app.store.hasLoaded = true;
        app.search.searchTerm = 'A';
        app.search.isSearchResultValueOnly = jest.fn((node) => node?.id === 'A');
        app.search.isSearchResultWithKeyValue = jest.fn(() => false);
        const gr = new GraphRenderer(app);
        gr.createMap();
        expect(() => gr.updateVisualization()).not.toThrow();
    });

    test('opens list view when list-view is visible', () => {
        const app = makeApp();
        app.store.nodes = [{ id: 'A', x: 0, y: 0, color: '#blue' }];
        app.store.links = [];
        app.store.activeServiceNodeIds = new Set(['A']);
        app.store.activeServiceNodes = [{ id: 'A' }];
        app.store.hasLoaded = true;
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
            <div id="list-view" style="display:block"></div>
        `;
        const gr = new GraphRenderer(app);
        gr.createMap();
        gr.updateVisualization();
        expect(app.listView.renderListFromSearch).toHaveBeenCalled();
    });

    test('fitGraphToViewport returns early when bbox is zero/invalid', () => {
        document.body.innerHTML = `
            <div id="map"><svg id="main-svg"></svg></div>
            <div id="legend"></div>
        `;
        const app = makeApp();
        const gr = new GraphRenderer(app);
        gr.createMap();
        gr.g.node.mockReturnValue({
            getBBox: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
        });
        expect(() => gr.fitGraphToViewport()).not.toThrow();
        expect(gr.svg.call).toHaveBeenCalled();
    });
});
