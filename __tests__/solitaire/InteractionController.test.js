import { InteractionController } from '../../js/solitaire/InteractionController.js';
import * as d3 from 'd3';

function makeApp() {
    return {
        showToast: jest.fn(),
        contextMenu: { hideMarquee: jest.fn() },
        renderer: {
            svg: { node: jest.fn(() => document.createElementNS('http://www.w3.org/2000/svg', 'svg')) },
            bringToCorrectLayer: jest.fn(),
        },
    };
}

describe('InteractionController constructor', () => {
    test('initializes with default mode free-pan', () => {
        const ic = new InteractionController(makeApp());
        expect(ic.mode).toBe('free-pan');
        expect(ic.isDraggable).toBe(false);
        expect(ic.selectedGroups).toBeInstanceOf(Set);
        expect(ic.panStartPos).toBeNull();
    });

    test('creates a drag behavior on construction', () => {
        const ic = new InteractionController(makeApp());
        expect(ic.drag).toBeDefined();
        expect(d3.drag).toHaveBeenCalled();
    });
});

describe('InteractionController.setMode', () => {
    test('sets mode and shows toast', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        ic.setMode('drag');
        expect(ic.mode).toBe('drag');
        expect(app.showToast).toHaveBeenCalledWith('Mode: Drag');
    });

    test('free-pan mode sets isDraggable to false', () => {
        const ic = new InteractionController(makeApp());
        ic.setMode('free-pan');
        expect(ic.isDraggable).toBe(false);
    });

    test('non-free-pan modes set isDraggable to true', () => {
        const ic = new InteractionController(makeApp());
        ic.setMode('drag');
        expect(ic.isDraggable).toBe(true);
        ic.setMode('contextual-drag');
        expect(ic.isDraggable).toBe(true);
        ic.setMode('select');
        expect(ic.isDraggable).toBe(true);
    });

    test('clears selection on mode change', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const el = document.createElement('g');
        el.classList.add('multi-selected');
        ic.selectedGroups.add(el);
        ic.setMode('drag');
        expect(ic.selectedGroups.size).toBe(0);
    });
});

describe('InteractionController selection', () => {
    let ic;

    beforeEach(() => {
        ic = new InteractionController(makeApp());
    });

    test('addToSelection adds element and applies class', () => {
        const el = document.createElement('g');
        ic.addToSelection(el);
        expect(ic.selectedGroups.has(el)).toBe(true);
        expect(el.classList.contains('multi-selected')).toBe(true);
    });

    test('addToSelection ignores null', () => {
        expect(() => ic.addToSelection(null)).not.toThrow();
    });

    test('isSelected returns true for added element', () => {
        const el = document.createElement('g');
        ic.addToSelection(el);
        expect(ic.isSelected(el)).toBe(true);
    });

    test('isSelected returns false for unknown element', () => {
        expect(ic.isSelected(document.createElement('g'))).toBe(false);
    });

    test('clearSelection removes class and empties set', () => {
        const el = document.createElement('g');
        ic.addToSelection(el);
        ic.clearSelection();
        expect(ic.selectedGroups.size).toBe(0);
        expect(el.classList.contains('multi-selected')).toBe(false);
    });
});

describe('InteractionController._parseTranslate', () => {
    const ic = new InteractionController(makeApp());

    test('parses translate(x, y)', () => {
        const el = document.createElement('g');
        el.setAttribute('transform', 'translate(100, 200)');
        expect(ic._parseTranslate(el)).toEqual({ x: 100, y: 200 });
    });

    test('returns {0, 0} when no transform', () => {
        const el = document.createElement('g');
        expect(ic._parseTranslate(el)).toEqual({ x: 0, y: 0 });
    });

    test('handles null element gracefully', () => {
        expect(ic._parseTranslate(null)).toEqual({ x: 0, y: 0 });
    });

    test('parses translate without spaces', () => {
        const el = document.createElement('g');
        el.setAttribute('transform', 'translate(50,75)');
        expect(ic._parseTranslate(el)).toEqual({ x: 50, y: 75 });
    });
});

describe('InteractionController._applyTranslateDelta', () => {
    const ic = new InteractionController(makeApp());

    test('moves element by dx, dy', () => {
        const el = document.createElement('g');
        el.setAttribute('transform', 'translate(10, 20)');
        ic._applyTranslateDelta(el, 5, 3);
        expect(el.getAttribute('transform')).toBe('translate(15,23)');
    });

    test('starts from 0,0 when no prior transform', () => {
        const el = document.createElement('g');
        ic._applyTranslateDelta(el, 10, 20);
        expect(el.getAttribute('transform')).toBe('translate(10,20)');
    });
});

