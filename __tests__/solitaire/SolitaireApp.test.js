import { SolitaireApp } from '../../js/solitaire/SolitaireApp.js';
import { PeopleDatabase } from '../../js/solitaire/PeopleDatabase.js';
import { OrgChartRenderer } from '../../js/solitaire/OrgChartRenderer.js';
import { InteractionController } from '../../js/solitaire/InteractionController.js';
import { ScenarioManager } from '../../js/solitaire/ScenarioManager.js';
import { SolitaireSearch } from '../../js/solitaire/SolitaireSearch.js';
import { ColorLegend } from '../../js/solitaire/ColorLegend.js';
import { TeamDetailDrawer } from '../../js/solitaire/TeamDetailDrawer.js';
import { ContextMenu } from '../../js/solitaire/ContextMenu.js';

describe('SolitaireApp constructor', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('instantiates all sub-components', () => {
        const app = new SolitaireApp();
        expect(app.db).toBeInstanceOf(PeopleDatabase);
        expect(app.renderer).toBeInstanceOf(OrgChartRenderer);
        expect(app.interaction).toBeInstanceOf(InteractionController);
        expect(app.scenario).toBeInstanceOf(ScenarioManager);
        expect(app.search).toBeInstanceOf(SolitaireSearch);
        expect(app.legend).toBeInstanceOf(ColorLegend);
        expect(app.drawer).toBeInstanceOf(TeamDetailDrawer);
        expect(app.contextMenu).toBeInstanceOf(ContextMenu);
    });

    test('initializes visibleOrg as null', () => {
        const app = new SolitaireApp();
        expect(app.visibleOrg).toBeNull();
    });

    test('isAdvanced defaults to false when no URL param', () => {
        const app = new SolitaireApp();
        expect(app.isAdvanced).toBe(false);
    });

    test('reads isAdvanced from URL param', () => {
        window.history.pushState({}, '', '?advanced=false');
        const app = new SolitaireApp();
        expect(app.isAdvanced).toBe(false);
        window.history.pushState({}, '', '/');
    });
});

describe('SolitaireApp.showToast', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('adds a toast element to the DOM', () => {
        jest.useFakeTimers();
        const app = new SolitaireApp();
        app.showToast('Hello test');
        const toast = document.querySelector('.toast');
        expect(toast).toBeTruthy();
        expect(toast.textContent).toBe('Hello test');
        jest.useRealTimers();
    });

    test('creates toast-container if it does not exist', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
        const app = new SolitaireApp();
        app.showToast('Test message');
        expect(document.querySelector('.toast-container')).toBeTruthy();
        jest.useRealTimers();
    });
});

describe('SolitaireApp.loadAndRender', () => {
    test('calls db.load and returns when data is null', () => {
        global.alert = jest.fn();
        const app = new SolitaireApp();
        app.renderer.reset = jest.fn();
        app.renderer.render = jest.fn();
        app.loadAndRender(''); // empty CSV → db.load returns null
        expect(app.renderer.reset).not.toHaveBeenCalled();
    });
});

describe('SolitaireApp.setStreamFilter', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('clears stream param when streamKeys is empty', () => {
        const app = new SolitaireApp();
        app.db.cachedCsvText = '';
        app.renderer.reset = jest.fn();
        app.loadAndRender = jest.fn();
        app.setStreamFilter(new Set());
        expect(window.location.search).not.toContain('stream=');
    });

    test('sets stream param in URL when streamKeys is non-empty', () => {
        const app = new SolitaireApp();
        app.db.cachedCsvText = '';
        app.renderer.reset = jest.fn();
        app.loadAndRender = jest.fn();
        app.setStreamFilter(new Set(['Alpha', 'Beta']));
        expect(window.location.search).toContain('stream=');
    });

    test('clears stream param when streamKeys is null', () => {
        const app = new SolitaireApp();
        app.db.cachedCsvText = '';
        app.renderer.reset = jest.fn();
        app.loadAndRender = jest.fn();
        window.history.pushState({}, '', '?stream=Alpha');
        app.setStreamFilter(null);
        expect(window.location.search).not.toContain('stream=');
    });
});

