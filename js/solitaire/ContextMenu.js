export class ContextMenu {
    constructor(app) {
        this.app = app;
        this.menuEl = null;
        this.marqueeEl = null;
    }

    ensureMarquee() {
        if (this.marqueeEl) return this.marqueeEl;
        this.marqueeEl = document.createElement('div');
        this.marqueeEl.id = 'multi-select-marquee';
        this.marqueeEl.style.display = 'none';
        document.body.appendChild(this.marqueeEl);
        return this.marqueeEl;
    }

    hideMarquee() {
        const el = this.ensureMarquee();
        el.style.display = 'none';
    }

    ensureMenu() {
        if (this.menuEl) return this.menuEl;

        this.menuEl = document.createElement('div');
        this.menuEl.id = 'canvas-context-menu';
        this.menuEl.innerHTML = `
  <button data-mode="free-pan">🖐 Free pan (default)</button>
  <hr/>
  <button data-mode="contextual-drag">🔗 Contextual drag</button>
  <button data-mode="drag">✋ Drag</button>
  <button data-mode="select">⬚ Multiple select</button>
  <hr data-advanced/>
  <button data-action="save" data-advanced>💾 Save scenario</button>
  <button data-action="import" data-advanced>📥 Import scenario</button>
  <button data-action="export" data-advanced>📤 Export scenario</button>
  <button data-action="reset" data-advanced>♻ Reset scenario</button>
  <hr/>
  <button data-action="postit">📝 Add a post-it</button>
`;
        document.body.appendChild(this.menuEl);

        this.menuEl.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.mode) {
                this.app.interaction.setMode(btn.dataset.mode);
                this.hide();
                return;
            }

            if (btn.dataset.action) {
                this.hide();
                if (btn.dataset.action === 'postit') {
                    this.app.postIt.create(this._menuX, this._menuY);
                    return;
                }
                this.app.scenario.handleAction(btn.dataset.action).then(() => {});
            }
        });

        this.menuEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('pointerdown', (e) => {
            if (this.menuEl && this.menuEl.contains(e.target)) return;
            this.hide();
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });

        this.menuEl.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        return this.menuEl;
    }

    show(x, y) {
        this._menuX = x;
        this._menuY = y;
        const m = this.ensureMenu();
        m.style.left = `${x}px`;
        m.style.top = `${y}px`;
        m.classList.add('visible');
        m.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === this.app.interaction.mode));
        m.querySelectorAll('[data-advanced]').forEach(el => {
            el.style.display = this.app.isAdvanced ? '' : 'none';
        });
        const postitBtn = m.querySelector('[data-action="postit"]');
        if (postitBtn) {
            postitBtn.disabled = this.app.postIt?.isActive() ?? false;
            postitBtn.title = postitBtn.disabled ? 'A post-it note is already open' : '';
        }
    }

    hide() {
        if (!this.menuEl) return;
        this.menuEl.classList.remove('visible');
    }
}