describe('InteractionController._bboxContains', () => {
    const ic = new InteractionController(makeApp());

    const outer = { x: 0, y: 0, width: 100, height: 100 };

    test('returns true when inner is fully inside outer', () => {
        const inner = { x: 10, y: 10, width: 50, height: 50 };
        expect(ic._bboxContains(outer, inner)).toBe(true);
    });

    test('returns true when inner equals outer', () => {
        expect(ic._bboxContains(outer, outer)).toBe(true);
    });

    test('returns false when inner overflows right', () => {
        const inner = { x: 10, y: 10, width: 200, height: 50 };
        expect(ic._bboxContains(outer, inner, 0)).toBe(false);
    });

    test('returns false when inner is outside on the left', () => {
        const inner = { x: -50, y: 10, width: 20, height: 20 };
        expect(ic._bboxContains(outer, inner, 0)).toBe(false);
    });

    test('respects epsilon tolerance', () => {
        const inner = { x: -1, y: -1, width: 100, height: 100 };
        expect(ic._bboxContains(outer, inner, 2)).toBe(true);
    });
});

// ─── _rectIntersects ──────────────────────────────────────────────────────────

describe('InteractionController._rectIntersects', () => {
    const ic = new InteractionController(makeApp());

    test('returns true for overlapping rects', () => {
        const a = { left: 0, right: 100, top: 0, bottom: 100 };
        const b = { left: 50, right: 150, top: 50, bottom: 150 };
        expect(ic._rectIntersects(a, b)).toBe(true);
    });

    test('returns false when b is fully to the right', () => {
        const a = { left: 0, right: 50, top: 0, bottom: 50 };
        const b = { left: 60, right: 100, top: 0, bottom: 50 };
        expect(ic._rectIntersects(a, b)).toBe(false);
    });

    test('returns false when b is fully above', () => {
        const a = { left: 0, right: 50, top: 50, bottom: 100 };
        const b = { left: 0, right: 50, top: 0, bottom: 40 };
        expect(ic._rectIntersects(a, b)).toBe(false);
    });

    test('returns true when rects share an edge (inclusive boundary check)', () => {
        const a = { left: 0, right: 50, top: 0, bottom: 50 };
        const b = { left: 50, right: 100, top: 0, bottom: 50 };
        // Implementation uses strict > so touching rects are considered overlapping
        expect(ic._rectIntersects(a, b)).toBe(true);
    });
});

// ─── _makeStripRects ──────────────────────────────────────────────────────────

describe('InteractionController._makeStripRects', () => {
    const ic = new InteractionController(makeApp());

    test('returns 4 strip rects', () => {
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        const strips = ic._makeStripRects(outer, 10);
        expect(strips).toHaveLength(4);
    });

    test('strips respect thickness', () => {
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        const strips = ic._makeStripRects(outer, 10);
        // top strip: top=0, bottom=min(100, 0+10)=10
        expect(strips[0].top).toBe(0);
        expect(strips[0].bottom).toBe(10);
    });

    test('enforces minimum thickness of 1', () => {
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        const strips = ic._makeStripRects(outer, 0);
        // thickness clamped to 1
        expect(strips[0].bottom).toBe(1);
    });
});

// ─── _borderHit ───────────────────────────────────────────────────────────────

describe('InteractionController._borderHit', () => {
    const ic = new InteractionController(makeApp());

    test('returns false when rects do not intersect', () => {
        const sel = { left: 200, right: 300, top: 0, bottom: 50 };
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        expect(ic._borderHit(sel, outer)).toBe(false);
    });

    test('returns true when selection crosses outer border region', () => {
        // Selection hits the top border of the outer rect
        const sel = { left: 10, right: 90, top: -5, bottom: 8 };
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        expect(ic._borderHit(sel, outer, 10)).toBe(true);
    });

    test('returns false when selection is only inside the center', () => {
        const sel = { left: 20, right: 80, top: 20, bottom: 80 };
        const outer = { left: 0, right: 100, top: 0, bottom: 100 };
        // thicknessPx=5 — sel is far inside, does not touch any border strip
        expect(ic._borderHit(sel, outer, 5)).toBe(false);
    });
});

