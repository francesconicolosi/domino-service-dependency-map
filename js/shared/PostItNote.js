import '../../css/postit.css';
import { createModal } from './utils.js';

const LS_KEY_V2  = 'dsm-postit-v2:';
const LS_KEY_V1  = 'dsm-postit-v1:';
const DEFAULT_WIDTH  = 280;
const DEFAULT_HEIGHT = 220;
const DEFAULT_TITLE  = 'Note';

// Matches http(s) URLs; trailing punctuation stripped so "sentence." doesn't include the dot.
const URL_RE = /https?:\/\/[^\s<>"'`()\[\]{}]+[^\s<>"'`()\[\]{}.,:;!?]/g;

function _updateDisplayEl(el, content) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!content) {
        el.className = 'postit-display postit-display--empty';
        const ph = document.createElement('span');
        ph.className = 'postit-display__placeholder';
        ph.textContent = 'Type your note here…';
        el.appendChild(ph);
        return;
    }
    el.className = 'postit-display';
    const lines = content.split('\n');
    lines.forEach((line, lineIdx) => {
        URL_RE.lastIndex = 0;
        let last = 0;
        let m;
        while ((m = URL_RE.exec(line)) !== null) {
            if (m.index > last) el.appendChild(document.createTextNode(line.slice(last, m.index)));
            const a = document.createElement('a');
            a.href        = m[0];
            a.textContent = m[0];
            a.target      = '_blank';
            a.rel         = 'noopener noreferrer';
            a.className   = 'postit-link';
            a.addEventListener('click', e => e.stopPropagation());
            el.appendChild(a);
            last = m.index + m[0].length;
        }
        if (last < line.length) el.appendChild(document.createTextNode(line.slice(last)));
        if (lineIdx < lines.length - 1) el.appendChild(document.createElement('br'));
    });
}

export class PostItNote {
    constructor(appKey) {
        this._appKey = appKey;
        this._lsKey  = LS_KEY_V2 + appKey;
        this._notes  = new Map(); // id → { state, el, ro, removing }
    }

    /** Returns true when at least one note is open. */
    isActive() {
        return this._notes.size > 0;
    }

    init() {
        this._loadStates().forEach(s => this._renderNote(s));
    }

    create(x, y) {
        const topBarBottom = this._topBarBottom();
        const id = 'p-' + Date.now();
        const state = {
            id,
            title: DEFAULT_TITLE,
            x,
            y: Math.max(topBarBottom + 4, y),
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            content: '',
            minimized: false,
        };
        this._renderNote(state);
        this._save();
        // Focus the textarea immediately on a fresh note
        const noteData = this._notes.get(id);
        noteData?.el.querySelector('.postit-textarea')?.focus();
    }