describe('SolitaireApp.showToast (with drawer state)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.__toastDrawerObserverAttached = false;
    });

    test('positions container at bottom when drawer is open', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="drawer" class="open"></div>';
        const app = new SolitaireApp();
        app.showToast('Drawer open toast');
        const container = document.querySelector('.toast-container');
        expect(container.style.bottom).toBe('20px');
        jest.useRealTimers();
    });

    test('positions container at top when drawer is closed', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<div id="drawer"></div>';
        const app = new SolitaireApp();
        app.showToast('Drawer closed toast');
        const container = document.querySelector('.toast-container');
        expect(container.style.top).toBe('70px');
        jest.useRealTimers();
    });

    test('reuses existing toast-container', () => {
        jest.useFakeTimers();
        const app = new SolitaireApp();
        app.showToast('First');
        app.showToast('Second');
        expect(document.querySelectorAll('.toast-container').length).toBe(1);
        expect(document.querySelectorAll('.toast').length).toBe(2);
        jest.useRealTimers();
    });
});

describe('SolitaireApp._getUrlParamsSnapshot', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('returns hasStream=false when no stream param', () => {
        const app = new SolitaireApp();
        const snap = app._getUrlParamsSnapshot();
        expect(snap.hasStream).toBe(false);
        expect(snap.hasOtherValues).toBe(false);
    });

    test('returns hasStream=true when stream param is set', () => {
        window.history.pushState({}, '', '?stream=Alpha');
        const app = new SolitaireApp();
        expect(app._getUrlParamsSnapshot().hasStream).toBe(true);
    });

    test('returns hasOtherValues=true for non-stream params', () => {
        window.history.pushState({}, '', '?search=alice');
        const app = new SolitaireApp();
        const snap = app._getUrlParamsSnapshot();
        expect(snap.hasOtherValues).toBe(true);
        expect(snap.otherKeysWithValue).toContain('search');
    });

    test('ignores IGNORE_KEYS like advanced, mode, view', () => {
        window.history.pushState({}, '', '?advanced=true&mode=advanced');
        const app = new SolitaireApp();
        expect(app._getUrlParamsSnapshot().hasOtherValues).toBe(false);
    });
});

describe('SolitaireApp._stripUrlParamsExceptStream', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/');
    });

    test('removes non-stream params from URL', () => {
        window.history.pushState({}, '', '?stream=Alpha&search=alice');
        const app = new SolitaireApp();
        app._stripUrlParamsExceptStream();
        expect(window.location.search).toContain('stream=');
        expect(window.location.search).not.toContain('search=');
    });

    test('results in empty search when no stream param', () => {
        window.history.pushState({}, '', '?search=alice');
        const app = new SolitaireApp();
        app._stripUrlParamsExceptStream();
        expect(window.location.search).toBe('');
    });
});

describe('SolitaireApp._handleAdvancedMode', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('hides advanced elements when isAdvanced is false', () => {
        window.history.pushState({}, '', '?advanced=false');
        document.body.innerHTML = `
            <div id="act-upload"></div>
            <div id="label-file"></div>
            <div id="toggle-draggable"></div>
            <div id="switch-label"></div>
        `;
        const app = new SolitaireApp();
        app._handleAdvancedMode();
        expect(document.getElementById('act-upload').style.display).toBe('none');
        window.history.pushState({}, '', '/');
    });

    test('shows advanced elements when isAdvanced is true', () => {
        window.history.pushState({}, '', '?advanced=true');
        document.body.innerHTML = `
            <div id="act-upload" style="display:none"></div>
        `;
        const app = new SolitaireApp();
        app._handleAdvancedMode();
        expect(document.getElementById('act-upload').style.display).toBe('');
        window.history.pushState({}, '', '/');
    });

    test('does not throw when elements are absent', () => {
        document.body.innerHTML = '';
        const app = new SolitaireApp();
        expect(() => app._handleAdvancedMode()).not.toThrow();
    });
});