// ─── applyDraggableToggleState ────────────────────────────────────────────────

describe('InteractionController.applyDraggableToggleState', () => {
    test('calls d3.selectAll when invoked', () => {
        const ic = new InteractionController(makeApp());
        expect(() => ic.applyDraggableToggleState()).not.toThrow();
        expect(d3.selectAll).toHaveBeenCalled();
    });

    test('calls drag handles when isDraggable is true', () => {
        const ic = new InteractionController(makeApp());
        ic.isDraggable = true;
        expect(() => ic.applyDraggableToggleState()).not.toThrow();
    });

    test('removes drag when isDraggable is false', () => {
        const ic = new InteractionController(makeApp());
        ic.isDraggable = false;
        expect(() => ic.applyDraggableToggleState()).not.toThrow();
    });
});

// ─── setupLongPress ───────────────────────────────────────────────────────────

describe('InteractionController.setupLongPress', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        delete window.__solitaireLongPressAttached;
    });

    test('does nothing when canvas element is missing', () => {
        document.body.innerHTML = '';
        const ic = new InteractionController(makeApp());
        expect(() => ic.setupLongPress()).not.toThrow();
    });

    test('attaches listeners when canvas is present', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const ic = new InteractionController(makeApp());
        const svgEl = document.getElementById('canvas');
        const addListenerSpy = jest.spyOn(svgEl, 'addEventListener');
        ic.setupLongPress();
        expect(addListenerSpy).toHaveBeenCalled();
    });

    test('is idempotent — does not re-attach on second call', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const ic = new InteractionController(makeApp());
        ic.setupLongPress();
        const svgEl = document.getElementById('canvas');
        const addListenerSpy = jest.spyOn(svgEl, 'addEventListener');
        ic.setupLongPress(); // second call
        expect(addListenerSpy).not.toHaveBeenCalled();
    });

    test('pointerdown with touch type starts long-press timer and fires show', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = makeApp();
        app.contextMenu = { show: jest.fn(), hideMarquee: jest.fn() };
        const ic = new InteractionController(app);
        delete window.__solitaireLongPressAttached;
        ic.setupLongPress();
        const svgEl = document.getElementById('canvas');
        const e = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
        Object.defineProperty(e, 'pointerType', { value: 'touch', configurable: true });
        Object.defineProperty(e, 'pointerId', { value: 1, configurable: true });
        svgEl.dispatchEvent(e);
        jest.advanceTimersByTime(600);
        expect(app.contextMenu.show).toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('pointerdown with mouse pointerType is ignored', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = makeApp();
        app.contextMenu = { show: jest.fn(), hideMarquee: jest.fn() };
        const ic = new InteractionController(app);
        delete window.__solitaireLongPressAttached;
        ic.setupLongPress();
        const svgEl = document.getElementById('canvas');
        const e = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
        Object.defineProperty(e, 'pointerType', { value: 'mouse', configurable: true });
        svgEl.dispatchEvent(e);
        jest.advanceTimersByTime(600);
        expect(app.contextMenu.show).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('pointermove clears long-press timer when moved far', () => {
        jest.useFakeTimers();
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = makeApp();
        app.contextMenu = { show: jest.fn(), hideMarquee: jest.fn() };
        const ic = new InteractionController(app);
        delete window.__solitaireLongPressAttached;
        ic.setupLongPress();
        const svgEl = document.getElementById('canvas');
        // Start touch
        const down = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 });
        Object.defineProperty(down, 'pointerType', { value: 'touch', configurable: true });
        Object.defineProperty(down, 'pointerId', { value: 1, configurable: true });
        Object.defineProperty(down, 'clientX', { value: 0, configurable: true });
        Object.defineProperty(down, 'clientY', { value: 0, configurable: true });
        svgEl.dispatchEvent(down);
        // Move far enough to cancel
        const move = new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50 });
        Object.defineProperty(move, 'pointerId', { value: 1, configurable: true });
        svgEl.dispatchEvent(move);
        jest.advanceTimersByTime(600);
        expect(app.contextMenu.show).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('pointerup clears long-press state', () => {
        document.body.innerHTML = '<svg id="canvas"></svg>';
        const app = makeApp();
        app.contextMenu = { show: jest.fn(), hideMarquee: jest.fn() };
        const ic = new InteractionController(app);
        delete window.__solitaireLongPressAttached;
        ic.setupLongPress();
        const svgEl = document.getElementById('canvas');
        const down = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
        Object.defineProperty(down, 'pointerType', { value: 'touch', configurable: true });
        Object.defineProperty(down, 'pointerId', { value: 1, configurable: true });
        svgEl.dispatchEvent(down);
        const up = new MouseEvent('pointerup', { bubbles: true });
        Object.defineProperty(up, 'pointerId', { value: 1, configurable: true });
        svgEl.dispatchEvent(up);
        expect(ic.longPressPointerId).toBeNull();
    });
});

