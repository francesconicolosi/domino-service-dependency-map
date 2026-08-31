import '../../css/postit.css';
import { createModal } from './utils.js';

const LS_PREFIX = 'dsm-postit-v1:';
const DEFAULT_WIDTH  = 280;
const DEFAULT_HEIGHT = 220;

export class PostItNote {
    constructor(appKey) {
        this._key   = LS_PREFIX + appKey;
        this._el    = null;
        this._state = null;
        this._resizeObserver = null;
    }

    /** Restore a previously saved post-it from localStorage. */
    init() {
        const raw = localStorage.getItem(this._key);
        if (!raw) return;
        try {
            const state = JSON.parse(raw);
            if (state && typeof state.x === 'number') {
                this._state = state;
                this._render();
            }
        } catch {
            localStorage.removeItem(this._key);
        }
    }

    /**
     * Create a new post-it at (x, y), or move the existing one there.
     * @param {number} x
     * @param {number} y
     */
    create(x, y) {
        const topBarBottom = this._topBarBottom();
        const clampedY = Math.max(topBarBottom + 4, y);

        if (this._el) {
            this._state.x = x;
            this._state.y = clampedY;
            this._el.style.left = `${x}px`;
            this._el.style.top  = `${clampedY}px`;
            this._save();
            this._el.querySelector('.postit-textarea')?.focus();
            return;
        }

        this._state = {
            x, y: clampedY,
            width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT,
            content: '', minimized: false,
        };
        this._render();
        this._save();
        this._el?.querySelector('.postit-textarea')?.focus();
    }

    /** Returns true when a post-it note is currently displayed. */
    isActive() {
        return this._el !== null;
    }

    /**
     * Attach a minimal right-click context menu to the given element.
     * Filters out clicks originating from the top-bar.
     * @param {HTMLElement} element
     */
    attachContextMenu(element) {
        element.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.top-bar, .jenga-top-bar, .monopoli-top-bar')) return;
            if (e.target.closest('.postit-note')) return;
            e.preventDefault();
            this._showContextMenu(e.clientX, e.clientY);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _topBarBottom() {
        return document.querySelector('.top-bar, .jenga-top-bar, .monopoli-top-bar')
            ?.getBoundingClientRect().bottom ?? 0;
    }

    _render() {
        const s = this._state;

        const el = document.createElement('div');
        el.className = 'postit-note';
        el.style.left   = `${s.x}px`;
        el.style.top    = `${s.y}px`;
        el.style.width  = `${s.width}px`;
        if (!s.minimized) el.style.height = `${s.height}px`;

        // ── Header / drag handle ──────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'postit-header';

        const label = document.createElement('span');
        label.className = 'postit-label';
        label.textContent = 'Note';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className  = 'postit-minimize';
        minimizeBtn.type       = 'button';
        minimizeBtn.textContent = s.minimized ? '□' : '−';
        minimizeBtn.setAttribute('aria-label', s.minimized ? 'Restore post-it' : 'Minimize post-it');
        minimizeBtn.setAttribute('title',      s.minimized ? 'Restore post-it' : 'Minimize post-it');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'postit-close';
        closeBtn.type      = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Delete post-it');
        closeBtn.setAttribute('title',      'Delete post-it');

        header.appendChild(label);
        header.appendChild(minimizeBtn);
        header.appendChild(closeBtn);

        // ── Body ─────────────────────────────────────────────────────────────
        const textarea = document.createElement('textarea');
        textarea.className   = 'postit-textarea';
        textarea.placeholder = 'Type your note here…';
        textarea.value       = s.content ?? '';

        el.appendChild(header);
        el.appendChild(textarea);
        document.body.appendChild(el);
        this._el = el;

        // Apply minimized appearance immediately if loading a saved minimized state
        if (s.minimized) el.classList.add('postit-note--minimized');

        // ── Events ───────────────────────────────────────────────────────────

        // Prevent browser context menu on the note itself
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Stop pointerdown on action buttons from bubbling to the drag handler
        minimizeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        closeBtn.addEventListener('pointerdown',    (e) => e.stopPropagation());

        minimizeBtn.addEventListener('click', () => this._toggleMinimize());
        closeBtn.addEventListener('click',    () => this._remove());

        // Persist content in real time
        textarea.addEventListener('input', () => {
            this._state.content = textarea.value;
            this._save();
        });

        this._initDrag(header);
        this._initResize();
    }

    _initDrag(handle) {
        let dragStartX, dragStartY, elStartLeft, elStartTop;

        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            dragStartX  = e.clientX;
            dragStartY  = e.clientY;
            elStartLeft = parseInt(this._el.style.left, 10) || 0;
            elStartTop  = parseInt(this._el.style.top,  10) || 0;
        });