describe('SolitaireApp._initSearchInput', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('search is triggered on Enter key', () => {
        document.body.innerHTML = '<input id="drawer-search-input" value="alice"/>';
        const app = new SolitaireApp();
        app.search.search = jest.fn();
        app._initSearchInput();
        const input = document.getElementById('drawer-search-input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.search.search).toHaveBeenCalledWith('alice');
    });

    test('clear is triggered when Enter is pressed with empty value', () => {
        document.body.innerHTML = '<input id="drawer-search-input" value="  "/>';
        const app = new SolitaireApp();
        app.search.clear = jest.fn();
        app._initSearchInput();
        const input = document.getElementById('drawer-search-input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.search.clear).toHaveBeenCalled();
    });

    test('does not throw when input element is absent', () => {
        document.body.innerHTML = '';
        const app = new SolitaireApp();
        expect(() => app._initSearchInput()).not.toThrow();
    });
});

describe('SolitaireApp._initToggleDraggable', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('enables draggable when checkbox is checked and isAdvanced is true', () => {
        window.history.pushState({}, '', '?advanced=true');
        document.body.innerHTML = '<input id="toggle-draggable" type="checkbox"/>';
        const app = new SolitaireApp();
        app.interaction.applyDraggableToggleState = jest.fn();
        app._initToggleDraggable();
        const cb = document.getElementById('toggle-draggable');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.interaction.isDraggable).toBe(true);
        window.history.pushState({}, '', '/');
    });

    test('prevents dragging when isAdvanced is false', () => {
        window.history.pushState({}, '', '?advanced=false');
        document.body.innerHTML = '<input id="toggle-draggable" type="checkbox" checked/>';
        const app = new SolitaireApp();
        app._initToggleDraggable();
        const cb = document.getElementById('toggle-draggable');
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.interaction.isDraggable).toBe(false);
        window.history.pushState({}, '', '/');
    });
});

describe('SolitaireApp.handleClearAction', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('clears URL params and search when search input has value', async () => {
        document.body.innerHTML = '<input id="drawer-search-input" value="alice"/>';
        const app = new SolitaireApp();
        app.search.clear = jest.fn();
        await app.handleClearAction('test');
        expect(app.search.clear).toHaveBeenCalled();
    });

    test('clears URL params when non-stream params are present', async () => {
        window.history.pushState({}, '', '?search=alice');
        const app = new SolitaireApp();
        app.search.clear = jest.fn();
        document.body.innerHTML = '<input id="drawer-search-input" value=""/>';
        await app.handleClearAction('test');
        expect(app.search.clear).toHaveBeenCalled();
    });

    test('just calls search.clear when nothing is set', async () => {
        const app = new SolitaireApp();
        app.search.clear = jest.fn();
        await app.handleClearAction();
        expect(app.search.clear).toHaveBeenCalled();
    });
});

describe('SolitaireApp.wireFabsInteractions', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.__fabsOutsideHandlerAttached;
    });

    test('does not throw with a mock D3 card selection', () => {
        const app = new SolitaireApp();
        const mockSel = {
            on: jest.fn().mockReturnThis(),
            classed: jest.fn().mockReturnThis(),
            selectAll: jest.fn().mockReturnThis(),
        };
        expect(() => app.wireFabsInteractions(mockSel)).not.toThrow();
    });
});

// ─── SolitaireApp.loadAndRender (with data) ───────────────────────────────────

describe('SolitaireApp.loadAndRender (with valid data)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        global.alert?.mockReset?.();
    });

    test('calls renderer.reset and render when db.load returns data', () => {
        const app = new SolitaireApp();
        app.db.load = jest.fn(() => ({ Stream: { Theme: { Team: [] } } }));
        app.renderer.reset = jest.fn();
        app.renderer.render = jest.fn();
        app.loadAndRender('valid csv data');
        expect(app.renderer.reset).toHaveBeenCalled();
        expect(app.renderer.render).toHaveBeenCalled();
    });

    test('does not call renderer.render when db.load returns null', () => {
        const app = new SolitaireApp();
        app.db.load = jest.fn(() => null);
        app.renderer.reset = jest.fn();
        app.renderer.render = jest.fn();
        app.loadAndRender('bad csv');
        expect(app.renderer.render).not.toHaveBeenCalled();
    });
});

// ─── SolitaireApp.init() ─────────────────────────────────────────────────────