    attachContextMenu(element) {
        element.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.top-bar, .jenga-top-bar, .monopoli-top-bar')) return;
            if (e.target.closest('.postit-note')) return;
            e.preventDefault();
            this._showContextMenu(e.clientX, e.clientY);
        });
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    _loadStates() {
        const raw = localStorage.getItem(this._lsKey);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                if (Array.isArray(data)) return data.filter(s => s && typeof s.x === 'number');
            } catch { /* fall through */ }
            localStorage.removeItem(this._lsKey);
        }
        // Migrate from v1 (single-note format)
        const rawV1 = localStorage.getItem(LS_KEY_V1 + this._appKey);
        if (rawV1) {
            try {
                const s = JSON.parse(rawV1);
                if (s && typeof s.x === 'number') {
                    const migrated = [{ id: 'p-0', title: DEFAULT_TITLE, ...s }];
                    localStorage.setItem(this._lsKey, JSON.stringify(migrated));
                    localStorage.removeItem(LS_KEY_V1 + this._appKey);
                    return migrated;
                }
            } catch { /* ignore */ }
        }
        return [];
    }

    _save() {
        const states = [...this._notes.values()].map(n => n.state);
        try { localStorage.setItem(this._lsKey, JSON.stringify(states)); } catch { /* storage full */ }
    }

    _topBarBottom() {
        return document.querySelector('.top-bar, .jenga-top-bar, .monopoli-top-bar')
            ?.getBoundingClientRect().bottom ?? 0;
    }

    _renderNote(state) {
        if (!state.id) state.id = 'p-' + Date.now();

        const el = document.createElement('div');
        el.className  = 'postit-note';
        el.style.left = `${state.x}px`;
        el.style.top  = `${state.y}px`;
        el.style.width = `${state.width}px`;
        if (!state.minimized) el.style.height = `${state.height}px`;

        // ── Header / drag handle ──────────────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'postit-header';

        const titleDisplay = document.createElement('span');
        titleDisplay.className   = 'postit-label';
        titleDisplay.textContent = state.title || DEFAULT_TITLE;
        titleDisplay.title       = state.title || DEFAULT_TITLE;

        const titleEdit = document.createElement('textarea');
        titleEdit.className     = 'postit-title-edit';
        titleEdit.value         = state.title || DEFAULT_TITLE;
        titleEdit.rows          = 2;
        titleEdit.style.display = 'none';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className   = 'postit-minimize';
        minimizeBtn.type        = 'button';
        minimizeBtn.textContent = state.minimized ? '□' : '−';
        minimizeBtn.setAttribute('aria-label', state.minimized ? 'Restore post-it' : 'Minimize post-it');
        minimizeBtn.setAttribute('title',      state.minimized ? 'Restore post-it' : 'Minimize post-it');

        const closeBtn = document.createElement('button');
        closeBtn.className   = 'postit-close';
        closeBtn.type        = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Delete post-it');
        closeBtn.setAttribute('title',      'Delete post-it');

        header.appendChild(titleDisplay);
        header.appendChild(titleEdit);
        header.appendChild(minimizeBtn);
        header.appendChild(closeBtn);

        // ── Body ─────────────────────────────────────────────────────────────
        const body = document.createElement('div');
        body.className = 'postit-body';

        const displayEl = document.createElement('div');
        _updateDisplayEl(displayEl, state.content ?? '');
        // Start interactive (links clickable); focus on textarea will remove this
        displayEl.classList.add('postit-display--interactive');

        const textarea = document.createElement('textarea');
        textarea.className   = 'postit-textarea';
        textarea.value       = state.content ?? '';

        body.appendChild(displayEl);
        body.appendChild(textarea);
        el.appendChild(header);
        el.appendChild(body);
        document.body.appendChild(el);

        if (state.minimized) el.classList.add('postit-note--minimized');

        const noteData = { state, el, ro: null, removing: false };
        this._notes.set(state.id, noteData);

        // ── Event wiring ─────────────────────────────────────────────────────

        el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });

        // Prevent drag on interactive children
        for (const child of [minimizeBtn, closeBtn, titleDisplay, titleEdit, textarea]) {
            child.addEventListener('pointerdown', (e) => e.stopPropagation());
        }

        minimizeBtn.addEventListener('click', () => this._toggleMinimize(state.id));
        closeBtn.addEventListener('click',    () => this._removeNote(state.id));

        // Title: click to edit
        titleDisplay.addEventListener('click', () => {
            titleDisplay.style.display = 'none';
            titleEdit.style.display    = '';
            titleEdit.value            = state.title || DEFAULT_TITLE;
            titleEdit.focus();
            titleEdit.select();
        });

        const commitTitle = () => {
            const val = (titleEdit.value.trim().replace(/\n/g, ' ')) || DEFAULT_TITLE;
            state.title              = val;
            titleDisplay.textContent = val;
            titleDisplay.title       = val;
            titleEdit.style.display    = 'none';
            titleDisplay.style.display = '';
            this._save();
        };
        titleEdit.addEventListener('blur',    commitTitle);
        titleEdit.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTitle(); }
            if (e.key === 'Escape') { titleEdit.style.display = 'none'; titleDisplay.style.display = ''; }
            e.stopPropagation();
        });

        // Ghost-textarea pattern: textarea and displayEl are always both visible.
        // displayEl renders HTML (with clickable links) behind the transparent textarea.
        // Clicking displayEl focuses textarea; textarea focus/blur toggles link interactivity.

        displayEl.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return; // let link open
            if (state.minimized) return;
            textarea.focus();
        });

        textarea.addEventListener('focus', () => {
            displayEl.classList.remove('postit-display--interactive');
        });
        textarea.addEventListener('blur', () => {
            state.content = textarea.value;
            this._save();
            displayEl.classList.add('postit-display--interactive');
        });
        textarea.addEventListener('scroll', () => {
            displayEl.scrollTop = textarea.scrollTop;
        });
        textarea.addEventListener('input', () => {
            state.content = textarea.value;
            this._save();
            _updateDisplayEl(displayEl, state.content);
        });

        this._initDrag(header, state);
        this._initResize(el, state, noteData);
    }

    _initDrag(handle, state) {
        let dragStartX, dragStartY, elStartLeft, elStartTop;

        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            const noteEl = this._notes.get(state.id)?.el;
            dragStartX  = e.clientX;
            dragStartY  = e.clientY;
            elStartLeft = parseInt(noteEl?.style.left, 10) || 0;
            elStartTop  = parseInt(noteEl?.style.top,  10) || 0;
        });

        handle.addEventListener('pointermove', (e) => {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            const noteEl = this._notes.get(state.id)?.el;
            if (!noteEl) return;
            const topBarBottom = this._topBarBottom();
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const newLeft = Math.max(0, Math.min(window.innerWidth  - noteEl.offsetWidth,  elStartLeft + dx));
            const newTop  = Math.max(topBarBottom, Math.min(window.innerHeight - noteEl.offsetHeight, elStartTop + dy));
            noteEl.style.left = `${newLeft}px`;
            noteEl.style.top  = `${newTop}px`;
            state.x = newLeft;
            state.y = newTop;
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

    _initResize(el, state, noteData) {
        const ro = new ResizeObserver(() => {
            if (!el.isConnected || state.minimized) return;
            state.width  = el.offsetWidth;
            state.height = el.offsetHeight;
            this._save();
        });
        ro.observe(el);
        noteData.ro = ro;
    }

    _toggleMinimize(id) {
        const noteData = this._notes.get(id);
        if (!noteData) return;
        const { state, el } = noteData;
        const nowMinimized = !state.minimized;
        state.minimized = nowMinimized;

        const btn = el.querySelector('.postit-minimize');
        const label = nowMinimized ? 'Restore post-it' : 'Minimize post-it';
        btn.textContent = nowMinimized ? '□' : '−';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title',      label);

        if (nowMinimized) {
            // Commit latest textarea value before collapsing
            const ta = el.querySelector('.postit-textarea');
            if (ta) { state.content = ta.value; this._save(); }
            el.classList.add('postit-note--minimized');
            requestAnimationFrame(() => this._adjustForLegendOverlap(id));
        } else {
            el.classList.remove('postit-note--minimized');
            el.style.height = `${state.height}px`;
        }
        this._save();
    }

    _adjustForLegendOverlap(id) {
        const noteData = this._notes.get(id);
        if (!noteData) return;
        const { el, state } = noteData;
        const legend = document.querySelector('#legend, #legend-root');
        if (!legend) return;
        const lr = legend.getBoundingClientRect();
        const pr = el.getBoundingClientRect();
        if (pr.right <= lr.left || pr.left >= lr.right || pr.bottom <= lr.top || pr.top >= lr.bottom) return;

        const topBarBottom = this._topBarBottom();
        const w = pr.width, h = pr.height;
        const candidates = [
            { x: pr.left,       y: lr.bottom + 8   },
            { x: pr.left,       y: lr.top - h - 8  },
            { x: lr.right + 8,  y: pr.top           },
            { x: lr.left - w - 8, y: pr.top         },
        ];
        for (const { x, y } of candidates) {
            if (x >= 0 && y >= topBarBottom && x + w <= window.innerWidth && y + h <= window.innerHeight) {
                el.style.left = `${x}px`; el.style.top = `${y}px`;
                state.x = x; state.y = y;
                this._save(); return;
            }
        }
        const fx = 16, fy = topBarBottom + 8;
        el.style.left = `${fx}px`; el.style.top = `${fy}px`;
        state.x = fx; state.y = fy;
        this._save();
    }

    _showContextMenu(x, y) {
        document.querySelector('.postit-context-menu')?.remove();

        const menu = document.createElement('div');
        menu.className  = 'postit-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top  = `${y}px`;

        const btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.innerHTML = '&#128203; Add a post-it';
        btn.addEventListener('click', () => { menu.remove(); this.create(x, y); });
        menu.appendChild(btn);

        menu.addEventListener('contextmenu', (e) => e.preventDefault());
        document.body.appendChild(menu);

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

    async _removeNote(id) {
        const noteData = this._notes.get(id);
        if (!noteData || noteData.removing) return;
        noteData.removing = true;

        const result = await createModal({
            title: 'Delete post-it?',
            html:  'This note will be permanently deleted and cannot be recovered.',
            buttons: [
                { id: 'cancel', label: 'Cancel' },
                { id: 'delete', label: 'Delete', primary: true },
            ],
        });
        noteData.removing = false;
        if (result !== 'delete') return;

        noteData.ro?.disconnect();
        noteData.ro = null;
        noteData.el?.remove();
        this._notes.delete(id);
        this._save();
    }
}
