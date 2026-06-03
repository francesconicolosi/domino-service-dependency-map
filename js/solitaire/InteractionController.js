import * as d3 from 'd3';

const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_PX = 10;

export class InteractionController {
    constructor(app) {
        this.app = app;
        this.mode = 'free-pan';
        this.isDraggable = false;
        this.selectedGroups = new Set();
        this.ctxDragTargets = [];
        this.ctxPrevCanvas = null;
        this.suppressClicksUntil = 0;
        this.panMoved = false;
        this.panStartPos = null;
        this.longPressTimer = null;
        this.longPressPointerId = null;
        this.longPressStart = null;
        this.longPressFired = false;
        this.drag = this._createDrag();
    }

    _createDrag() {
        const ctrl = this;
        return d3.drag()
            .container(() => ctrl.app.renderer.svg?.node?.() || document.body)
            .on('start', function(event) {
                ctrl.app.renderer.bringToCorrectLayer(this);
                if (ctrl.mode === 'select') return;

                const svgNode = ctrl.app.renderer.svg?.node?.();
                const t = svgNode ? d3.zoomTransform(svgNode) : d3.zoomIdentity;
                ctrl.ctxPrevCanvas = t.invert([event.x, event.y]);

                if (ctrl.mode === 'contextual-drag') {
                    ctrl.ctxDragTargets = ctrl._collectContextualTargets(this);
                    ctrl.ctxDragTargets = ctrl.ctxDragTargets.filter(el => el !== this);
                    ctrl.ctxDragTargets.forEach(g => ctrl.app.renderer.bringToCorrectLayer(g));
                } else {
                    ctrl.ctxDragTargets = [];
                }
            })
            .on('drag', function(event) {
                if (ctrl.mode === 'select') return;

                const svgNode = ctrl.app.renderer.svg?.node?.();
                const t = svgNode ? d3.zoomTransform(svgNode) : d3.zoomIdentity;
                const currCanvas = t.invert([event.x, event.y]);
                const prev = ctrl.ctxPrevCanvas || currCanvas;
                const dx = currCanvas[0] - prev[0];
                const dy = currCanvas[1] - prev[1];
                ctrl.ctxPrevCanvas = currCanvas;

                ctrl._applyTranslateDelta(this, dx, dy);

                if (ctrl.mode === 'contextual-drag' && ctrl.ctxDragTargets?.length) {
                    ctrl.ctxDragTargets.forEach(el => ctrl._applyTranslateDelta(el, dx, dy));
                }
            })
            .on('end', function() {
                ctrl.ctxPrevCanvas = null;
                ctrl.ctxDragTargets = [];
            });
    }