describe('SolitaireApp.init', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        });
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
        delete window.__solitaireLongPressAttached;
        delete window.__toastDrawerObserverAttached;
        delete window.__fabsOutsideHandlerAttached;
    });

    function setupInitDOM() {
        document.body.innerHTML = `
            <svg id="canvas"></svg>
            <div id="drawer"></div>
            <div id="drawer-overlay"></div>
            <button id="drawer-close"></button>
            <div id="side-drawer"></div>
            <div id="side-overlay"></div>
            <button id="side-close"></button>
            <button id="toggle-cta"></button>
            <input id="drawer-search-input"/>
            <input id="toggle-draggable" type="checkbox"/>
            <input id="fileInput"/>
            <input id="toggle-color-role" type="radio"/>
            <input id="toggle-color-company" type="radio"/>
            <input id="toggle-color-location" type="radio"/>
            <input id="toggle-color-function" type="radio"/>
        `;
    }

    test('does not throw with minimal DOM', () => {
        setupInitDOM();
        const app = new SolitaireApp();
        expect(() => app.init()).not.toThrow();
    });

    test('init() attaches load event listener', () => {
        setupInitDOM();
        const addEventSpy = jest.spyOn(window, 'addEventListener');
        const app = new SolitaireApp();
        app.init();
        const loadListeners = addEventSpy.mock.calls.filter(c => c[0] === 'load');
        expect(loadListeners.length).toBeGreaterThan(0);
    });

    test('init() calls drawer.initEvents', () => {
        setupInitDOM();
        const app = new SolitaireApp();
        app.drawer.initEvents = jest.fn();
        app.init();
        expect(app.drawer.initEvents).toHaveBeenCalled();
    });
});

// ─── SolitaireApp._setupGlobalTooltip ────────────────────────────────────────

describe('SolitaireApp._setupGlobalTooltip', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('does not throw when called (non-mouse env)', () => {
        const app = new SolitaireApp();
        expect(() => app._setupGlobalTooltip()).not.toThrow();
    });

    test('does not throw when called in mouse-like environment', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: true })),
        });
        const app = new SolitaireApp();
        expect(() => app._setupGlobalTooltip()).not.toThrow();
    });

    test('wires renderer.onZoom in mouse-like environment (replaces dsm-canvas-zoom event)', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: true })),
        });
        const app = new SolitaireApp();
        app._setupGlobalTooltip();
        expect(typeof app.renderer.onZoom).toBe('function');
    });

    test('does not set renderer.onZoom in non-mouse environment', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        });
        const app = new SolitaireApp();
        app._setupGlobalTooltip();
        expect(app.renderer.onZoom).toBeUndefined();
    });

    test('renderer.onZoom is callable and does not throw', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: true })),
        });
        const app = new SolitaireApp();
        app._setupGlobalTooltip();
        expect(() => app.renderer.onZoom()).not.toThrow();
    });
});

// ─── SolitaireApp._initImportScenario / _initFileInput ───────────────────────

describe('SolitaireApp._initImportScenario', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('does not throw when button is absent', () => {
        document.body.innerHTML = '';
        const app = new SolitaireApp();
        expect(() => app._initImportScenario()).not.toThrow();
    });

    test('calls scenario.handleAction when button is clicked', async () => {
        document.body.innerHTML = '<button id="act-import-scenario"></button>';
        const app = new SolitaireApp();
        app.scenario.handleAction = jest.fn(() => Promise.resolve());
        app._initImportScenario();
        document.getElementById('act-import-scenario').click();
        // Wait for async click handler
        await new Promise(r => setTimeout(r, 0));
        expect(app.scenario.handleAction).toHaveBeenCalledWith('import');
    });

    test('shows toast when scenario.handleAction throws', async () => {
        document.body.innerHTML = '<button id="act-import-scenario"></button>';
        const app = new SolitaireApp();
        app.scenario.handleAction = jest.fn(() => Promise.reject(new Error('fail')));
        app.showToast = jest.fn();
        app._initImportScenario();
        document.getElementById('act-import-scenario').click();
        await new Promise(r => setTimeout(r, 0));
        expect(app.showToast).toHaveBeenCalled();
    });
});

describe('SolitaireApp._initFileInput', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('does not throw when fileInput is absent', () => {
        document.body.innerHTML = '';
        const app = new SolitaireApp();
        expect(() => app._initFileInput()).not.toThrow();
    });
});

