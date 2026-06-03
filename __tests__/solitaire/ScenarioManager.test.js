import { ScenarioManager } from '../../js/solitaire/ScenarioManager.js';

const CLIP_PREFIX = 'SOLITAIRE_SCENARIO_V1:';

function makeApp(overrides = {}) {
    return {
        showToast: jest.fn(),
        renderer: { reset: jest.fn() },
        loadAndRender: jest.fn().mockResolvedValue(),
        db: { cachedCsvText: 'csv' },
        ...overrides,
    };
}

function makeGroupSel(key, x, y, w, h) {
    return {
        attr: jest.fn((name) => {
            if (name === 'data-key') return key;
            return null;
        }),
    };
}

describe('ScenarioManager constructor', () => {
    test('has default lsKey', () => {
        const sm = new ScenarioManager(makeApp());
        expect(sm.lsKey).toBe('dsm-layout-v1:default');
    });
});

describe('ScenarioManager.save / load', () => {
    let sm;

    beforeEach(() => {
        localStorage.clear();
        sm = new ScenarioManager(makeApp());
    });

    test('save stores object in localStorage', () => {
        sm.save({ foo: 'bar' });
        expect(localStorage.getItem(sm.lsKey)).toBe(JSON.stringify({ foo: 'bar' }));
    });

    test('load retrieves stored object', () => {
        sm.save({ x: 42 });
        expect(sm.load()).toEqual({ x: 42 });
    });

    test('load returns empty object when nothing stored', () => {
        expect(sm.load()).toEqual({});
    });

    test('load returns empty object for malformed JSON', () => {
        localStorage.setItem(sm.lsKey, 'not-json');
        expect(sm.load()).toEqual({});
    });
});

describe('ScenarioManager.getItem', () => {
    let sm;

    beforeEach(() => {
        localStorage.clear();
        sm = new ScenarioManager(makeApp());
    });

    test('returns value for existing key', () => {
        sm.save({ 'stream::alpha': { x: 10, y: 20 } });
        expect(sm.getItem('stream::alpha')).toEqual({ x: 10, y: 20 });
    });

    test('returns undefined for missing key', () => {
        expect(sm.getItem('missing::key')).toBeUndefined();
    });
});

describe('ScenarioManager.restoreGroupPosition', () => {
    let sm;

    beforeEach(() => {
        localStorage.clear();
        sm = new ScenarioManager(makeApp());
    });

    test('returns false when no key', () => {
        const sel = { attr: jest.fn().mockReturnValue(null) };
        expect(sm.restoreGroupPosition(sel)).toBe(false);
    });

    test('returns false when key not in storage', () => {
        const sel = { attr: jest.fn((n) => n === 'data-key' ? 'stream::alpha' : null) };
        expect(sm.restoreGroupPosition(sel)).toBe(false);
    });

    test('applies transform and returns true when saved data exists', () => {
        sm.save({ 'stream::alpha': { x: 100, y: 200 } });
        const setAttr = jest.fn();
        const sel = {
            attr: jest.fn((n, v) => {
                if (v === undefined) {
                    return n === 'data-key' ? 'stream::alpha' : null;
                }
                setAttr(n, v);
                return sel;
            }),
        };
        const result = sm.restoreGroupPosition(sel);
        expect(result).toBe(true);
        expect(setAttr).toHaveBeenCalledWith('transform', 'translate(100,200)');
    });
});

describe('ScenarioManager.getSavedSize', () => {
    let sm;

    beforeEach(() => {
        localStorage.clear();
        sm = new ScenarioManager(makeApp());
    });

    test('returns null when no key', () => {
        const sel = { attr: jest.fn().mockReturnValue(null) };
        expect(sm.getSavedSize(sel)).toBeNull();
    });

    test('returns null when no saved width/height', () => {
        sm.save({ 'team::a': { x: 0, y: 0 } });
        const sel = { attr: jest.fn((n) => n === 'data-key' ? 'team::a' : null) };
        expect(sm.getSavedSize(sel)).toBeNull();
    });

    test('returns {w, h} when saved size exists', () => {
        sm.save({ 'team::a': { x: 0, y: 0, width: 300, height: 150 } });
        const sel = { attr: jest.fn((n) => n === 'data-key' ? 'team::a' : null) };
        expect(sm.getSavedSize(sel)).toEqual({ w: 300, h: 150 });
    });
});

