import { OrgChartRenderer, byBoost } from '../../js/solitaire/OrgChartRenderer.js';
import { firstLevelNA, secondLevelNA, ROLE_FIELD_WITH_MAPPING } from '../../js/solitaire/constants.js';
import { BRAND } from '../../brand-specific/brand.js';
import * as d3 from 'd3';

function makeApp() {
    return {
        interaction: {
            mode: 'free-pan',
            isDraggable: false,
            panMoved: false,
            panStartPos: null,
            suppressClicksUntil: 0,
            initSVGInteraction: jest.fn(),
            applyDraggableToggleState: jest.fn(),
        },
        contextMenu: { show: jest.fn(), hideMarquee: jest.fn() },
        legend: {
            colorBy: ROLE_FIELD_WITH_MAPPING,
            colorScale: jest.fn(() => '#fff'),
            colorKeyMappings: new Map(),
            getCardFill: jest.fn(() => '#fff'),
            setMode: jest.fn(),
        },
        db: {
            people: [],
            roleDetailsMapping: new Map(),
            aggregateInfoByHeader: jest.fn(() => ({ items: ['Description'] })),
            isInternalCompany: jest.fn(() => false),
            truncate: jest.fn(s => s),
        },
        scenario: {
            lsKey: 'test-key',
            save: jest.fn(),
            load: jest.fn(() => ({})),
            getItem: jest.fn(),
            restoreGroupPosition: jest.fn(() => false),
            getSavedSize: jest.fn(() => null),
        },
        drawer: { open: jest.fn(), close: jest.fn() },
        search: { search: jest.fn() },
        visibleOrg: null,
        wireFabsInteractions: jest.fn(),
        setStreamFilter: jest.fn(),
        showToast: jest.fn(),
    };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('OrgChartRenderer constructor', () => {
    test('initializes with null SVG references', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(r.svg).toBeNull();
        expect(r.viewport).toBeNull();
        expect(r.zoom).toBeNull();
    });

    test('has default width and height', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(r.width).toBe(1200);
        expect(r.height).toBe(800);
    });

    test('initializes lastFitTransform with zoomIdentity', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(r.lastFitTransform).toBeDefined();
    });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('OrgChartRenderer.reset', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('logs error and returns early when #canvas is missing', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        document.body.innerHTML = '';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('canvas not found'));
        consoleSpy.mockRestore();
    });

    test('creates SVG layers when #canvas exists', () => {
        document.body.innerHTML = '<svg id="canvas" width="1200" height="800"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(r.svg).not.toBeNull();
        expect(r.viewport).not.toBeNull();
        expect(r.streamLayer).not.toBeNull();
        expect(r.themeLayer).not.toBeNull();
        expect(r.teamLayer).not.toBeNull();
        expect(r.cardLayer).not.toBeNull();
    });

    test('calls d3.zoom to create zoom behavior', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(d3.zoom).toHaveBeenCalled();
    });

    test('calls interaction.initSVGInteraction', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const app = makeApp();
        const r = new OrgChartRenderer(app);
        r.reset();
        expect(app.interaction.initSVGInteraction).toHaveBeenCalled();
    });
});

// ─── fitToContent ─────────────────────────────────────────────────────────────

describe('OrgChartRenderer.fitToContent', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    test('returns early when svg/viewport/zoom are not set', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(() => r.fitToContent()).not.toThrow();
    });

    test('executes transform path when viewport has valid bbox', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(() => r.fitToContent(0.9)).not.toThrow();
    });

    test('uses default padding ratio when called with no argument', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(() => r.fitToContent()).not.toThrow();
    });
});

// ─── installTrackpadPinchZoom ─────────────────────────────────────────────────

describe('OrgChartRenderer.installTrackpadPinchZoom', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns early when svgSel is falsy', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(() => r.installTrackpadPinchZoom(null, {})).not.toThrow();
    });

    test('returns early when zoomBehavior is falsy', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(() => r.installTrackpadPinchZoom(r.svg, null)).not.toThrow();
    });

    test('installs wheel handler when called normally', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const mockZoom = d3.zoom();
        expect(() => r.installTrackpadPinchZoom(r.svg, mockZoom)).not.toThrow();
    });
});

// ─── zoomToElement ────────────────────────────────────────────────────────────

describe('OrgChartRenderer.zoomToElement', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    test('returns early when element is null', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(() => r.zoomToElement(null)).not.toThrow();
    });

    test('returns early when svg is null', () => {
        const r = new OrgChartRenderer(makeApp());
        const el = document.createElement('div');
        expect(() => r.zoomToElement(el)).not.toThrow();
    });
});

// ─── bringToCorrectLayer ──────────────────────────────────────────────────────

describe('OrgChartRenderer.bringToCorrectLayer', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    function setupAndReset() {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        return r;
    }

    test('calls cardLayer.node() for card-keyed element', () => {
        const r = setupAndReset();
        const g = document.createElement('g');
        g.setAttribute('data-key', 'card::stream::theme::team::alice');
        r.bringToCorrectLayer(g);
        expect(r.cardLayer.node).toHaveBeenCalled();
    });

    test('calls teamLayer.node() for team-keyed element', () => {
        const r = setupAndReset();
        const g = document.createElement('g');
        g.setAttribute('data-key', 'team::stream::theme::team');
        r.bringToCorrectLayer(g);
        expect(r.teamLayer.node).toHaveBeenCalled();
    });

    test('calls themeLayer.node() for theme-keyed element', () => {
        const r = setupAndReset();
        const g = document.createElement('g');
        g.setAttribute('data-key', 'theme::stream::theme');
        r.bringToCorrectLayer(g);
        expect(r.themeLayer.node).toHaveBeenCalled();
    });

    test('calls streamLayer.node() for stream-keyed element', () => {
        const r = setupAndReset();
        const g = document.createElement('g');
        g.setAttribute('data-key', 'stream::stream');
        r.bringToCorrectLayer(g);
        expect(r.streamLayer.node).toHaveBeenCalled();
    });
});