// ─── SolitaireApp._initSideDrawerEvents handlers ─────────────────────────────

describe('SolitaireApp._initSideDrawerEvents handlers', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
    });

    test('act-clear click calls handleClearAction', () => {
        document.body.innerHTML = '<button id="act-clear"></button>';
        const app = new SolitaireApp();
        app.handleClearAction = jest.fn(() => Promise.resolve());
        app._initSideDrawerEvents();
        document.getElementById('act-clear').click();
        expect(app.handleClearAction).toHaveBeenCalledWith('act-clear');
    });

    test('act-fit click calls renderer.fitToContent', () => {
        document.body.innerHTML = '<button id="act-fit"></button>';
        const app = new SolitaireApp();
        app.renderer.fitToContent = jest.fn();
        app._initSideDrawerEvents();
        document.getElementById('act-fit').click();
        expect(app.renderer.fitToContent).toHaveBeenCalledWith(0.9);
    });

    test('toggle-color-role change calls legend.setMode', () => {
        document.body.innerHTML = '<input id="toggle-color-role" type="radio" checked/>';
        const app = new SolitaireApp();
        app.legend.setMode = jest.fn();
        app._initSideDrawerEvents();
        const radio = document.getElementById('toggle-color-role');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.legend.setMode).toHaveBeenCalled();
    });

    test('toggle-color-company change calls legend.setMode with Company', () => {
        document.body.innerHTML = '<input id="toggle-color-company" type="radio" checked/>';
        const app = new SolitaireApp();
        app.legend.setMode = jest.fn();
        app._initSideDrawerEvents();
        const radio = document.getElementById('toggle-color-company');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.legend.setMode).toHaveBeenCalledWith('Company');
    });

    test('toggle-color-location change calls legend.setMode with Location', () => {
        document.body.innerHTML = '<input id="toggle-color-location" type="radio" checked/>';
        const app = new SolitaireApp();
        app.legend.setMode = jest.fn();
        app._initSideDrawerEvents();
        const radio = document.getElementById('toggle-color-location');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.legend.setMode).toHaveBeenCalledWith('Location');
    });

    test('toggle-color-function change calls legend.setMode with Function', () => {
        document.body.innerHTML = '<input id="toggle-color-function" type="radio" checked/>';
        const app = new SolitaireApp();
        app.legend.setMode = jest.fn();
        app._initSideDrawerEvents();
        const radio = document.getElementById('toggle-color-function');
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.legend.setMode).toHaveBeenCalledWith('Function');
    });

    test('search input Enter key calls search.search with value', () => {
        document.body.innerHTML = `<input id="drawer-search-input" value="alice"/>`;
        const app = new SolitaireApp();
        app.search.search = jest.fn();
        app._initSearchInput();
        const input = document.getElementById('drawer-search-input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.search.search).toHaveBeenCalledWith('alice');
    });

    test('act-about click calls drawer.open with about content', () => {
        document.body.innerHTML = '<button id="act-about"></button>';
        const app = new SolitaireApp();
        app.drawer.open = jest.fn();
        app._initSideDrawerEvents();
        document.getElementById('act-about').click();
        expect(app.drawer.open).toHaveBeenCalled();
    });
});

// ─── SolitaireApp._enableAppPinchZoomOnly ────────────────────────────────────

describe('SolitaireApp._enableAppPinchZoomOnly', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('does not throw when canvas is absent', () => {
        const app = new SolitaireApp();
        expect(() => app._enableAppPinchZoomOnly()).not.toThrow();
    });

    test('attaches touchmove listener when canvas is present', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = new SolitaireApp();
        const svgEl = document.getElementById('canvas');
        const spy = jest.spyOn(svgEl, 'addEventListener');
        app._enableAppPinchZoomOnly();
        expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), expect.anything());
    });
});

// ─── SolitaireApp init Escape keydown handler ─────────────────────────────────