describe('ScenarioManager.filterLayout', () => {
    const sm = new ScenarioManager(makeApp());

    test('keeps stream/theme/team/card keys', () => {
        const input = {
            'stream::alpha': { x: 0 },
            'theme::a::b': { x: 1 },
            'team::a::b::c': { x: 2 },
            'card::a::b::c::d': { x: 3 },
            'other::key': { x: 4 },
        };
        const result = sm.filterLayout(input);
        expect(Object.keys(result)).toHaveLength(4);
        expect(result['other::key']).toBeUndefined();
    });

    test('returns empty object for empty input', () => {
        expect(sm.filterLayout({})).toEqual({});
        expect(sm.filterLayout(null)).toEqual({});
    });
});

describe('ScenarioManager.serialize / parse', () => {
    const sm = new ScenarioManager(makeApp());

    test('serialize produces prefixed JSON string', () => {
        const out = sm.serialize({ 'stream::a': { x: 1 } }, 'myKey');
        expect(out.startsWith(CLIP_PREFIX)).toBe(true);
        const parsed = JSON.parse(out.slice(CLIP_PREFIX.length));
        expect(parsed.v).toBe(1);
        expect(parsed.app).toBe('solitaire');
        expect(parsed.dataset).toBe('myKey');
        expect(parsed.layout['stream::a']).toEqual({ x: 1 });
    });

    test('filterLayout is applied during serialize', () => {
        const out = sm.serialize({ 'stream::a': { x: 1 }, 'garbage::key': { x: 2 } }, '');
        const parsed = JSON.parse(out.slice(CLIP_PREFIX.length));
        expect(parsed.layout['garbage::key']).toBeUndefined();
    });

    test('parse handles prefixed string', () => {
        const serialized = sm.serialize({ 'stream::a': { x: 10 } }, 'ds-key');
        const parsed = sm.parse(serialized);
        expect(parsed.layout['stream::a']).toEqual({ x: 10 });
    });

    test('parse handles plain JSON (no prefix)', () => {
        const raw = JSON.stringify({ layout: { 'stream::a': { x: 5 } } });
        const parsed = sm.parse(raw);
        expect(parsed.layout['stream::a']).toEqual({ x: 5 });
    });

    test('parse throws on empty string', () => {
        expect(() => sm.parse('')).toThrow();
    });
});

describe('ScenarioManager.handleAction', () => {
    let sm;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="stream::alpha" transform="translate(10, 20)"></g>
            </svg>`;
        sm = new ScenarioManager(makeApp());
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('save action stores DOM layout and shows toast', async () => {
        await sm.handleAction('save');
        const saved = JSON.parse(localStorage.getItem(sm.lsKey) || '{}');
        expect(saved['stream::alpha']).toEqual({ x: 10, y: 20 });
        expect(sm.app.showToast).toHaveBeenCalledWith('Scenario saved ✅');
    });

    test('reset action removes localStorage entry and calls reload', async () => {
        localStorage.setItem(sm.lsKey, '{"stream::alpha":{}}');
        const reloadMock = jest.fn();
        Object.defineProperty(window, 'location', {
            value: { ...window.location, reload: reloadMock },
            writable: true,
        });
        await sm.handleAction('reset');
        expect(localStorage.getItem(sm.lsKey)).toBeNull();
    });

    test('export action shows failure toast when clipboard unavailable', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: false, writable: true });
        delete navigator.clipboard;
        await sm.handleAction('export');
        expect(sm.app.showToast).toHaveBeenCalledWith(expect.stringContaining('Export failed'), 4500);
    });
});