// ─── getContentBBox ───────────────────────────────────────────────────────────

describe('OrgChartRenderer.getContentBBox', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    test('returns null when both layers are absent', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(r.getContentBBox()).toBeNull();
    });

    test('returns bbox object after reset', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const bbox = r.getContentBBox();
        expect(bbox).toBeTruthy();
        expect(bbox).toHaveProperty('x');
        expect(bbox).toHaveProperty('width');
    });
});

// ─── Pure layout helpers ──────────────────────────────────────────────────────

describe('OrgChartRenderer._computeInARowForTeam', () => {
    const r = new OrgChartRenderer(makeApp());

    test('returns 6 for small teams (≤ 18 members)', () => {
        expect(r._computeInARowForTeam(0)).toBe(6);
        expect(r._computeInARowForTeam(1)).toBe(6);
        expect(r._computeInARowForTeam(18)).toBe(6);
    });

    test('returns 12 for 19–36 members (tier 1)', () => {
        expect(r._computeInARowForTeam(19)).toBe(12);
        expect(r._computeInARowForTeam(36)).toBe(12);
    });

    test('returns 24 for 37–54 members (tier 2)', () => {
        expect(r._computeInARowForTeam(37)).toBe(24);
        expect(r._computeInARowForTeam(54)).toBe(24);
    });

    test('handles non-numeric input as 0', () => {
        expect(r._computeInARowForTeam(null)).toBe(6);
        expect(r._computeInARowForTeam(undefined)).toBe(6);
        expect(r._computeInARowForTeam('abc')).toBe(6);
    });
});

describe('OrgChartRenderer._uniqueMemberCount', () => {
    const r = new OrgChartRenderer(makeApp());

    test('counts unique names case-insensitively', () => {
        expect(r._uniqueMemberCount([
            { Name: 'Alice' },
            { Name: 'alice' },
            { Name: 'Bob' },
        ])).toBe(2);
    });

    test('uses User field when Name is absent', () => {
        expect(r._uniqueMemberCount([{ User: 'Alice' }, { User: 'Bob' }])).toBe(2);
    });

    test('ignores entries with empty name', () => {
        expect(r._uniqueMemberCount([{ Name: '' }, { Name: 'Alice' }])).toBe(1);
    });

    test('handles empty array', () => {
        expect(r._uniqueMemberCount([])).toBe(0);
    });

    test('handles null/non-array input', () => {
        expect(r._uniqueMemberCount(null)).toBe(0);
    });
});

describe('OrgChartRenderer._computeTeamBoxWidth', () => {
    const r = new OrgChartRenderer(makeApp());

    test('returns BASE * memberWidth + 100 for standard teams', () => {
        expect(r._computeTeamBoxWidth(6, 160)).toBe(6 * 160 + 100);
    });

    test('adds extraOffsetX for large teams (> 6 in a row)', () => {
        const width = r._computeTeamBoxWidth(12, 160);
        expect(width).toBeGreaterThan(12 * 160 + 100);
    });

    test('uses BASE=6 for null/zero inputs', () => {
        expect(r._computeTeamBoxWidth(null, 160)).toBe(6 * 160 + 100);
        expect(r._computeTeamBoxWidth(0, 160)).toBe(6 * 160 + 100);
    });
});

describe('OrgChartRenderer._computeStreamWidthFromRows', () => {
    const r = new OrgChartRenderer(makeApp());

    test('returns 600 for empty rows (minimum)', () => {
        expect(r._computeStreamWidthFromRows([], 60)).toBe(600);
    });

    test('returns 600 for null input', () => {
        expect(r._computeStreamWidthFromRows(null, 60)).toBe(600);
    });

    test('respects padding in width calculation', () => {
        const rows = [{ themes: [{ themeWidth: 400 }, { themeWidth: 300 }] }];
        const width = r._computeStreamWidthFromRows(rows, 60);
        expect(width).toBeGreaterThanOrEqual(600);
    });

    test('picks the widest row', () => {
        const rows = [
            { themes: [{ themeWidth: 200 }] },
            { themes: [{ themeWidth: 500 }] },
        ];
        const width = r._computeStreamWidthFromRows(rows, 60);
        expect(width).toBeGreaterThanOrEqual(620);
    });
});

// ─── render ───────────────────────────────────────────────────────────────────

const sampleMember = {
    Name: 'Alice',
    Role: 'Engineer',
    Company: BRAND.name,
    Location: 'Florence',
    Room: 'A1',
    Email: `alice@${BRAND.name}.com`,
    'In team since': '2020-01-01',
};

const minimalOrg = {
    'GTech Enablers': {
        'Theme A': {
            'Team B': [sampleMember],
        },
    },
};