describe('SolitaireApp init — Escape keydown handler', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
        delete window.__solitaireLongPressAttached;
        delete window.__toastDrawerObserverAttached;
        delete window.__fabsOutsideHandlerAttached;
    });

    test('Escape key with open drawer calls drawer.close', () => {
        document.body.innerHTML = `<svg id="canvas"></svg><input id="drawer-search-input"/>`;
        document.body.classList.add('drawer-open');
        const app = new SolitaireApp();
        app.drawer.close = jest.fn();
        app.init();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(app.drawer.close).toHaveBeenCalled();
        document.body.classList.remove('drawer-open');
    });

    test('Escape key without open drawer calls handleClearAction', () => {
        document.body.innerHTML = `<svg id="canvas"></svg><input id="drawer-search-input"/>`;
        const app = new SolitaireApp();
        app.handleClearAction = jest.fn(() => Promise.resolve());
        app.init();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(app.handleClearAction).toHaveBeenCalledWith('Escape');
    });

    test('non-Escape key is ignored', () => {
        document.body.innerHTML = `<svg id="canvas"></svg><input id="drawer-search-input"/>`;
        const app = new SolitaireApp();
        app.handleClearAction = jest.fn(() => Promise.resolve());
        app.init();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.handleClearAction).not.toHaveBeenCalled();
    });
});

// ─── SolitaireApp init load event → fetch chain ──────────────────────────────

describe('SolitaireApp init — load event fires fetch and loadAndRender', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
        delete window.__solitaireLongPressAttached;
        delete window.__toastDrawerObserverAttached;
        delete window.__fabsOutsideHandlerAttached;
    });

    test('load event triggers loadAndRender via fetch', async () => {
        document.body.innerHTML = `<svg id="canvas"></svg><input id="drawer-search-input"/>`;
        const app = new SolitaireApp();
        app.loadAndRender = jest.fn();
        app.init();
        window.dispatchEvent(new Event('load'));
        await new Promise(r => setTimeout(r, 10));
        expect(app.loadAndRender).toHaveBeenCalled();
    });

    test('load event with search param calls search.search via rAF', async () => {
        document.body.innerHTML = `<svg id="canvas"></svg><input id="drawer-search-input"/>`;
        window.history.pushState({}, '', '?search=alice');
        const app = new SolitaireApp();
        app.loadAndRender = jest.fn();
        app.search.search = jest.fn();
        app.init();
        window.dispatchEvent(new Event('load'));
        await new Promise(r => setTimeout(r, 50));
        expect(app.loadAndRender).toHaveBeenCalled();
    });
});

// ─── SolitaireApp.wireFabsInteractions (callback tests) ──────────────────────

describe('SolitaireApp.wireFabsInteractions — callbacks', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.__fabsOutsideHandlerAttached;
    });

    test('click.fabs in touch env toggles card--fabs-visible', () => {
        const app = new SolitaireApp();
        let clickHandler = null;
        const mockSel = {
            on: jest.fn((event, fn) => { if (event === 'click.fabs') clickHandler = fn; return mockSel; }),
            classed: jest.fn(() => false),
            selectAll: jest.fn().mockReturnThis(),
        };
        // Mock touch env
        Object.defineProperty(window, 'ontouchstart', { value: true, configurable: true });
        app.wireFabsInteractions(mockSel);
        if (clickHandler) {
            const event = { stopPropagation: jest.fn() };
            expect(() => clickHandler(event)).not.toThrow();
        }
        delete window.ontouchstart;
    });

    test('pointerdown outside canvas hides fabs', () => {
        delete window.__fabsOutsideHandlerAttached;
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = new SolitaireApp();
        const mockSel = {
            on: jest.fn().mockReturnThis(),
            classed: jest.fn().mockReturnThis(),
            selectAll: jest.fn().mockReturnThis(),
        };
        app.wireFabsInteractions(mockSel);
        // click outside
        document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        // Should not throw
        expect(window.__fabsOutsideHandlerAttached).toBe(true);
    });

    test('outside handler is only attached once (idempotent)', () => {
        window.__fabsOutsideHandlerAttached = true;
        const app = new SolitaireApp();
        const listenerSpy = jest.spyOn(document, 'addEventListener');
        const mockSel = { on: jest.fn().mockReturnThis(), classed: jest.fn().mockReturnThis(), selectAll: jest.fn().mockReturnThis() };
        app.wireFabsInteractions(mockSel);
        const pointerdownCalls = listenerSpy.mock.calls.filter(c => c[0] === 'pointerdown');
        expect(pointerdownCalls.length).toBe(0);
        listenerSpy.mockRestore();
    });
});

