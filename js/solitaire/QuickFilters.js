import { splitValues } from '../shared/utils.js';

const LS_KEY_FILTERS  = 'dsm-quick-filters-v1';
const LS_KEY_CHIPS_VISIBLE = 'dsm-quick-filters-chips-v1';

export class QuickFilters {
    constructor(app) {
        this.app = app;
        this.filters = [];
        this.activeFilters = new Set();
        this.builtinFilters = [
            { key: 'communities-only', name: 'Communities' },
            { key: 'teams-only',       name: 'Teams'       },
        ];
        this.activeBuiltin = new Set();
        this.chipsVisible = localStorage.getItem(LS_KEY_CHIPS_VISIBLE) !== 'false'; // default true
        this.LS_KEY = LS_KEY_FILTERS;
        this.URL_PARAM = 'filter';
        this._dropdownOpen = false;
    }

    // Back-compat single-value getter used by tests
    get activeFilter() {
        return this.activeFilters.size > 0 ? [...this.activeFilters][0] : null;
    }
    set activeFilter(v) {
        this.activeFilters = v ? new Set([v]) : new Set();
    }

    load(csvText) {
        if (!csvText || !csvText.trim()) return;

        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim());
        const idxKey           = headers.indexOf('Key');
        const idxName          = headers.indexOf('Name');
        const idxDesc          = headers.indexOf('Description');
        const idxVisStreams     = headers.indexOf('Visible Streams');
        const idxVisThemes      = headers.indexOf('Visible Themes');
        const idxVisTeams       = headers.indexOf('Visible Teams');
        const idxVisPeople      = headers.indexOf('Visible People');
        const idxHidStreams     = headers.indexOf('Hidden Streams');
        const idxHidThemes      = headers.indexOf('Hidden Themes');
        const idxHidTeams       = headers.indexOf('Hidden Teams');
        const idxHidPeople      = headers.indexOf('Hidden People');

        this.filters = [];
        for (let i = 1; i < lines.length; i++) {
            const row = this._splitCsvRow(lines[i]);
            const name = (row[idxName] || '').trim();
            if (!name) continue;

            const toSet = (idx) => {
                if (idx === -1) return null;
                const raw = (row[idx] || '').trim();
                if (!raw) return null;
                const vals = splitValues(raw).map(v => v.trim()).filter(Boolean);
                return vals.length ? new Set(vals) : null;
            };

            this.filters.push({
                key:           (row[idxKey] || '').trim() || null,
                name,
                description:   (row[idxDesc] || '').trim(),
                visibleStreams: toSet(idxVisStreams),
                visibleThemes:  toSet(idxVisThemes),
                visibleTeams:   toSet(idxVisTeams),
                visiblePeople:  toSet(idxVisPeople),
                hiddenStreams:  toSet(idxHidStreams),
                hiddenThemes:   toSet(idxHidThemes),
                hiddenTeams:    toSet(idxHidTeams),
                hiddenPeople:   toSet(idxHidPeople),
            });
        }

