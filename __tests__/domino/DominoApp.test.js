import { DominoApp } from '../../js/domino/DominoApp.js';
import { ServiceCatalogStore } from '../../js/domino/ServiceCatalogStore.js';
import { SearchEngine } from '../../js/domino/SearchEngine.js';
import { AutocompleteEngine } from '../../js/domino/AutocompleteEngine.js';
import { GraphRenderer } from '../../js/domino/GraphRenderer.js';
import { ListView } from '../../js/domino/ListView.js';
import { DetailDrawer } from '../../js/domino/DetailDrawer.js';

describe('DominoApp constructor', () => {
    test('instantiates all sub-components', () => {
        const app = new DominoApp();
        expect(app.store).toBeInstanceOf(ServiceCatalogStore);
        expect(app.search).toBeInstanceOf(SearchEngine);
        expect(app.autocomplete).toBeInstanceOf(AutocompleteEngine);
        expect(app.graph).toBeInstanceOf(GraphRenderer);
        expect(app.listView).toBeInstanceOf(ListView);
        expect(app.drawer).toBeInstanceOf(DetailDrawer);
    });
});

describe('DominoApp._isAdvancedMode', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        window.history.pushState({}, '', '/');
    });

    test('returns false by default', () => {
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(false);
    });

    test('returns true when URL has ?advanced=true', () => {
        window.history.pushState({}, '', '?advanced=true');
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(true);
    });

    test('returns true when URL has ?mode=advanced', () => {
        window.history.pushState({}, '', '?mode=advanced');
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(true);
    });

    test('returns true when body has .advanced class', () => {
        document.body.classList.add('advanced');
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(true);
    });

    test('returns true when toggle checkbox is checked', () => {
        document.body.innerHTML = '<input id="advanced-mode" type="checkbox" checked/>';
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(true);
    });

    test('returns false when toggle checkbox is unchecked', () => {
        document.body.innerHTML = '<input id="advanced-mode" type="checkbox"/>';
        const app = new DominoApp();
        expect(app._isAdvancedMode()).toBe(false);
    });
});

describe('DominoApp.init', () => {
    function setupMinimalDOM() {
        document.body.innerHTML = `
            <div id="map"></div>
            <div id="list-view"></div>
            <div id="legend"></div>
            <button id="view-list"></button>
            <button id="view-graph"></button>
            <div id="drawer"></div>
            <div id="overlay"></div>
            <div id="side-drawer"></div>
            <div id="side-overlay"></div>
            <button id="side-close"></button>
            <button id="toggle-cta"></button>
            <button id="act-upload"></button>
            <input id="fileInput"/>
            <input id="drawer-search-input"/>
        `;
        window.currentColumnKeys = [];
    }

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        window.history.pushState({}, '', '/');
        window.currentColumnKeys = [];
    });

    test('init does not throw with minimal DOM', () => {
        setupMinimalDOM();
        const app = new DominoApp();
        expect(() => app.init()).not.toThrow();
    });

    test('initializes listView DOM elements', () => {
        setupMinimalDOM();
        const app = new DominoApp();
        app.init();
        expect(app.listView.mapEl).toBeTruthy();
    });
});

describe('DominoApp._processAndRender', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('calls store.processData', () => {
        document.body.innerHTML = '<div id="map"></div><div id="legend"></div>';
        const app = new DominoApp();
        const mockScale = jest.fn(() => '#ff0000');
        mockScale.domain = jest.fn(() => []);
        app.store.processData = jest.fn(() => mockScale);
        app.graph.createMap = jest.fn();
        app.legend.render = jest.fn();
        app.autocomplete.buildIndex = jest.fn();
        app.graph.fitGraphToViewport = jest.fn();
        app.search.prepareSearchTerm = jest.fn();

        const data = Object.assign([{ 'Service Name': 'SvcA', Type: 'App', 'Depends on': '', Status: 'Active', 'Decommission Date': '', Description: '' }], {
            columns: ['Service Name', 'Type', 'Depends on', 'Status', 'Decommission Date', 'Description']
        });

        app._processAndRender(data);
        expect(app.store.processData).toHaveBeenCalledWith(data);
    });

    test('returns early when store.processData returns null', () => {
        const app = new DominoApp();
        app.store.processData = jest.fn(() => null);
        app.graph.createMap = jest.fn();
        app._processAndRender([]);
        expect(app.graph.createMap).not.toHaveBeenCalled();
    });
});

// ─── DominoApp._initSideDrawerEvents (event handlers) ────────────────────────

