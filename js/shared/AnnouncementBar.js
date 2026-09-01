import '../../css/announcement-bar.css';
import { CHANGELOG } from './changelog.js';

const DISMISSED_KEY = 'dsm-announcement-dismissed-v1';

export class AnnouncementBar {
    constructor() {
        this._el = null;
        this._expanded = false;
    }

    init() {
        const latest = CHANGELOG[0];
        if (!latest) return;

        const dismissedId = localStorage.getItem(DISMISSED_KEY);
        if (dismissedId === latest.id) return;

        this._render(latest);
    }

    _render(entry) {
        const bar = document.createElement('div');
        bar.className = 'announcement-bar';
        bar.setAttribute('role', 'banner');
        bar.innerHTML = `
            <div class="announcement-bar__collapsed">
                <span class="announcement-bar__icon" aria-hidden="true">🚀</span>
                <span class="announcement-bar__title">What&#8217;s new: ${this._escape(entry.title)}</span>
                <button class="announcement-bar__toggle" aria-expanded="false">See all the changes ▾</button>
                <button class="announcement-bar__dismiss" title="Dismiss" aria-label="Dismiss announcement">✕</button>
            </div>
            <div class="announcement-bar__details" hidden>
                <ul>${entry.changes.map(c => `<li>${this._escape(c)}</li>`).join('')}</ul>
            </div>
        `;

        document.body.insertBefore(bar, document.body.firstChild);
        this._el = bar;
        this._updateHeightVar();

        bar.querySelector('.announcement-bar__toggle').addEventListener('click', () => this._toggle());
        bar.querySelector('.announcement-bar__dismiss').addEventListener('click', () => this._dismiss(entry.id));
    }

    _toggle() {
        this._expanded = !this._expanded;
        const details = this._el.querySelector('.announcement-bar__details');
        const btn = this._el.querySelector('.announcement-bar__toggle');
        details.hidden = !this._expanded;
        btn.setAttribute('aria-expanded', String(this._expanded));
        btn.innerHTML = this._expanded ? 'Collapse ▴' : 'See all the changes ▾';
        this._updateHeightVar();
    }

    _dismiss(id) {
        localStorage.setItem(DISMISSED_KEY, id);
        this._el.remove();
        this._el = null;
        document.documentElement.style.setProperty('--announcement-bar-height', '0px');
    }

    _updateHeightVar() {
        requestAnimationFrame(() => {
            if (!this._el) return;
            const h = this._el.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--announcement-bar-height', h + 'px');
        });
    }

    _escape(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