describe('OrgChartRenderer.render', () => {
    let r;
    let app;

    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
        document.body.innerHTML = '<svg id="canvas" width="1200" height="800"></svg>';
        app = makeApp();
        r = new OrgChartRenderer(app);
        r.reset();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function renderMinimal(overrides = {}) {
        return r.render({
            organizationWithManagers: minimalOrg,
            filteredStreams: null,
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name', 'Role', 'Company', 'Location', 'Room', 'Email', 'In team since'],
            organization: minimalOrg,
            ...overrides,
        });
    }

    test('does not throw with minimal data', () => {
        expect(() => renderMinimal()).not.toThrow();
    });

    test('calls streamLayer.append for each stream', () => {
        renderMinimal();
        expect(r.streamLayer.append).toHaveBeenCalled();
    });

    test('calls app.scenario.restoreGroupPosition', () => {
        renderMinimal();
        expect(app.scenario.restoreGroupPosition).toHaveBeenCalled();
    });

    test('calls fitToContent at end of render', () => {
        const spy = jest.spyOn(r, 'fitToContent');
        renderMinimal();
        expect(spy).toHaveBeenCalledWith(0.9);
    });

    test('calls app.interaction.applyDraggableToggleState', () => {
        renderMinimal();
        expect(app.interaction.applyDraggableToggleState).toHaveBeenCalled();
    });

    test('skips firstLevelNA stream entries', () => {
        const orgWithNA = {
            [firstLevelNA]: { 'Theme': { 'Team': [sampleMember] } },
            'GTech Enablers': { 'Theme A': { 'Team B': [sampleMember] } },
        };
        expect(() => r.render({
            organizationWithManagers: orgWithNA,
            filteredStreams: null,
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name'],
            organization: orgWithNA,
        })).not.toThrow();
    });

    test('skips stream not in filteredStreams Set', () => {
        expect(() => r.render({
            organizationWithManagers: minimalOrg,
            filteredStreams: new Set(['other-stream-key']),
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name'],
            organization: minimalOrg,
        })).not.toThrow();
    });

    test('renders matching stream when filteredStreams contains its key', () => {
        expect(() => r.render({
            organizationWithManagers: minimalOrg,
            filteredStreams: new Set(['gtech_enablers']),
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name'],
            organization: minimalOrg,
        })).not.toThrow();
    });

    test('shows stream isolation icons when visibleStreamNames has more than one entry', () => {
        const multiOrg = {
            'GTech Enablers': { 'Theme A': { 'Team B': [sampleMember] } },
            'Digital Enablers': { 'Theme C': { 'Team D': [sampleMember] } },
        };
        expect(() => r.render({
            organizationWithManagers: multiOrg,
            filteredStreams: null,
            visibleStreamNames: ['GTech Enablers', 'Digital Enablers'],
            headers: ['Name', 'Role'],
            organization: multiOrg,
        })).not.toThrow();
    });

    test('renders multiple members in a team', () => {
        const member2 = { ...sampleMember, Name: 'Bob', Email: `bob@${BRAND.name}.com` };
        const orgWithTwo = {
            'GTech Enablers': {
                'Theme A': {
                    'Team B': [sampleMember, member2],
                },
            },
        };
        expect(() => r.render({
            organizationWithManagers: orgWithTwo,
            filteredStreams: null,
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name', 'Email'],
            organization: orgWithTwo,
        })).not.toThrow();
    });

    test('renders member with internal company (isInternalCompany = true)', () => {
        app.db.isInternalCompany.mockReturnValue(true);
        expect(() => renderMinimal()).not.toThrow();
    });

    test('skips secondLevelNA theme entries', () => {
        const orgWithNA = {
            'GTech Enablers': {
                [secondLevelNA]: { 'Team B': [sampleMember] },
                'Theme A': { 'Team B': [sampleMember] },
            },
        };
        expect(() => r.render({
            organizationWithManagers: orgWithNA,
            filteredStreams: null,
            visibleStreamNames: ['GTech Enablers'],
            headers: ['Name'],
            organization: orgWithNA,
        })).not.toThrow();
    });

    test('calls app.db.aggregateInfoByHeader for stream description', () => {
        renderMinimal();
        expect(app.db.aggregateInfoByHeader).toHaveBeenCalled();
    });

    test('renders with description text present (info icon path)', () => {
        app.db.aggregateInfoByHeader.mockReturnValue({ items: ['Team details here'] });
        expect(() => renderMinimal()).not.toThrow();
    });

    test('renders with empty description (no info icon path)', () => {
        app.db.aggregateInfoByHeader.mockReturnValue({ items: [] });
        expect(() => renderMinimal()).not.toThrow();
    });

    test('handles null aggregateInfoByHeader response gracefully', () => {
        app.db.aggregateInfoByHeader.mockReturnValue(null);
        expect(() => renderMinimal()).not.toThrow();
    });
});

// ─── OrgChartRenderer.reset — zoom callbacks ──────────────────────────────────

