/**
 * ChipBar — renders active search terms as closeable chips inside the search field.
 * Shared by Domino and Solitaire.
 *
 * Usage:
 *   const bar = new ChipBar(fieldEl, inputEl, (newTerm) => search.updateSearchAndRefresh(newTerm));
 *   bar.render(currentSearchTerm, parseActiveKeyValueSearch, buildKeyValueSearch, normalizeForCompare);
 */
export class ChipBar {
    constructor(fieldEl, inputEl, onUpdate) {
        this._field = fieldEl;
        this._input = inputEl;
        this._onUpdate = onUpdate;

        // Clicking the chip area (but not a close ×) restores the text input for editing
        fieldEl.addEventListener('click', (e) => {
            if (e.target.closest('.search-chip-close')) return;
            if (this._input.style.display === 'none') this._showInput();
        });
    }

    /**
     * @param {string}   searchTerm  - current raw search string
     * @param {Function} parse       - parseActiveKeyValueSearch(term) → {key, values, quoted} | null
     * @param {Function} build       - buildKeyValueSearch(key, values, quoted) → string
     * @param {Function} normalize   - normalizeForCompare(v) → string (for deduplication)
     */
    render(searchTerm, parse, build, normalize) {
        this._clearChips();
        if (!searchTerm) {
            this._showInput();
            return;
        }

        const parsed = parse(searchTerm);
        if (!parsed) {
            // plain free-text → single dismissible chip
            this._addChip(searchTerm, () => this._onUpdate(''));
        } else {
            this._addKeyLabel(parsed.key);
            parsed.values.forEach(v => {
                this._addChip(v, () => {
                    const rest = parsed.values.filter(x => normalize(x) !== normalize(v));
                    this._onUpdate(rest.length ? build(parsed.key, rest, parsed.quoted) : '');
                });
            });
        }

        this._input.style.display = 'none';
    }

    // ─── Internals ─────────────────────────────────────────────────────────────

    _showInput() {
        this._clearChips();
        this._input.style.display = '';
        this._input.focus();
    }

    _clearChips() {
        this._field.querySelectorAll('.search-chip, .search-chip-key').forEach(el => el.remove());
        this._input.style.display = '';
    }

    _addKeyLabel(key) {
        const span = document.createElement('span');
        span.className = 'search-chip-key';
        span.textContent = key;
        this._field.insertBefore(span, this._input);
    }

    _addChip(value, onClose) {
        const chip = document.createElement('span');
        chip.className = 'search-chip';

        const text = document.createElement('span');
        text.className = 'search-chip-text';
        text.textContent = value;

        const x = document.createElement('span');
        x.className = 'search-chip-close';
        x.textContent = '×';
        x.setAttribute('aria-label', `Remove ${value}`);
        x.addEventListener('click', (e) => { e.stopPropagation(); onClose(); });

        chip.append(text, x);
        this._field.insertBefore(chip, this._input);
    }
}