        this._restore();
    }

    getConstraints() {
        const communityFilter = this.activeBuiltin.has('communities-only') ? 'communities-only'
                              : this.activeBuiltin.has('teams-only')       ? 'teams-only'
                              : null;

        if (this.activeFilters.size === 0 && !communityFilter) return null;

        // Visible (whitelist) axes: intersection across filters (null = no constraint from that filter)
        // Hidden (blacklist) axes: union across filters
        let visStreams = null, visThemes = null, visTeams = null, visPeople = null;
        let hidStreams = null, hidThemes = null, hidTeams = null, hidPeople = null;
        let hasAny = false;

        const intersect = (existing, incoming) => {
            if (!incoming) return existing; // no constraint from this filter → keep existing
            if (!existing) return new Set(incoming); // first constraint
            return new Set([...existing].filter(v => incoming.has(v)));
        };
        const union = (existing, incoming) => {
            if (!incoming) return existing;
            if (!existing) return new Set(incoming);
            return new Set([...existing, ...incoming]);
        };

        for (const name of this.activeFilters) {
            const f = this.filters.find(fl => fl.name === name);
            if (!f) continue;
            visStreams = intersect(visStreams, f.visibleStreams);
            visThemes  = intersect(visThemes,  f.visibleThemes);
            visTeams   = intersect(visTeams,   f.visibleTeams);
            visPeople  = intersect(visPeople,  f.visiblePeople);
            hidStreams  = union(hidStreams,  f.hiddenStreams);
            hidThemes   = union(hidThemes,   f.hiddenThemes);
            hidTeams    = union(hidTeams,    f.hiddenTeams);
            hidPeople   = union(hidPeople,   f.hiddenPeople);
            hasAny = true;
        }

        if (!hasAny && !communityFilter) return null;
        if (!hasAny && !visStreams && !visThemes && !visTeams && !visPeople &&
            !hidStreams && !hidThemes && !hidTeams && !hidPeople && !communityFilter) return null;

        return {
            visibleStreams: visStreams, visibleThemes: visThemes,
            visibleTeams: visTeams,    visiblePeople: visPeople,
            hiddenStreams: hidStreams,  hiddenThemes: hidThemes,
            hiddenTeams: hidTeams,     hiddenPeople: hidPeople,
            communityFilter,
        };
    }

    toggle(name) {
        if (this.activeFilters.has(name)) {
            this.activeFilters.delete(name);
        } else {
            this.activeFilters.add(name);
        }
        this._persist();
        // keep dropdown open so the user can select multiple filters in one session
        this.render();
        this.app.loadAndRender(this.app.db.cachedCsvText);
    }

    _toggleBuiltin(key) {
        if (this.activeBuiltin.has(key)) {
            this.activeBuiltin.delete(key);
        } else {
            // mutually exclusive: clear the other before adding
            this.activeBuiltin.clear();
            this.activeBuiltin.add(key);
        }
        this.render();
        this.app.loadAndRender(this.app.db.cachedCsvText);
    }

    clearAll() {
        this.activeFilters.clear();
        this.activeBuiltin.clear();
        this._persist();
        this.render();
        this.app.loadAndRender(this.app.db.cachedCsvText);
    }

    setChipsVisible(visible) {
        this.chipsVisible = visible;
        localStorage.setItem(LS_KEY_CHIPS_VISIBLE, String(visible));
        const row = document.getElementById('quick-filters-bar');
        if (row) row.style.display = visible ? '' : 'none';
    }

    _persist() {
        localStorage.setItem(this.LS_KEY, [...this.activeFilters].join(','));
        this._updateUrlParam();
    }

    _updateUrlParam() {
        const params = new URLSearchParams(window.location.search);
        const keys = [...this.activeFilters]
            .map(name => this.filters.find(f => f.name === name)?.key)
            .filter(Boolean);
        if (keys.length) {
            params.set(this.URL_PARAM, keys.join(','));
        } else {
            params.delete(this.URL_PARAM);
        }
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }

    _restore() {
        const saved = localStorage.getItem(this.LS_KEY) || '';
        const savedNames = saved.split(',').map(s => s.trim()).filter(Boolean);
        const validNames = savedNames.filter(n => this.filters.some(f => f.name === n));
        if (validNames.length) { this.activeFilters = new Set(validNames); return; }

        const params = new URLSearchParams(window.location.search);
        const urlKeys = (params.get(this.URL_PARAM) || '').split(',').map(s => s.trim()).filter(Boolean);
        if (urlKeys.length) {
            const matches = this.filters.filter(f => f.key && urlKeys.includes(f.key)).map(f => f.name);
            if (matches.length) { this.activeFilters = new Set(matches); return; }
        }
        this.activeFilters = new Set();
    }

    render() {
        this._renderBtn();
        this._renderChips();
    }

    _renderBtn() {
        const slot = document.getElementById('qf-filters-btn-slot');
        if (!slot) return;
        slot.innerHTML = '';

        if (!this.filters.length && !this.builtinFilters.length) return;

        const activeCount = this.activeFilters.size + this.activeBuiltin.size;

        const wrap = document.createElement('div');
        wrap.className = 'qf-dropdown-wrap';

        // ── Filters button ─────────────────────────────────────────────────────
        const btn = document.createElement('button');
        btn.id = 'qf-dropdown-btn';
        btn.className = 'qf-dropdown-btn';
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', String(this._dropdownOpen));
        btn.innerHTML = `⚙ <span class="qf-dropdown-btn__label">Filters${activeCount > 0 ? ` (${activeCount})` : ''}</span> <span class="qf-dropdown-btn__caret">${this._dropdownOpen ? '▲' : '▼'}</span>`;
        wrap.appendChild(btn);

        // ── Dropdown menu ──────────────────────────────────────────────────────
        const menu = document.createElement('div');
        menu.id = 'qf-dropdown-menu';
        menu.className = 'qf-dropdown-menu';
        menu.style.display = this._dropdownOpen ? 'block' : 'none';

        // — Show quick filters toggle —
        const toggleRow = document.createElement('label');
        toggleRow.className = 'qf-dropdown-header-item qf-dropdown-toggle-row';
        toggleRow.setAttribute('for', 'qf-chips-toggle');
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = 'qf-chips-toggle';
        toggleInput.className = 'qf-chips-toggle';
        toggleInput.checked = this.chipsVisible;
        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'qf-toggle-switch';
        const toggleText = document.createElement('span');
        toggleText.className = 'qf-toggle-label';
        toggleText.textContent = 'Show in toolbar';
        toggleRow.append(toggleInput, toggleLabel, toggleText);
        menu.appendChild(toggleRow);

        // — Clear all (only when filters active) —
        if (this.activeFilters.size > 0) {
            const clearRow = document.createElement('button');
            clearRow.className = 'qf-dropdown-header-item qf-dropdown-clear';
            clearRow.textContent = 'Clear all';
            menu.appendChild(clearRow);
        }

        // — Divider —
        const divider = document.createElement('div');
        divider.className = 'qf-dropdown-divider';
        menu.appendChild(divider);

        // — Filter items (from CSV) —
        for (const filter of this.filters) {
            const isActive = this.activeFilters.has(filter.name);
            const item = document.createElement('div');
            item.className = 'qf-dropdown-item';
            if (isActive) item.classList.add('qf-dropdown-item--active');
            item.setAttribute('data-filter-name', filter.name);
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(isActive));
            if (filter.description) item.setAttribute('data-tooltip', filter.description);

            const check = document.createElement('span');
            check.className = 'qf-checkmark';
            check.textContent = isActive ? '✓' : '';

            const label = document.createElement('span');
            label.textContent = filter.name;

            item.append(check, label);
            menu.appendChild(item);
        }

        // — Builtin filters (Communities / Teams) —
        if (this.builtinFilters.length) {
            if (this.filters.length) {
                const builtinDivider = document.createElement('div');
                builtinDivider.className = 'qf-dropdown-divider';
                menu.appendChild(builtinDivider);
            }

            for (const bf of this.builtinFilters) {
                const isActive = this.activeBuiltin.has(bf.key);
                const item = document.createElement('div');
                item.className = 'qf-dropdown-item';
                if (isActive) item.classList.add('qf-dropdown-item--active');
                item.setAttribute('data-builtin-key', bf.key);
                item.setAttribute('role', 'radio');
                item.setAttribute('aria-checked', String(isActive));

                const check = document.createElement('span');
                check.className = 'qf-checkmark';
                check.textContent = isActive ? '●' : '○';

                const label = document.createElement('span');
                label.textContent = bf.name;

                item.append(check, label);
                menu.appendChild(item);
            }
        }

        wrap.appendChild(menu);
        slot.appendChild(wrap);
    }

    _renderChips() {
        const bar = document.getElementById('quick-filters-bar');
        if (!bar) return;
        bar.innerHTML = '';
        bar.style.display = this.chipsVisible ? '' : 'none';

        for (const name of this.activeFilters) {
            const filter = this.filters.find(f => f.name === name);
            const chip = document.createElement('button');
            chip.className = 'qf-chip qf-chip--active';
            chip.setAttribute('data-filter-name', name);
            chip.setAttribute('aria-label', `Remove filter: ${name}`);
            if (filter?.description) {
                chip.setAttribute('data-tooltip', filter.description);
                chip.setAttribute('data-tooltip-placement', 'bottom');
            }
            chip.innerHTML = `<span>${name}</span><span class="qf-chip__remove" aria-hidden="true">×</span>`;
            bar.appendChild(chip);
        }

        for (const key of this.activeBuiltin) {
            const bf = this.builtinFilters.find(f => f.key === key);
            if (!bf) continue;
            const chip = document.createElement('button');
            chip.className = 'qf-chip qf-chip--active';
            chip.setAttribute('data-builtin-key', key);
            chip.setAttribute('aria-label', `Remove filter: ${bf.name}`);
            chip.innerHTML = `<span>${bf.name}</span><span class="qf-chip__remove" aria-hidden="true">×</span>`;
            bar.appendChild(chip);
        }
    }

    initEvents() {
        // Delegate on the slot container for the Filters button + dropdown
        document.addEventListener('click', (e) => {
            const slot = document.getElementById('qf-filters-btn-slot');

            // Toggle dropdown
            if (e.target.closest('#qf-dropdown-btn')) {
                this._dropdownOpen = !this._dropdownOpen;
                const menu = document.getElementById('qf-dropdown-menu');
                const btn  = document.getElementById('qf-dropdown-btn');
                if (menu) menu.style.display = this._dropdownOpen ? 'block' : 'none';
                if (btn) {
                    btn.setAttribute('aria-expanded', String(this._dropdownOpen));
                    const caret = btn.querySelector('.qf-dropdown-btn__caret');
                    if (caret) caret.textContent = this._dropdownOpen ? '▲' : '▼';
                }
                return;
            }

            // Clear all (inside dropdown)
            if (e.target.closest('.qf-dropdown-clear')) {
                this.clearAll();
                return;
            }

            // Dropdown filter item
            const item = e.target.closest('.qf-dropdown-item');
            if (item) {
                const builtinKey = item.getAttribute('data-builtin-key');
                if (builtinKey) { this._toggleBuiltin(builtinKey); return; }
                const name = item.getAttribute('data-filter-name');
                if (name) this.toggle(name);
                return;
            }

            // Chip click (anywhere on chip = remove)
            const chip = e.target.closest('.qf-chip');
            if (chip) {
                const builtinKey = chip.getAttribute('data-builtin-key');
                if (builtinKey) { this._toggleBuiltin(builtinKey); return; }
                const name = chip.getAttribute('data-filter-name');
                if (name) this.toggle(name);
                return;
            }

            // Close dropdown on outside click
            if (this._dropdownOpen && slot && !slot.contains(e.target)) {
                this._dropdownOpen = false;
                const menu = document.getElementById('qf-dropdown-menu');
                const btn  = document.getElementById('qf-dropdown-btn');
                if (menu) menu.style.display = 'none';
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                    const caret = btn.querySelector('.qf-dropdown-btn__caret');
                    if (caret) caret.textContent = '▼';
                }
            }
        }, { capture: false });

        // Show quick filters toggle (change event on the checkbox)
        document.addEventListener('change', (e) => {
            if (e.target.id === 'qf-chips-toggle') {
                this.setChipsVisible(e.target.checked);
            }
        });
    }

    _splitCsvRow(line) {
        const result = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { result.push(field); field = ''; }
            else { field += ch; }
        }
        result.push(field);
        return result;
    }
}