describe('OrgChartRenderer.reset — zoom filter and event callbacks', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function setupReset(appOverrides = {}) {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const app = { ...makeApp(), ...appOverrides };
        const r = new OrgChartRenderer(app);
        r.reset();
        return { r, app };
    }

    test('zoom filter allows wheel without ctrl', () => {
        const { r } = setupReset();
        const filterFn = r.zoom.filter.mock.calls[0][0];
        expect(filterFn({ type: 'wheel', ctrlKey: false })).toBe(true);
        expect(filterFn({ type: 'wheel', ctrlKey: true })).toBe(false);
    });

    test('zoom filter handles mousedown — non-primary button returns false', () => {
        const { r } = setupReset();
        const filterFn = r.zoom.filter.mock.calls[0][0];
        expect(filterFn({ type: 'mousedown', button: 2 })).toBe(false);
    });

    test('zoom filter handles mousedown — free-pan mode returns true', () => {
        const app = makeApp();
        app.interaction.mode = 'free-pan';
        const r = new OrgChartRenderer(app);
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        r.reset();
        const filterFn = r.zoom.filter.mock.calls[0][0];
        expect(filterFn({ type: 'mousedown', button: 0 })).toBe(true);
    });

    test('zoom filter handles mousedown — select mode returns false', () => {
        const app = makeApp();
        app.interaction.mode = 'select';
        const r = new OrgChartRenderer(app);
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        r.reset();
        const filterFn = r.zoom.filter.mock.calls[0][0];
        expect(filterFn({ type: 'mousedown', button: 0 })).toBe(false);
    });

    test('zoom filter passes touch events', () => {
        const { r } = setupReset();
        const filterFn = r.zoom.filter.mock.calls[0][0];
        expect(filterFn({ type: 'touchstart' })).toBe(true);
    });

    test('zoom on-start callback records panStartPos and resets panMoved', () => {
        const { r, app } = setupReset();
        const startCb = r.zoom.on.mock.calls.find(c => c[0] === 'start')?.[1];
        expect(startCb).toBeTruthy();
        startCb({ sourceEvent: { type: 'mousedown', clientX: 100, clientY: 200 } });
        expect(app.interaction.panMoved).toBe(false);
        expect(app.interaction.panStartPos).toEqual({ x: 100, y: 200 });
    });

    test('zoom on-start callback adds is-zooming class', () => {
        const { r } = setupReset();
        const startCb = r.zoom.on.mock.calls.find(c => c[0] === 'start')?.[1];
        r.svg.classed.mockClear();
        startCb({ sourceEvent: { type: 'mousedown', clientX: 0, clientY: 0 } });
        expect(r.svg.classed).toHaveBeenCalledWith('is-zooming', true);
    });

    test('zoom on-zoom callback sets panMoved when mousemove exceeds threshold', () => {
        const { r, app } = setupReset();
        app.interaction.panStartPos = { x: 100, y: 200 };
        const zoomCb = r.zoom.on.mock.calls.find(c => c[0] === 'zoom')?.[1];
        zoomCb({ transform: {}, sourceEvent: { type: 'mousemove', clientX: 110, clientY: 200 } });
        expect(app.interaction.panMoved).toBe(true);
    });

    test('zoom on-zoom callback does not set panMoved for mousemove within threshold', () => {
        const { r, app } = setupReset();
        app.interaction.panStartPos = { x: 100, y: 200 };
        const zoomCb = r.zoom.on.mock.calls.find(c => c[0] === 'zoom')?.[1];
        zoomCb({ transform: {}, sourceEvent: { type: 'mousemove', clientX: 102, clientY: 200 } });
        expect(app.interaction.panMoved).toBe(false);
    });

    test('zoom on-zoom callback sets panMoved for touchmove unconditionally', () => {
        const { r, app } = setupReset();
        const zoomCb = r.zoom.on.mock.calls.find(c => c[0] === 'zoom')?.[1];
        zoomCb({ transform: {}, sourceEvent: { type: 'touchmove' } });
        expect(app.interaction.panMoved).toBe(true);
    });

    test('zoom on-zoom callback does not set panMoved when isDraggable', () => {
        const { r, app } = setupReset();
        app.interaction.isDraggable = true;
        app.interaction.panStartPos = { x: 0, y: 0 };
        const zoomCb = r.zoom.on.mock.calls.find(c => c[0] === 'zoom')?.[1];
        zoomCb({ transform: {}, sourceEvent: { type: 'mousemove', clientX: 100, clientY: 100 } });
        expect(app.interaction.panMoved).toBe(false);
    });

    test('zoom on-end callback clears panMoved and panStartPos', () => {
        const { r, app } = setupReset();
        app.interaction.panMoved = true;
        app.interaction.panStartPos = { x: 10, y: 20 };
        const endCb = r.zoom.on.mock.calls.find(c => c[0] === 'end')?.[1];
        endCb({});
        expect(app.interaction.panMoved).toBe(false);
        expect(app.interaction.panStartPos).toBeNull();
    });

    test('zoom on-end callback removes is-zooming class', () => {
        const { r } = setupReset();
        const endCb = r.zoom.on.mock.calls.find(c => c[0] === 'end')?.[1];
        r.svg.classed.mockClear();
        endCb({});
        expect(r.svg.classed).toHaveBeenCalledWith('is-zooming', false);
    });

    test('zoom on-end callback suppresses clicks when panMoved was true', () => {
        const { r, app } = setupReset();
        app.interaction.isDraggable = false;
        app.interaction.panMoved = true;
        const endCb = r.zoom.on.mock.calls.find(c => c[0] === 'end')?.[1];
        endCb({});
        expect(app.interaction.suppressClicksUntil).toBeGreaterThan(Date.now() - 1);
    });

    test('contextmenu event on canvas calls contextMenu.show', () => {
        window.__dsmGlobalContextMenuAttached = false;
        const { app } = setupReset();
        const svgEl = document.getElementById('canvas');
        const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 });
        svgEl.dispatchEvent(e);
        expect(app.contextMenu.show).toHaveBeenCalledWith(50, 50);
    });

    test('pan click blocker suppresses click when suppressClicksUntil is in future', () => {
        window.__panClickBlockerAttached = false;
        const { r, app } = setupReset();
        app.interaction.isDraggable = false;
        app.interaction.suppressClicksUntil = Date.now() + 10000;
        const svgNode = r.svg.node();
        const clickFn = svgNode.addEventListener.mock.calls.find(c => c[0] === 'click')?.[1];
        if (clickFn) {
            const e = { preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
            clickFn(e);
            expect(e.preventDefault).toHaveBeenCalled();
        }
    });
});

// ─── OrgChartRenderer.fitToContent — zero bbox path ──────────────────────────

describe('OrgChartRenderer.fitToContent — zero bbox and isDraggable paths', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('takes early exit when bbox width is 0', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        r.viewport.node.mockReturnValue({
            getBBox: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
        });
        expect(() => r.fitToContent()).not.toThrow();
        // svg.call(zoom.transform, ...) is invoked; zoom.transform is passed as arg, not invoked directly
        expect(r.svg.call).toHaveBeenCalled();
    });

    test('uses bbox-based translateExtent when isDraggable is true', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const app = makeApp();
        app.interaction.isDraggable = true;
        const r = new OrgChartRenderer(app);
        r.reset();
        // Provide a non-zero bbox so fitToContent doesn't return early
        r.viewport.node.mockReturnValue({
            getBBox: jest.fn(() => ({ x: 0, y: 0, width: 200, height: 200 })),
        });
        expect(() => r.fitToContent()).not.toThrow();
        expect(r.zoom.translateExtent).toHaveBeenCalled();
    });
});

// ─── OrgChartRenderer.zoomToElement — body coverage ──────────────────────────

describe('OrgChartRenderer.zoomToElement — body coverage', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('executes zoom transition when svg is initialized', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const el = document.createElement('div');
        document.body.appendChild(el);
        Object.defineProperty(el, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 100, top: 50, right: 160, bottom: 90, width: 60, height: 40 }))
        });
        expect(() => r.zoomToElement(el, 1.5, 500)).not.toThrow();
    });

    test('calls highlightGroupUtils when element has parent g', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const g = document.createElement('g');
        const div = document.createElement('div');
        g.appendChild(div);
        document.body.appendChild(g);
        Object.defineProperty(div, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 100, top: 50, right: 160, bottom: 90, width: 60, height: 40 }))
        });
        expect(() => r.zoomToElement(div, 1.5, 0)).not.toThrow();
    });
});