    _parseTranslate(el) {
        const t = el?.getAttribute?.('transform') || '';
        const m = t.match(/translate\(([^,]+),\s*([^)]+)\)/);
        return { x: m ? (+m[1] || 0) : 0, y: m ? (+m[2] || 0) : 0 };
    }

    _applyTranslateDelta(el, dx, dy) {
        const tr = this._parseTranslate(el);
        el.setAttribute('transform', `translate(${tr.x + dx},${tr.y + dy})`);
    }

    _getLocalBBox(g) {
        const key = g.getAttribute('data-key') || '';
        const pick = (sel) => g.querySelector(sel)?.getBBox?.() || null;
        if (key.startsWith('stream::')) return pick('rect.stream-box') || g.getBBox();
        if (key.startsWith('theme::'))  return pick('rect.theme-box')  || g.getBBox();
        if (key.startsWith('team::'))   return pick('rect.team-box')   || g.getBBox();
        if (key.startsWith('card::'))   return pick('rect.profile-box')|| g.getBBox();
        return g.getBBox();
    }

    _getAbsBBox(g) {
        const tr = this._parseTranslate(g);
        const b = this._getLocalBBox(g);
        return { x: tr.x + b.x, y: tr.y + b.y, width: b.width, height: b.height };
    }

    _bboxContains(outer, inner, eps = 2) {
        return (
            inner.x >= outer.x - eps &&
            inner.y >= outer.y - eps &&
            (inner.x + inner.width)  <= (outer.x + outer.width)  + eps &&
            (inner.y + inner.height) <= (outer.y + outer.height) + eps
        );
    }

    _collectContextualTargets(containerEl) {
        const key = containerEl.getAttribute('data-key') || '';
        const containerBox = this._getAbsBBox(containerEl);

        let selectors = [];
        if (key.startsWith('stream::')) {
            selectors = ['g.draggable[data-key^="theme::"]', 'g.draggable[data-key^="team::"]', 'g.draggable[data-key^="card::"]'];
        } else if (key.startsWith('theme::')) {
            selectors = ['g.draggable[data-key^="team::"]', 'g.draggable[data-key^="card::"]'];
        } else if (key.startsWith('team::')) {
            selectors = ['g.draggable[data-key^="card::"]'];
        } else {
            return [];
        }

        const candidates = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
        return candidates.filter(el => this._bboxContains(containerBox, this._getAbsBBox(el)));
    }

    setMode(mode) {
        this.mode = mode;

        this.app.showToast(`Mode: ${
            mode === 'free-pan' ? 'Free pan' :
                mode === 'contextual-drag' ? 'Contextual drag' :
                    mode === 'drag' ? 'Drag' :
                        'Multiple select'
        }`);

        this.isDraggable = (mode !== 'free-pan');
        this.clearSelection();
        this.app.contextMenu.hideMarquee();
        this.applyDraggableToggleState();
    }

    clearSelection() {
        this.selectedGroups.forEach(g => g.classList.remove('multi-selected'));
        this.selectedGroups.clear();
    }

    addToSelection(g) {
        if (!g) return;
        g.classList.add('multi-selected');
        this.selectedGroups.add(g);
    }

    isSelected(g) {
        return this.selectedGroups.has(g);
    }

    applyDraggableToggleState() {
        const groups = d3.selectAll('.draggable');
        const handles = d3.selectAll('.resize-handles');

        if (this.isDraggable) {
            groups.call(this.drag);
            handles.style('display', null).style('pointer-events', 'all');
        } else {
            groups.on('.drag', null);
            handles.style('display', 'none').style('pointer-events', 'none');
        }
    }

    setupLongPress() {
        if (window.__solitaireLongPressAttached) return;
        window.__solitaireLongPressAttached = true;

        const svgEl = document.getElementById('canvas');
        if (!svgEl) return;

        svgEl.style.webkitTouchCallout = 'none';
        svgEl.style.webkitUserSelect = 'none';
        svgEl.style.userSelect = 'none';

        const clear = () => {
            if (this.longPressTimer) clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
            this.longPressPointerId = null;
            this.longPressStart = null;
            this.longPressFired = false;
        };

        svgEl.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
            if (e.button !== 0) return;

            this.longPressPointerId = e.pointerId;
            this.longPressStart = { x: e.clientX, y: e.clientY };
            this.longPressFired = false;

            this.longPressTimer = setTimeout(() => {
                if (this.longPressPointerId !== e.pointerId) return;
                this.longPressFired = true;
                this.app.contextMenu.show(e.clientX, e.clientY);
                this.suppressClicksUntil = Date.now() + 450;
            }, LONG_PRESS_MS);
        }, { passive: true });

        svgEl.addEventListener('pointermove', (e) => {
            if (e.pointerId !== this.longPressPointerId) return;
            if (!this.longPressStart) return;
            const dx = e.clientX - this.longPressStart.x;
            const dy = e.clientY - this.longPressStart.y;
            if ((dx * dx + dy * dy) > (LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX)) {
                clear();
            }
        }, { passive: true });

        const end = (e) => {
            if (e.pointerId !== this.longPressPointerId) return;
            if (this.longPressFired) {
                try { e.preventDefault(); } catch {}
                try { e.stopPropagation(); } catch {}
            }
            clear();
        };

        svgEl.addEventListener('pointerup', end, { passive: false });
        svgEl.addEventListener('pointercancel', end, { passive: false });
    }

    initSVGInteraction(svgNode) {
        svgNode.addEventListener('pointerdown', (e) => {
            if (!this.isDraggable) return;
            if (this.mode !== 'select') return;
            if (e.button !== 0) return;

            const g = e.target?.closest?.('g.draggable');
            if (g && (this.isSelected(g) || e.shiftKey)) {
                e.preventDefault();
                e.stopPropagation();
                this._startMoveSelection(e, g, svgNode);
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            this._startMarquee(e, svgNode);
        }, { capture: true });
    }

    _startMarquee(e, svgNode) {
        const el = this.app.contextMenu.ensureMarquee();
        const startX = e.clientX;
        const startY = e.clientY;

        el.style.display = 'block';
        el.style.left = `${startX}px`;
        el.style.top = `${startY}px`;
        el.style.width = '0px';
        el.style.height = '0px';

        const move = (ev) => {
            const x = ev.clientX;
            const y = ev.clientY;
            const left = Math.min(startX, x);
            const top = Math.min(startY, y);
            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
            el.style.width = `${Math.abs(x - startX)}px`;
            el.style.height = `${Math.abs(y - startY)}px`;
        };

        const up = (ev) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);

            const selRect = el.getBoundingClientRect();
            this.app.contextMenu.hideMarquee();

            if (!ev.shiftKey) this.clearSelection();

            const groups = Array.from(svgNode.querySelectorAll('g.draggable'));
            const BORDER_PX = 10;
            groups.forEach(g => {
                const r = g.getBoundingClientRect();
                if (this._borderHit(selRect, r, BORDER_PX)) {
                    this.addToSelection(g);
                }
            });
        };

        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerup', up, { passive: true });
    }

    _startMoveSelection(e, originGroup, svgNode) {
        this.selectedGroups.forEach(g => this.app.renderer.bringToCorrectLayer(g));
        if (!this.isSelected(originGroup) && !e.shiftKey) {
            this.clearSelection();
            this.addToSelection(originGroup);
        } else if (!this.isSelected(originGroup) && e.shiftKey) {
            this.addToSelection(originGroup);
        }

        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const initial = new Map();
        this.selectedGroups.forEach(g => {
            const t = g.getAttribute('transform') || '';
            const m = t.match(/translate\(([^,]+),\s*([^)]+)\)/);
            initial.set(g, {
                x: m ? (+m[1] || 0) : 0,
                y: m ? (+m[2] || 0) : 0
            });
        });

        const getK = () => (d3.zoomTransform(svgNode)?.k || 1);

        const move = (ev) => {
            const dx = (ev.clientX - startClientX) / getK();
            const dy = (ev.clientY - startClientY) / getK();
            this.selectedGroups.forEach(g => {
                const p = initial.get(g);
                if (!p) return;
                g.setAttribute('transform', `translate(${p.x + dx},${p.y + dy})`);
            });
            this.selectedGroups.forEach(g => this.app.renderer.bringToCorrectLayer(g));
        };

        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };

        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerup', up, { passive: true });
    }

    _rectIntersects(a, b) {
        return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
    }

    _makeStripRects(outer, t) {
        const { left, right, top, bottom } = outer;
        const tt = Math.max(1, t);
        return [
            { left, right, top, bottom: Math.min(bottom, top + tt) },
            { left, right, top: Math.max(top, bottom - tt), bottom },
            { left, right: Math.min(right, left + tt), top: top + tt, bottom: bottom - tt },
            { left: Math.max(left, right - tt), right, top: top + tt, bottom: bottom - tt }
        ];
    }

    _borderHit(selRect, outerRect, thicknessPx = 10) {
        if (!this._rectIntersects(selRect, outerRect)) return false;
        return this._makeStripRects(outerRect, thicknessPx).some(s => this._rectIntersects(selRect, s));
    }
}