        handle.addEventListener('pointermove', (e) => {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            const topBarBottom = this._topBarBottom();
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const newLeft = Math.max(0, Math.min(window.innerWidth  - this._el.offsetWidth,  elStartLeft + dx));
            const newTop  = Math.max(topBarBottom, Math.min(window.innerHeight - this._el.offsetHeight, elStartTop + dy));
            this._el.style.left = `${newLeft}px`;
            this._el.style.top  = `${newTop}px`;
            this._state.x = newLeft;
            this._state.y = newTop;
        });

        handle.addEventListener('pointerup', (e) => {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            handle.releasePointerCapture(e.pointerId);
            this._save();
        });

        handle.addEventListener('pointercancel', (e) => {
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            this._save();
        });
    }

    _initResize() {
        const ro = new ResizeObserver(() => {
            // Never update height while minimized — state.height always reflects the expanded size
            if (!this._el || this._state.minimized) return;
            this._state.width  = this._el.offsetWidth;
            this._state.height = this._el.offsetHeight;
            this._save();
        });
        ro.observe(this._el);
        this._resizeObserver = ro;
    }

    _toggleMinimize() {
        const nowMinimized = !this._state.minimized;
        this._state.minimized = nowMinimized;

        const note        = this._el;
        const textarea    = note.querySelector('.postit-textarea');
        const btn         = note.querySelector('.postit-minimize');
        const label       = nowMinimized ? 'Restore post-it' : 'Minimize post-it';
        const icon        = nowMinimized ? '□' : '−';

        btn.textContent = icon;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title',      label);

        if (nowMinimized) {
            note.classList.add('postit-note--minimized');
            // height is intentionally left unset — CSS collapses to header only
            // After layout settles, check for legend overlap and reposition if needed
            requestAnimationFrame(() => this._adjustForLegendOverlap());
        } else {
            note.classList.remove('postit-note--minimized');
            note.style.height = `${this._state.height}px`;
            textarea?.focus();
        }

        this._save();
    }

    /**
     * When minimized, if the post-it overlaps the legend element (Domino: #legend,
     * Solitaire: #legend-root) reposition it to avoid the overlap.
     */
    _adjustForLegendOverlap() {
        if (!this._el) return;
        const legend = document.querySelector('#legend, #legend-root');
        if (!legend) return;

        const lr = legend.getBoundingClientRect();
        const pr = this._el.getBoundingClientRect();

        // No overlap — nothing to do
        if (pr.right <= lr.left || pr.left >= lr.right || pr.bottom <= lr.top || pr.top >= lr.bottom) return;

        const topBarBottom = this._topBarBottom();
        const w = pr.width;
        const h = pr.height;

        // Candidate positions in preference order: below, above, right, left of the legend
        const candidates = [
            { x: pr.left,           y: lr.bottom + 8 },
            { x: pr.left,           y: lr.top - h - 8 },
            { x: lr.right  + 8,     y: pr.top },
            { x: lr.left   - w - 8, y: pr.top },
        ];

        for (const { x, y } of candidates) {
            if (
                x >= 0 && y >= topBarBottom &&
                x + w <= window.innerWidth &&
                y + h <= window.innerHeight
            ) {
                this._el.style.left = `${x}px`;
                this._el.style.top  = `${y}px`;
                this._state.x = x;
                this._state.y = y;
                this._save();
                return;
            }
        }

        // Fallback: top-left corner, just below the top bar
        const fx = 16;
        const fy = topBarBottom + 8;
        this._el.style.left = `${fx}px`;
        this._el.style.top  = `${fy}px`;
        this._state.x = fx;
        this._state.y = fy;
        this._save();
    }

    _showContextMenu(x, y) {
        document.querySelector('.postit-context-menu')?.remove();

        const menu = document.createElement('div');
        menu.className = 'postit-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top  = `${y}px`;

        const btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.innerHTML = '&#128203; Add a post-it';
        if (this.isActive()) {
            btn.disabled = true;
            btn.title = 'A post-it note is already open';
        } else {
            btn.addEventListener('click', () => {
                menu.remove();
                this.create(x, y);
            });
        }
        menu.appendChild(btn);

        menu.addEventListener('contextmenu', (e) => e.preventDefault());
        document.body.appendChild(menu);

        // Clamp to viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right  > window.innerWidth)  menu.style.left = `${x - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top  = `${y - rect.height}px`;

        const dismiss = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('pointerdown', dismiss, true);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 0);
    }

    _save() {
        try {
            localStorage.setItem(this._key, JSON.stringify(this._state));
        } catch { /* storage full or unavailable */ }
    }

    async _remove() {
        if (this._removing) return;
        this._removing = true;
        const result = await createModal({
            title: 'Delete post-it?',
            html:  'This note will be permanently deleted and cannot be recovered.',
            buttons: [
                { id: 'cancel', label: 'Cancel' },
                { id: 'delete', label: 'Delete', primary: true },
            ],
        });
        this._removing = false;
        if (result !== 'delete') return;

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        localStorage.removeItem(this._key);
        this._el?.remove();
        this._el    = null;
        this._state = null;
    }
}