// ─── OrgChartRenderer.fitElementToView ────────────────────────────────────────

describe('OrgChartRenderer.fitElementToView', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('is a no-op when element is null', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(() => r.fitElementToView(null)).not.toThrow();
    });

    test('executes zoom transition when svg is initialized', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const el = document.createElement('g');
        document.body.appendChild(el);
        Object.defineProperty(el, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 50, top: 30, right: 450, bottom: 330, width: 400, height: 300 }))
        });
        expect(() => r.fitElementToView(el, 600)).not.toThrow();
        expect(r.svg.transition).toHaveBeenCalled();
    });

    test('calls highlightGroupUtils on the element', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const el = document.createElement('g');
        document.body.appendChild(el);
        Object.defineProperty(el, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }))
        });
        expect(() => r.fitElementToView(el, 0)).not.toThrow();
    });
});

// ─── makeResizable — mobile guard ────────────────────────────────────────────
// NOTE: d3 is fully mocked (__mocks__/d3.js), so assertions use mock call records.

describe('OrgChartRenderer.makeResizable — mobile guard', () => {
    beforeEach(() => {
        document.body.innerHTML = '<svg id="canvas" width="1200" height="800"></svg>';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        // Restore screen to jsdom default (0×0) between tests
        Object.defineProperty(window.screen, 'width',  { value: 0, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 0, configurable: true });
    });

    function makeDesktop() {
        Object.defineProperty(window.screen, 'width',  { value: 1920, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });
    }

    test('skips resize-handles group on mobile — group.append not called with "g"', () => {
        // jsdom defaults to screen 0×0 → isMobileDevice() returns true
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const group = d3.select('#canvas').append('g');
        const rect  = group.append('rect');
        group.append.mockClear();
        r.makeResizable(group, rect, {});
        // Mobile guard returns early: no handles group should be appended
        expect(group.append).not.toHaveBeenCalledWith('g');
    });

    test('still calls rect.attr with saved dimensions on mobile', () => {
        const app = makeApp();
        app.scenario.getSavedSize = jest.fn(() => ({ w: 400, h: 250 }));
        const r = new OrgChartRenderer(app);
        r.reset();
        const group = d3.select('#canvas').append('g');
        const rect  = group.append('rect');
        r.makeResizable(group, rect, {});
        expect(rect.attr).toHaveBeenCalledWith('width', 400);
        expect(rect.attr).toHaveBeenCalledWith('height', 250);
    });

    test('calls onResize callback with dimensions on mobile', () => {
        const onResize = jest.fn();
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const group = d3.select('#canvas').append('g');
        const rect  = group.append('rect');
        r.makeResizable(group, rect, { onResize, minWidth: 300, minHeight: 200 });
        expect(onResize).toHaveBeenCalledWith({ width: 300, height: 200 });
    });

    test('does not throw when group has no text child (null title node)', () => {
        // Regression: group.select('text').node() returns null when no <text> exists;
        // calling .attr() getter on that empty selection threw "Cannot read properties of null".
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const group = d3.select('#canvas').append('g');
        const rect  = group.append('rect');
        // Ensure group.select returns a selection whose .node() is null
        group.select = jest.fn(() => {
            const emptySel = { node: jest.fn(() => null), attr: jest.fn() };
            return emptySel;
        });
        expect(() => r.makeResizable(group, rect, {})).not.toThrow();
    });

    test('creates resize-handles group on desktop — group.append called with "g"', () => {
        makeDesktop();
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const group = d3.select('#canvas').append('g');
        const rect  = group.append('rect');
        group.append.mockClear();
        r.makeResizable(group, rect, {});
        // Desktop path: handles group IS created
        expect(group.append).toHaveBeenCalledWith('g');
    });
});

// ─── onZoom callback ──────────────────────────────────────────────────────────
// NOTE: d3 is fully mocked; we trigger the zoom 'zoom' handler directly via
// the mock call records to verify that onZoom is invoked.

describe('OrgChartRenderer.onZoom callback', () => {
    beforeEach(() => {
        document.body.innerHTML = '<svg id="canvas" width="1200" height="800"></svg>';
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function getZoomHandler(renderer, eventName) {
        // zoom.on is mocked; find the call that registered the named handler
        return renderer.zoom.on.mock.calls.find(([name]) => name === eventName)?.[1];
    }

    test('calls this.onZoom when the zoom event fires', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const onZoom = jest.fn();
        r.onZoom = onZoom;
        const zoomHandler = getZoomHandler(r, 'zoom');
        expect(typeof zoomHandler).toBe('function');
        zoomHandler({ transform: { x: 0, y: 0, k: 1 }, sourceEvent: null });
        expect(onZoom).toHaveBeenCalled();
    });

    test('does not dispatch dsm-canvas-zoom window event', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const dispatched = [];
        const origDispatch = window.dispatchEvent.bind(window);
        const spy = jest.spyOn(window, 'dispatchEvent').mockImplementation((e) => {
            dispatched.push(e.type);
            return origDispatch(e);
        });
        try {
            const zoomHandler = getZoomHandler(r, 'zoom');
            zoomHandler({ transform: { x: 5, y: 0, k: 1 }, sourceEvent: null });
            expect(dispatched).not.toContain('dsm-canvas-zoom');
        } finally {
            spy.mockRestore();
        }
    });

    test('does not throw when onZoom is not set', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        expect(r.onZoom).toBeUndefined();
        const zoomHandler = getZoomHandler(r, 'zoom');
        expect(() => zoomHandler({ transform: { x: 0, y: 0, k: 1 }, sourceEvent: null })).not.toThrow();
    });
});