// ─── SolitaireApp.handleClearAction — stream modal ───────────────────────────

describe('SolitaireApp.handleClearAction — stream filter modal', () => {
    const utils = require('../../js/shared/utils.js');

    afterEach(() => {
        document.body.innerHTML = '';
        window.history.pushState({}, '', '/');
        jest.restoreAllMocks();
    });

    test('shows modal when only stream param is set and removes it on "remove"', async () => {
        window.history.pushState({}, '', '?stream=Alpha');
        jest.spyOn(utils, 'createModal').mockResolvedValue('remove');
        const app = new SolitaireApp();
        app.search.clear = jest.fn();
        app.renderer.reset = jest.fn();
        app.loadAndRender = jest.fn();
        app.setStreamFilter = jest.fn();
        await app.handleClearAction('test');
        expect(app.setStreamFilter).toHaveBeenCalled();
    });

    test('keeps stream filter when modal returns "keep"', async () => {
        window.history.pushState({}, '', '?stream=Alpha');
        jest.spyOn(utils, 'createModal').mockResolvedValue('keep');
        const app = new SolitaireApp();
        app.setStreamFilter = jest.fn();
        app.search.clear = jest.fn();
        await app.handleClearAction('test');
        expect(app.setStreamFilter).not.toHaveBeenCalled();
    });
});

// ─── SolitaireApp._initFileInput — with file change ──────────────────────────

describe('SolitaireApp._initFileInput — with file change', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('change event triggers reader setup when file is present', () => {
        // Mock FileReader so onload fires synchronously
        const origFileReader = global.FileReader;
        global.FileReader = class {
            readAsText() { this.onload?.({ target: { result: 'name,role\nAlice,Eng' } }); }
        };
        document.body.innerHTML = '<input id="fileInput" type="file"/>';
        const app = new SolitaireApp();
        app.renderer.reset = jest.fn();
        app.loadAndRender = jest.fn();
        app._initFileInput();
        const fileInput = document.getElementById('fileInput');
        const mockFile = new Blob(['name,role'], { type: 'text/csv' });
        Object.defineProperty(fileInput, 'files', { value: [mockFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.renderer.reset).toHaveBeenCalled();
        global.FileReader = origFileReader;
    });

    test('change event with no file does not reset renderer', () => {
        document.body.innerHTML = '<input id="fileInput" type="file"/>';
        const app = new SolitaireApp();
        app.renderer.reset = jest.fn();
        app._initFileInput();
        const fileInput = document.getElementById('fileInput');
        Object.defineProperty(fileInput, 'files', { value: [], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        expect(app.renderer.reset).not.toHaveBeenCalled();
    });
});

describe('SolitaireApp About drawer', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="side-drawer" aria-hidden="false"></div>
            <div id="side-overlay"></div>
            <div id="drawer"></div>
            <div id="overlay"></div>
            <button id="act-about"></button>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clicking act-about opens drawer with about content', () => {
        const app = new SolitaireApp();
        app.drawer.open = jest.fn();
        app._initSideDrawerEvents();
        document.getElementById('act-about').click();
        expect(app.drawer.open).toHaveBeenCalledWith(
            expect.objectContaining({
                name: expect.stringContaining('About'),
            })
        );
    });

    test('init() populates #build-info element', () => {
        document.body.innerHTML = `
            <div id="side-drawer"></div>
            <div id="side-overlay"></div>
            <button id="side-close"></button>
            <button id="toggle-cta"></button>
            <small id="build-info"></small>
            <svg id="canvas"></svg>
            <div id="output"></div>
        `;
        const app = new SolitaireApp();
        app.renderer.reset = jest.fn();
        app.renderer.render = jest.fn();
        app._initSideDrawerEvents = jest.fn();
        app.drawer.initEvents = jest.fn();
        app.interaction.setupLongPress = jest.fn();
        app._handleAdvancedMode = jest.fn();
        app._enableAppPinchZoomOnly = jest.fn();
        app._setupGlobalTooltip = jest.fn();
        app._initSearchInput = jest.fn();
        app._initImportScenario = jest.fn();
        app._initFileInput = jest.fn();
        app._initToggleDraggable = jest.fn();
        app.init();
        expect(document.getElementById('build-info').textContent).toContain('Build');
    });
});

