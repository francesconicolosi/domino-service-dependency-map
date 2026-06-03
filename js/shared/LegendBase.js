import { makeLegendDraggable } from './utils.js';

export class LegendBase {
    constructor() {
        this._dragAttached = false;
    }

    _getOrCreateRoot(id) {
        let root = document.getElementById(id);
        if (!root) {
            root = document.createElement('div');
            root.id = id;
            document.body.appendChild(root);
        }
        return root;
    }

    _buildShell(root, title) {
        this._dragAttached = false;
        root.className = 'legend legend--generic';
        root.innerHTML = `
  <div class="legend__header" aria-label="Legend header">
    <div class="legend__title" role="heading" aria-level="2"></div>
    <button class="legend__collapse" type="button" aria-label="Toggle legend" aria-expanded="true">
      <span class="chevron" aria-hidden="true"></span>
    </button>
  </div>
  <div class="legend__list" aria-label="Legend list"></div>
`;
        root.querySelector('.legend__title').textContent = title;
    }

    _wireCollapse(root, lsKey) {
        const list = root.querySelector('.legend__list');
        const btn  = root.querySelector('.legend__collapse');
        const applyCollapsed = (collapsed) => {
            root.classList.toggle('legend--collapsed', collapsed);
            list.hidden = collapsed;
            btn.setAttribute('aria-expanded', String(!collapsed));
            btn.setAttribute('aria-label', collapsed ? 'Expand legend' : 'Collapse legend');
            try { localStorage.setItem(lsKey, collapsed ? '1' : '0'); } catch {}
        };
        let initial = false;
        try { initial = localStorage.getItem(lsKey) === '1'; } catch {}
        applyCollapsed(initial);
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            applyCollapsed(!root.classList.contains('legend--collapsed'));
        });
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        return { list, btn };
    }

    _wireListEvents(list, activateFn) {
        list.addEventListener('click', (e) => {
            const el = e.target.closest('.legend__item');
            if (!el) return;
            activateFn(el);
        });
        list.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const el = e.target.closest('.legend__item');
            if (!el) return;
            e.preventDefault();
            activateFn(el);
        });
    }

    _enableDrag(root, opts = {}) {
        if (!root || this._dragAttached) return;
        this._dragAttached = true;
        makeLegendDraggable(root, opts);
    }
}