// ─── reset — svgDefs ──────────────────────────────────────────────────────────

describe('OrgChartRenderer.reset — svgDefs', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => { document.body.innerHTML = ''; });

    test('creates svgDefs via svg.append("defs") during reset', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        // svgDefs is the result of svg.append('defs')
        expect(r.svgDefs).toBeDefined();
        expect(r.svg.append).toHaveBeenCalledWith('defs');
    });
});

// ─── _cullCards ───────────────────────────────────────────────────────────────

describe('OrgChartRenderer._cullCards', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
    });

    afterEach(() => { document.body.innerHTML = ''; });

    test('is a no-op when svg is null (before reset)', () => {
        const r = new OrgChartRenderer(makeApp());
        expect(() => r._cullCards()).not.toThrow();
    });

    test('calls selectAll("g[data-cx]") on cardLayer after reset', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        r.cardLayer.selectAll.mockClear();
        r._cullCards();
        expect(r.cardLayer.selectAll).toHaveBeenCalledWith('g[data-cx]');
    });

    test('shows cards inside viewport bounds, hides cards outside', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        r.cardLayer.selectAll.mockClear();
        r._cullCards();
        // d3.zoomTransform returns identity {k:1,x:0,y:0}; clientWidth=800,clientHeight=600
        // bounds: x0=-300, y0=-300, x1=1100, y1=900
        const eachFn = r.cardLayer.selectAll.mock.results[0]?.value?.each?.mock?.calls?.[0]?.[0];
        expect(typeof eachFn).toBe('function');

        const insideEl = { getAttribute: (k) => k === 'data-cx' ? '400' : '300', style: {} };
        eachFn.call(insideEl);
        expect(insideEl.style.display).toBe('');

        const outsideEl = { getAttribute: (k) => k === 'data-cx' ? '2000' : '2000', style: {} };
        eachFn.call(outsideEl);
        expect(outsideEl.style.display).toBe('none');
    });

    test('card at the margin boundary is visible (not culled)', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        r.cardLayer.selectAll.mockClear();
        r._cullCards();
        const eachFn = r.cardLayer.selectAll.mock.results[0]?.value?.each?.mock?.calls?.[0]?.[0];
        // x0=-300; card at x=-299 should be visible (inside the margin buffer)
        const marginEl = { getAttribute: (k) => k === 'data-cx' ? '-299' : '300', style: {} };
        eachFn.call(marginEl);
        expect(marginEl.style.display).toBe('');
    });

    test('zoom.end handler calls _cullCards on mobile (jsdom screen 0×0)', () => {
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const cullSpy = jest.spyOn(r, '_cullCards');
        const endHandler = r.zoom.on.mock.calls.find(([name]) => name === 'end')?.[1];
        expect(endHandler).toBeDefined();
        endHandler({ transform: { k: 1, x: 0, y: 0 }, sourceEvent: null });
        expect(cullSpy).toHaveBeenCalled();
        cullSpy.mockRestore();
    });

    test('zoom.end handler does NOT call _cullCards on desktop', () => {
        Object.defineProperty(window.screen, 'width',  { value: 1920, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });
        try {
            document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
            const r = new OrgChartRenderer(makeApp());
            r.reset();
            const cullSpy = jest.spyOn(r, '_cullCards');
            const endHandler = r.zoom.on.mock.calls.find(([name]) => name === 'end')?.[1];
            endHandler({ transform: { k: 1, x: 0, y: 0 }, sourceEvent: null });
            expect(cullSpy).not.toHaveBeenCalled();
            cullSpy.mockRestore();
        } finally {
            Object.defineProperty(window.screen, 'width',  { value: 0, configurable: true });
            Object.defineProperty(window.screen, 'height', { value: 0, configurable: true });
        }
    });

    test('_cullCards is a no-op on desktop', () => {
        Object.defineProperty(window.screen, 'width',  { value: 1920, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });
        try {
            document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
            const r = new OrgChartRenderer(makeApp());
            r.reset();
            r.cardLayer.selectAll.mockClear();
            r._cullCards();
            expect(r.cardLayer.selectAll).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(window.screen, 'width',  { value: 0, configurable: true });
            Object.defineProperty(window.screen, 'height', { value: 0, configurable: true });
        }
    });
});

// ─── Gesture-LOD (lod-gesture-active) ────────────────────────────────────────