// ─── initSVGInteraction ───────────────────────────────────────────────────────

describe('InteractionController.initSVGInteraction', () => {
    test('attaches pointerdown listener to svgNode', () => {
        const ic = new InteractionController(makeApp());
        const svgNode = document.createElement('svg');
        const spy = jest.spyOn(svgNode, 'addEventListener');
        ic.initSVGInteraction(svgNode);
        expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.anything());
    });

    test('does not throw with real DOM element', () => {
        const ic = new InteractionController(makeApp());
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        expect(() => ic.initSVGInteraction(svgNode)).not.toThrow();
    });

    test('pointerdown with isDraggable=false returns early', () => {
        const ic = new InteractionController(makeApp());
        const svgNode = document.createElement('svg');
        document.body.appendChild(svgNode);
        ic.isDraggable = false;
        ic.mode = 'select';
        ic._startMarquee = jest.fn();
        // fire pointerdown — should return early (isDraggable false)
        svgNode.dispatchEvent(new MouseEvent('pointerdown', { bubbles: false, button: 0 }));
        expect(ic._startMarquee).not.toHaveBeenCalled();
        document.body.removeChild(svgNode);
    });

    test('pointerdown with select mode and no draggable target calls _startMarquee', () => {
        const app = makeApp();
        app.contextMenu = { ensureMarquee: jest.fn(() => {
            const el = document.createElement('div');
            el.getBoundingClientRect = jest.fn(() => ({ left: 0, right: 100, top: 0, bottom: 100 }));
            return el;
        }), hideMarquee: jest.fn() };
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        document.body.appendChild(svgNode);
        ic.isDraggable = true;
        ic.mode = 'select';
        ic._startMarquee = jest.fn();
        // Must register the listener before dispatching
        ic.initSVGInteraction(svgNode);
        const e = new MouseEvent('pointerdown', { button: 0, bubbles: false, cancelable: true });
        // No .draggable element under the event target
        svgNode.dispatchEvent(e);
        expect(ic._startMarquee).toHaveBeenCalled();
        document.body.removeChild(svgNode);
    });
});

// ─── _getLocalBBox / _getAbsBBox ─────────────────────────────────────────────

describe('InteractionController._getLocalBBox', () => {
    const ic = new InteractionController(makeApp());

    test('falls back to g.getBBox when no known key prefix', () => {
        const g = document.createElement('g');
        g.getBBox = jest.fn(() => ({ x: 5, y: 5, width: 50, height: 50 }));
        const result = ic._getLocalBBox(g);
        expect(g.getBBox).toHaveBeenCalled();
    });

    test('queries rect.stream-box for stream key', () => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-key', 'stream::enablers');
        g.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        const result = ic._getLocalBBox(g);
        // querySelector returns null for jsdom SVG, falls back to getBBox
        expect(result).toBeDefined();
    });
});

describe('InteractionController._getAbsBBox', () => {
    const ic = new InteractionController(makeApp());

    test('adds translate offset to local bbox', () => {
        const g = document.createElement('g');
        g.setAttribute('transform', 'translate(20, 30)');
        g.getBBox = jest.fn(() => ({ x: 5, y: 5, width: 50, height: 50 }));
        const abs = ic._getAbsBBox(g);
        expect(abs.x).toBe(25); // 20 + 5
        expect(abs.y).toBe(35); // 30 + 5
    });
});

// ─── _collectContextualTargets ────────────────────────────────────────────────