describe('DominoApp._initSideDrawerEvents event handlers', () => {
    function setupFullDOM() {
        document.body.innerHTML = `
            <div id="map"></div>
            <div id="list-view"></div>
            <div id="legend"></div>
            <button id="view-list"></button>
            <button id="view-graph"></button>
            <div id="drawer"></div>
            <div id="overlay"></div>
            <div id="side-drawer"></div>
            <div id="side-overlay"></div>
            <button id="side-close"></button>
            <button id="toggle-cta"></button>
            <button id="act-clear"></button>
            <button id="act-fit"></button>
            <button id="drawer-search-go"></button>
            <input id="drawer-search-input" value=""/>
            <input id="toggle-decommissioned" type="checkbox"/>
            <input id="fileInput"/>
            <div id="drawer-actions"></div>
        `;
        window.currentColumnKeys = [];
    }

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
        window.history.pushState({}, '', '/');
        window.currentColumnKeys = [];
    });

    test('act-clear click resets search and calls updateVisualization', () => {
        setupFullDOM();
        const app = new DominoApp();
        app.init();
        app.graph.updateVisualization = jest.fn();
        app.graph.fitGraphToViewport = jest.fn();
        document.getElementById('act-clear').click();
        expect(app.search.searchTerm).toBe('');
        expect(app.graph.updateVisualization).toHaveBeenCalled();
    });

    test('toggle-decommissioned change updates hideStoppedServices', () => {
        setupFullDOM();
        const app = new DominoApp();
        app.init();
        app.graph.updateVisualization = jest.fn();
        const toggle = document.getElementById('toggle-decommissioned');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.search.hideStoppedServices).toBe(false);
    });

    test('act-fit click calls fitGraphToViewport', () => {
        setupFullDOM();
        const app = new DominoApp();
        app.init();
        app.graph.fitGraphToViewport = jest.fn();
        document.getElementById('act-fit').click();
        expect(app.graph.fitGraphToViewport).toHaveBeenCalled();
    });

    test('drawer-search-go click calls search.handleQuery', () => {
        setupFullDOM();
        const app = new DominoApp();
        app.init();
        app.search.handleQuery = jest.fn();
        document.getElementById('drawer-search-input').value = 'alice';
        document.getElementById('drawer-search-go').click();
        expect(app.search.handleQuery).toHaveBeenCalledWith('alice', false);
    });

    test('Enter key in search input triggers handleQuery', () => {
        setupFullDOM();
        const app = new DominoApp();
        app.init();
        app.search.handleQuery = jest.fn();
        const input = document.getElementById('drawer-search-input');
        input.value = 'svc';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.search.handleQuery).toHaveBeenCalledWith('svc', false);
    });
});

// ─── DominoApp._ensureUploadCsvAction ─────────────────────────────────────────

describe('DominoApp._ensureUploadCsvAction', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('does nothing when fileInput is missing', () => {
        document.body.innerHTML = '';
        const app = new DominoApp();
        expect(() => app._ensureUploadCsvAction()).not.toThrow();
    });

    test('creates upload button when container exists but button is missing', () => {
        document.body.innerHTML = `
            <input id="fileInput"/>
            <div id="drawer-actions"></div>
        `;
        const app = new DominoApp();
        app._ensureUploadCsvAction();
        expect(document.getElementById('act-upload-csv')).toBeTruthy();
    });

    test('reuses existing act-upload button', () => {
        document.body.innerHTML = `
            <input id="fileInput"/>
            <button id="act-upload"></button>
        `;
        const app = new DominoApp();
        app._ensureUploadCsvAction();
        // Should not create a second button
        expect(document.querySelectorAll('#act-upload').length).toBe(1);
    });

    test('shows upload button in advanced mode', () => {
        window.history.pushState({}, '', '?mode=advanced');
        document.body.innerHTML = `
            <input id="fileInput"/>
            <div id="drawer-actions"></div>
        `;
        const app = new DominoApp();
        app._ensureUploadCsvAction();
        const btn = document.getElementById('act-upload-csv');
        expect(btn.style.display).toBe('');
    });

    test('hides upload button in non-advanced mode', () => {
        document.body.innerHTML = `
            <input id="fileInput"/>
            <div id="drawer-actions"></div>
        `;
        const app = new DominoApp();
        app._ensureUploadCsvAction();
        const btn = document.getElementById('act-upload-csv');
        expect(btn.style.display).toBe('none');
    });
});

describe('DominoApp About button', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('clicking act-about calls drawer.showAbout', () => {
        document.body.innerHTML = `
            <div id="side-drawer" aria-hidden="false"></div>
            <div id="side-overlay"></div>
            <button id="side-close"></button>
            <button id="toggle-cta"></button>
            <button id="act-about"></button>
            <div id="map"></div>
            <div id="list-view"></div>
            <div id="legend"></div>
            <input id="drawer-search-input"/>
        `;
        window.currentColumnKeys = [];
        const app = new DominoApp();
        app.drawer.showAbout = jest.fn();
        app._initSideDrawerEvents();
        document.getElementById('act-about').click();
        expect(app.drawer.showAbout).toHaveBeenCalled();
    });
});