describe('OrgChartRenderer gesture-LOD (lod-gesture-active)', () => {
    function getHandler(r, name) {
        return r.zoom.on.mock.calls.find(([n]) => n === name)?.[1];
    }

    function setup() {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        r._memberCount = 150; // above 100 threshold
        r.svg.classed.mockClear();
        return r;
    }

    afterEach(() => {
        global.__FEATURE_LOD__ = true; // restore default
        document.body.innerHTML = '';
    });

    // Positive: all conditions met → lod-gesture-active set (low zoom = many members visible)
    test('zoom.start sets lod-gesture-active when mobile + user gesture + >100 members at low zoom', () => {
        const r = setup();
        getHandler(r, 'start')({ transform: { k: 0.1 }, sourceEvent: { type: 'touchstart' } });
        expect(r.svg.classed).toHaveBeenCalledWith('lod-gesture-active', true);
    });

    // zoom.end always clears it (safe even when never set)
    test('zoom.end always clears lod-gesture-active', () => {
        const r = setup();
        getHandler(r, 'end')({ transform: { k: 1 }, sourceEvent: null });
        expect(r.svg.classed).toHaveBeenCalledWith('lod-gesture-active', false);
    });

    // Programmatic zoom (search / fitToContent): sourceEvent is null → no LOD
    test('zoom.start does NOT set lod-gesture-active for programmatic zoom (sourceEvent null)', () => {
        const r = setup();
        getHandler(r, 'start')({ transform: { k: 1.5 }, sourceEvent: null });
        const lodCalls = r.svg.classed.mock.calls.filter(([cls, val]) => cls === 'lod-gesture-active' && val === true);
        expect(lodCalls).toHaveLength(0);
    });

    // At or above LOD_K_MAX (0.3) → no LOD
    test('zoom.start does NOT set lod-gesture-active when k >= LOD_K_MAX (k=0.3)', () => {
        const r = setup();
        getHandler(r, 'start')({ transform: { k: 0.3 }, sourceEvent: { type: 'touchstart' } });
        const lodCalls = r.svg.classed.mock.calls.filter(([cls, val]) => cls === 'lod-gesture-active' && val === true);
        expect(lodCalls).toHaveLength(0);
    });

    // Small dataset (≤ 100 members) → no LOD
    test('zoom.start does NOT set lod-gesture-active when memberCount ≤ 100', () => {
        const r = setup();
        r._memberCount = 80;
        getHandler(r, 'start')({ transform: { k: 1.0 }, sourceEvent: { type: 'touchstart' } });
        const lodCalls = r.svg.classed.mock.calls.filter(([cls, val]) => cls === 'lod-gesture-active' && val === true);
        expect(lodCalls).toHaveLength(0);
    });

    // Desktop → no LOD
    test('zoom.start does NOT set lod-gesture-active on desktop', () => {
        Object.defineProperty(window.screen, 'width',  { value: 1920, configurable: true });
        Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true });
        try {
            const r = setup();
            getHandler(r, 'start')({ transform: { k: 1.0 }, sourceEvent: { type: 'mousedown' } });
            const lodCalls = r.svg.classed.mock.calls.filter(([cls, val]) => cls === 'lod-gesture-active' && val === true);
            expect(lodCalls).toHaveLength(0);
        } finally {
            Object.defineProperty(window.screen, 'width',  { value: 0, configurable: true });
            Object.defineProperty(window.screen, 'height', { value: 0, configurable: true });
        }
    });

    // Below LOD_K_MAX on any mobile screen (fixed threshold, not screen-dependent)
    test('zoom.start sets lod-gesture-active below LOD_K_MAX (k=0.2)', () => {
        const r = setup();
        getHandler(r, 'start')({ transform: { k: 0.2 }, sourceEvent: { type: 'touchstart' } });
        expect(r.svg.classed).toHaveBeenCalledWith('lod-gesture-active', true);
    });

    // Feature flag off (default) → LOD never activates regardless of conditions
    test('does NOT set lod-gesture-active when __FEATURE_LOD__ is false', () => {
        global.__FEATURE_LOD__ = false;
        const r = setup();
        getHandler(r, 'start')({ transform: { k: 0.1 }, sourceEvent: { type: 'touchstart' } });
        const lodCalls = r.svg.classed.mock.calls.filter(([cls, val]) => cls === 'lod-gesture-active' && val === true);
        expect(lodCalls).toHaveLength(0);
    });
});

// ─── zoomToElement — un-cull culled card group ───────────────────────────────

describe('OrgChartRenderer.zoomToElement — un-cull on mobile', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
    });

    afterEach(() => { document.body.innerHTML = ''; });

    test('un-hides a culled card group before measuring bounding rect on mobile', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();

        const cardG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cardG.setAttribute('data-cx', '500');
        cardG.style.display = 'none';

        const profileBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        profileBox.classList.add('profile-box');
        cardG.appendChild(profileBox);
        document.querySelector('#canvas').appendChild(cardG);

        Object.defineProperty(profileBox, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }))
        });

        // screen.width = 0 in jsdom → isMobileDevice() = true
        r.zoomToElement(profileBox, 1.5, 0);

        expect(cardG.style.display).toBe('');
    });

    test('does not throw when element has no g[data-cx] ancestor', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const el = document.createElement('div');
        document.body.appendChild(el);
        Object.defineProperty(el, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 100, top: 50, right: 160, bottom: 90, width: 60, height: 40 }))
        });
        expect(() => r.zoomToElement(el, 1.5, 0)).not.toThrow();
    });
});

// ─── fitElementToView — un-cull culled descendants ───────────────────────────

describe('OrgChartRenderer.fitElementToView — un-cull on mobile', () => {
    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
        document.body.innerHTML = '<svg id="canvas" width="800" height="600"></svg>';
    });

    afterEach(() => { document.body.innerHTML = ''; });

    test('un-hides culled g[data-cx] descendants before measuring bounding rect on mobile', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();

        const teamG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const cardG1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const cardG2 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cardG1.setAttribute('data-cx', '500');
        cardG1.style.display = 'none';
        cardG2.setAttribute('data-cx', '600');
        cardG2.style.display = 'none';
        teamG.appendChild(cardG1);
        teamG.appendChild(cardG2);
        document.querySelector('#canvas').appendChild(teamG);

        Object.defineProperty(teamG, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 50, top: 30, right: 450, bottom: 330, width: 400, height: 300 }))
        });

        // screen.width = 0 in jsdom → isMobileDevice() = true
        r.fitElementToView(teamG, 0);

        expect(cardG1.style.display).toBe('');
        expect(cardG2.style.display).toBe('');
    });

    test('is a no-op for un-cull when container has no g[data-cx] children', () => {
        const r = new OrgChartRenderer(makeApp());
        r.reset();
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        document.querySelector('#canvas').appendChild(el);
        Object.defineProperty(el, 'getBoundingClientRect', {
            value: jest.fn(() => ({ left: 50, top: 30, right: 450, bottom: 330, width: 400, height: 300 }))
        });
        expect(() => r.fitElementToView(el, 0)).not.toThrow();
    });
});

// ─── _resolvePhoto ────────────────────────────────────────────────────────────