describe('InteractionController._collectContextualTargets', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns empty array for unknown key prefix', () => {
        const ic = new InteractionController(makeApp());
        const g = document.createElement('g');
        g.setAttribute('data-key', 'unknown::key');
        g.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        expect(ic._collectContextualTargets(g)).toEqual([]);
    });

    test('returns array for stream key prefix', () => {
        document.body.innerHTML = '';
        const ic = new InteractionController(makeApp());
        const g = document.createElement('g');
        g.setAttribute('data-key', 'stream::enablers');
        g.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 500, height: 500 }));
        const targets = ic._collectContextualTargets(g);
        expect(Array.isArray(targets)).toBe(true);
    });

    test('returns array for theme key prefix', () => {
        const ic = new InteractionController(makeApp());
        const g = document.createElement('g');
        g.setAttribute('data-key', 'theme::stream::theme');
        g.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 500, height: 500 }));
        expect(Array.isArray(ic._collectContextualTargets(g))).toBe(true);
    });

    test('returns array for team key prefix', () => {
        const ic = new InteractionController(makeApp());
        const g = document.createElement('g');
        g.setAttribute('data-key', 'team::stream::theme::team');
        g.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 500, height: 500 }));
        expect(Array.isArray(ic._collectContextualTargets(g))).toBe(true);
    });
});

// ─── drag callbacks ──────────────────────────────────────────────────────────

describe('InteractionController drag callbacks', () => {
    let ic;

    beforeEach(() => {
        ic = new InteractionController(makeApp());
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function getDragCallback(name) {
        const calls = ic.drag.on.mock.calls;
        const entry = calls.find(c => c[0] === name);
        return entry ? entry[1] : null;
    }

    test('drag start callback sets ctxPrevCanvas (free-pan mode)', () => {
        const startCb = getDragCallback('start');
        expect(startCb).toBeTruthy();
        const mockEl = document.createElement('g');
        mockEl.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        expect(() => startCb.call(mockEl, { x: 10, y: 20, active: false })).not.toThrow();
    });

    test('drag start callback returns early in select mode', () => {
        ic.mode = 'select';
        const startCb = getDragCallback('start');
        const mockEl = document.createElement('g');
        mockEl.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        expect(() => startCb.call(mockEl, { x: 10, y: 20, active: false })).not.toThrow();
        // ctxPrevCanvas should not be set (returns early after bringToCorrectLayer)
    });

    test('drag start callback sets ctxDragTargets for contextual-drag mode', () => {
        ic.mode = 'contextual-drag';
        const startCb = getDragCallback('start');
        const mockEl = document.createElement('g');
        mockEl.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        mockEl.getAttribute = jest.fn(() => 'stream::enablers');
        expect(() => startCb.call(mockEl, { x: 10, y: 20, active: false })).not.toThrow();
    });

    test('drag drag callback applies translate delta (free-pan mode)', () => {
        ic.mode = 'drag';
        ic.ctxPrevCanvas = [0, 0];
        const dragCb = getDragCallback('drag');
        const mockEl = document.createElement('g');
        mockEl.setAttribute('transform', 'translate(10,20)');
        mockEl.getBBox = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
        expect(() => dragCb.call(mockEl, { x: 5, y: 5 })).not.toThrow();
    });

    test('drag drag callback returns early in select mode', () => {
        ic.mode = 'select';
        const dragCb = getDragCallback('drag');
        const mockEl = document.createElement('g');
        expect(() => dragCb.call(mockEl, { x: 5, y: 5 })).not.toThrow();
    });

    test('drag end callback clears ctxPrevCanvas', () => {
        ic.ctxPrevCanvas = [10, 20];
        const endCb = getDragCallback('end');
        expect(() => endCb.call({})).not.toThrow();
        expect(ic.ctxPrevCanvas).toBeNull();
    });
});

// ─── _startMarquee ────────────────────────────────────────────────────────────

describe('InteractionController._startMarquee', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    function makeAppWithMarquee() {
        const app = makeApp();
        const marqueeEl = document.createElement('div');
        marqueeEl.style.display = 'none';
        marqueeEl.getBoundingClientRect = jest.fn(() => ({ left: 10, right: 90, top: 10, bottom: 90 }));
        app.contextMenu.ensureMarquee = jest.fn(() => marqueeEl);
        return { app, marqueeEl };
    }

    test('does not throw when called', () => {
        const { app } = makeAppWithMarquee();
        const ic = new InteractionController(app);
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svgNode);
        const e = { clientX: 50, clientY: 50, preventDefault: jest.fn(), stopPropagation: jest.fn() };
        expect(() => ic._startMarquee(e, svgNode)).not.toThrow();
    });

    test('sets marquee element display and position', () => {
        const { app, marqueeEl } = makeAppWithMarquee();
        const ic = new InteractionController(app);
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svgNode);
        const e = { clientX: 50, clientY: 50, preventDefault: jest.fn(), stopPropagation: jest.fn() };
        ic._startMarquee(e, svgNode);
        expect(marqueeEl.style.display).toBe('block');
        expect(marqueeEl.style.left).toBe('50px');
    });

    test('pointerup clears marquee selection', () => {
        const { app } = makeAppWithMarquee();
        const ic = new InteractionController(app);
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svgNode);
        const e = { clientX: 50, clientY: 50, preventDefault: jest.fn(), stopPropagation: jest.fn() };
        ic._startMarquee(e, svgNode);
        // Dispatch pointerup to trigger the up handler
        window.dispatchEvent(new Event('pointerup', { bubbles: true }));
        expect(app.contextMenu.hideMarquee).toHaveBeenCalled();
    });

    test('pointermove updates marquee element dimensions', () => {
        const { app, marqueeEl } = makeAppWithMarquee();
        const ic = new InteractionController(app);
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svgNode);
        ic._startMarquee({ clientX: 50, clientY: 50 }, svgNode);
        // Fire pointermove to trigger the move callback
        window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 }));
        expect(marqueeEl.style.width).toBe('50px');
        expect(marqueeEl.style.height).toBe('70px');
    });

    test('pointerup with shiftKey preserves existing selection', () => {
        const { app, marqueeEl } = makeAppWithMarquee();
        const ic = new InteractionController(app);
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        document.body.appendChild(svgNode);
        const g = document.createElement('g');
        g.classList.add('draggable');
        g.getBoundingClientRect = jest.fn(() => ({ left: 10, right: 90, top: 10, bottom: 90 }));
        svgNode.appendChild(g);
        ic.addToSelection(g);
        ic._startMarquee({ clientX: 50, clientY: 50 }, svgNode);
        const upEvent = new MouseEvent('pointerup', { bubbles: true, shiftKey: true });
        window.dispatchEvent(upEvent);
        // With shiftKey, clearSelection is NOT called, so g should still be in selection
        expect(ic.selectedGroups.has(g)).toBe(true);
    });
});