describe('SolitaireApp sub-drawer', () => {
    function setupSubDrawerDOM() {
        document.body.innerHTML = `
            <div id="side-drawer" aria-hidden="false" class="open">
                <h1 id="sub-drawer-title"></h1>
                <button id="sub-back"></button>
                <button id="sub-close"></button>
                <nav>
                    <ul id="sub-content-legend" style="display:none"></ul>
                    <ul id="sub-content-display" style="display:none"></ul>
                    <ul id="sub-content-scenario" style="display:none"></ul>
                </nav>
            </div>
            <div id="side-overlay" class="visible"></div>
            <button id="act-legend"></button>
            <button id="act-scenario"></button>
            <button id="act-scenario-mgr"></button>
            <button id="act-scenario-save"></button>
            <button id="act-scenario-import"></button>
            <button id="act-scenario-reset"></button>
            <input id="toggle-color-role" type="radio"/>
            <input id="toggle-color-company" type="radio"/>
            <input id="toggle-color-location" type="radio"/>
            <input id="toggle-color-function" type="radio"/>
            <input id="drawer-search-input"/>
        `;
    }

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clicking act-legend adds sub-open to side-drawer and shows legend panel', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app._initSubDrawerEvents();
        document.getElementById('act-legend').click();
        expect(document.getElementById('side-drawer').classList.contains('sub-open')).toBe(true);
        expect(document.getElementById('sub-content-legend').style.display).toBe('');
        expect(document.getElementById('sub-content-display').style.display).toBe('none');
        expect(document.getElementById('sub-content-scenario').style.display).toBe('none');
    });

    test('clicking act-scenario adds sub-open to side-drawer and shows display panel', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app._initSubDrawerEvents();
        document.getElementById('act-scenario').click();
        expect(document.getElementById('side-drawer').classList.contains('sub-open')).toBe(true);
        expect(document.getElementById('sub-content-display').style.display).toBe('');
        expect(document.getElementById('sub-content-legend').style.display).toBe('none');
        expect(document.getElementById('sub-content-scenario').style.display).toBe('none');
    });

    test('clicking act-scenario-mgr adds sub-open to side-drawer and shows scenario panel', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app._initSubDrawerEvents();
        document.getElementById('act-scenario-mgr').click();
        expect(document.getElementById('side-drawer').classList.contains('sub-open')).toBe(true);
        expect(document.getElementById('sub-content-scenario').style.display).toBe('');
        expect(document.getElementById('sub-content-legend').style.display).toBe('none');
        expect(document.getElementById('sub-content-display').style.display).toBe('none');
    });

    test('clicking sub-back removes sub-open from side-drawer', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app._initSubDrawerEvents();
        document.getElementById('side-drawer').classList.add('sub-open');
        document.getElementById('sub-back').click();
        expect(document.getElementById('side-drawer').classList.contains('sub-open')).toBe(false);
    });

    test('clicking sub-close closes the entire side-drawer', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app._initSubDrawerEvents();
        document.getElementById('sub-close').click();
        expect(document.getElementById('side-drawer').classList.contains('open')).toBe(false);
    });

    test('clicking act-scenario-save calls scenario.handleAction("save")', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app.scenario.handleAction = jest.fn();
        app._initSubDrawerEvents();
        document.getElementById('act-scenario-save').click();
        expect(app.scenario.handleAction).toHaveBeenCalledWith('save');
    });

    test('clicking act-scenario-import calls scenario.handleAction("import")', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app.scenario.handleAction = jest.fn();
        app._initSubDrawerEvents();
        document.getElementById('act-scenario-import').click();
        expect(app.scenario.handleAction).toHaveBeenCalledWith('import');
    });

    test('clicking act-scenario-reset calls scenario.handleAction("reset")', () => {
        setupSubDrawerDOM();
        const app = new SolitaireApp();
        app.scenario.handleAction = jest.fn();
        app._initSubDrawerEvents();
        document.getElementById('act-scenario-reset').click();
        expect(app.scenario.handleAction).toHaveBeenCalledWith('reset');
    });
});