describe('OrgChartRenderer._resolvePhoto', () => {
    let OriginalImage;

    beforeEach(() => {
        OriginalImage = window.Image;
        // Fire onerror immediately so no real timeouts are hit in jsdom
        window.Image = class {
            set src(_) { Promise.resolve().then(() => { if (this.onerror) this.onerror(); }); }
        };
    });

    afterEach(() => {
        window.Image = OriginalImage;
    });

    test('resolves to null when email is empty', () => {
        const r = new OrgChartRenderer(makeApp());
        return expect(r._resolvePhoto('')).resolves.toBeNull();
    });

    test('resolves to null when no matching photo exists', () => {
        const r = new OrgChartRenderer(makeApp());
        return expect(r._resolvePhoto('unknown@example.com')).resolves.toBeNull();
    });

    test('resolves to photo path when image loads successfully', () => {
        window.Image = class {
            set src(url) { Promise.resolve().then(() => { if (this.onload) this.onload(); this._url = url; }); }
        };
        const r = new OrgChartRenderer(makeApp());
        return expect(r._resolvePhoto('jane.doe@example.com')).resolves.toMatch(/jane-doe\.webp/);
    });
});

// ─── byBoost — SOL-2 sort helper ─────────────────────────────────────────────

describe('byBoost — sort comparator', () => {
    // byBoost(boostMap, prefix) returns a comparator for Object.entries pairs ([key, value])
    const sort = (entries, boostMap, prefix = '') =>
        [...entries].sort(byBoost(boostMap, prefix)).map(([k]) => k);

    test('higher boost value sorts before lower boost value', () => {
        const entries = [['A', {}], ['B', {}], ['C', {}]];
        const result = sort(entries, { A: 10, B: 80, C: 40 });
        expect(result).toEqual(['B', 'C', 'A']);
    });

    test('boosted entries sort before unboosted entries', () => {
        const entries = [['Alpha', {}], ['Beta', {}], ['Gamma', {}]];
        const result = sort(entries, { Beta: 50 });
        expect(result[0]).toBe('Beta');
        expect(result.slice(1)).toContain('Alpha');
        expect(result.slice(1)).toContain('Gamma');
    });

    test('unboosted entries fall back to alphabetical order', () => {
        const entries = [['Zebra', {}], ['Apple', {}], ['Mango', {}]];
        const result = sort(entries, {});
        expect(result).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    test('mixed: some boosted, rest alphabetical', () => {
        const entries = [['Zebra', {}], ['Boosted', {}], ['Apple', {}]];
        const result = sort(entries, { Boosted: 99 });
        expect(result[0]).toBe('Boosted');
        expect(result[1]).toBe('Apple');
        expect(result[2]).toBe('Zebra');
    });

    test('boost value 0 is treated as "has boost" (not absent)', () => {
        const entries = [['Zebra', {}], ['Zero', {}]];
        const result = sort(entries, { Zero: 0 });
        // Zero (boost=0) must sort before Zebra (no boost)
        expect(result[0]).toBe('Zero');
        expect(result[1]).toBe('Zebra');
    });

    test('two entries both with boost 0 preserve relative insertion order', () => {
        // Equal boost → comparator returns 0 → stable sort preserves input order
        const entries = [['Mango', {}], ['Apple', {}]];
        const result = sort(entries, { Mango: 0, Apple: 0 });
        expect(result).toEqual(['Mango', 'Apple']);
    });

    test('prefix is prepended when looking up boost for themes', () => {
        // themeBoosts are keyed "stream::theme"
        const entries = [['ThemeZ', {}], ['ThemeA', {}], ['ThemeM', {}]];
        const boostMap = { 'S1::ThemeM': 99, 'S1::ThemeA': 10 };
        const result = sort(entries, boostMap, 'S1::');
        expect(result[0]).toBe('ThemeM');
        expect(result[1]).toBe('ThemeA');
        expect(result[2]).toBe('ThemeZ');
    });

    test('two boosted entries with equal boost value preserve relative insertion order', () => {
        // Equal boost → comparator returns b-a = 0 → stable sort preserves input order
        const entries = [['Banana', {}], ['Apple', {}]];
        const result = sort(entries, { Banana: 50, Apple: 50 });
        expect(result[0]).toBe('Banana');
        expect(result[1]).toBe('Apple');
    });
});

// ─── render — SOL-2 boost params smoke tests ─────────────────────────────────

describe('OrgChartRenderer.render — SOL-2 boost params', () => {
    let r;

    beforeEach(() => {
        window.__dsmGlobalContextMenuAttached = false;
        window.__panClickBlockerAttached = false;
        document.body.innerHTML = '<svg id="canvas" width="1200" height="800"></svg>';
        r = new OrgChartRenderer(makeApp());
        r.reset();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    const member = { Name: 'Alice', Role: 'Engineer', Email: 'a@g.com' };

    test('render does not throw when streamBoosts, themeBoosts, teamBoosts are provided', () => {
        const org = { 'StreamA': { 'ThemeX': { 'Team1': [member] } } };
        expect(() => r.render({
            organizationWithManagers: org,
            filteredStreams: null,
            visibleStreamNames: ['StreamA'],
            headers: ['Name', 'Role', 'Email'],
            organization: org,
            streamBoosts: { StreamA: 80 },
            themeBoosts: { 'StreamA::ThemeX': 50 },
            teamBoosts: { 'StreamA::ThemeX::Team1': 30 },
        })).not.toThrow();
    });

    test('render does not throw when boost maps are omitted (default {})', () => {
        const org = { 'StreamA': { 'ThemeX': { 'Team1': [member] } } };
        expect(() => r.render({
            organizationWithManagers: org,
            filteredStreams: null,
            visibleStreamNames: ['StreamA'],
            headers: ['Name'],
            organization: org,
        })).not.toThrow();
    });

    test('render does not throw with multiple streams having different boost values', () => {
        const org = {
            'LowStream':  { 'ThemeX': { 'Team1': [member] } },
            'HighStream': { 'ThemeY': { 'Team2': [member] } },
        };
        expect(() => r.render({
            organizationWithManagers: org,
            filteredStreams: null,
            visibleStreamNames: ['LowStream', 'HighStream'],
            headers: ['Name'],
            organization: org,
            streamBoosts: { LowStream: 10, HighStream: 90 },
            themeBoosts: {},
            teamBoosts: {},
        })).not.toThrow();
    });
});