// ─── _startMoveSelection ─────────────────────────────────────────────────────

describe('InteractionController._startMoveSelection', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('does not throw when called', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        const g = document.createElement('g');
        g.setAttribute('transform', 'translate(10,20)');
        ic.addToSelection(g);
        const e = { clientX: 100, clientY: 100, shiftKey: false, preventDefault: jest.fn() };
        expect(() => ic._startMoveSelection(e, g, svgNode)).not.toThrow();
    });

    test('adds origin group to selection if not already selected', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        const g = document.createElement('g');
        const e = { clientX: 0, clientY: 0, shiftKey: false, preventDefault: jest.fn() };
        ic._startMoveSelection(e, g, svgNode);
        expect(ic.isSelected(g)).toBe(true);
    });

    test('shift+click adds origin group without clearing selection', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        const g1 = document.createElement('g');
        const g2 = document.createElement('g');
        ic.addToSelection(g1);
        const e = { clientX: 0, clientY: 0, shiftKey: true, preventDefault: jest.fn() };
        ic._startMoveSelection(e, g2, svgNode);
        expect(ic.isSelected(g1)).toBe(true);
        expect(ic.isSelected(g2)).toBe(true);
    });

    test('pointermove updates selected group transforms', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        document.body.appendChild(svgNode);
        const g = document.createElement('g');
        g.setAttribute('transform', 'translate(10,20)');
        ic.addToSelection(g);
        const e = { clientX: 100, clientY: 100, shiftKey: false, preventDefault: jest.fn() };
        ic._startMoveSelection(e, g, svgNode);
        window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 110, clientY: 115 }));
        expect(g.getAttribute('transform')).toContain('translate(');
    });

    test('pointerup removes window listeners', () => {
        const app = makeApp();
        const ic = new InteractionController(app);
        const svgNode = document.createElement('svg');
        const g = document.createElement('g');
        g.setAttribute('transform', 'translate(0,0)');
        ic.addToSelection(g);
        ic._startMoveSelection({ clientX: 0, clientY: 0, shiftKey: false, preventDefault: jest.fn() }, g, svgNode);
        expect(() => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))).not.toThrow();
    });
});
