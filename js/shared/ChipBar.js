/**
 * ChipBar — renders active search terms as closeable chips inside the search field.
 * Supports both single key:value and compound queries (clause1 & clause2 & …).
 *
 * Usage:
 *   const bar = new ChipBar(fieldEl, inputEl, onUpdate);
 *   bar.render(currentSearchTerm, parseActiveKV, buildKV, normalize, parseClauses);
 *
 * parseClauses(term) → [{key, values, quoted, isNegation, raw}] | null
 * parseActiveKV(term) → {key, values, quoted} | null   (single-clause fallback)
 */
export class ChipBar {
    constructor(fieldEl, inputEl, onUpdate) {
        this._field = fieldEl;
        this._input = inputEl;
        this._onUpdate = onUpdate;
        this._lastArgs = null;

        fieldEl.addEventListener('click', (e) => {
            if (e.target.closest('.search-chip-close')) return;
            if (this._input.style.display === 'none') this._showInput();
        });

        // Restore chip view when focus leaves the input without submitting.
        // Deferred so that a simultaneous click on the "go" button or a chip-close
        // can complete first (they call render() and hide the input before the
        // setTimeout fires, making the condition below false).
        inputEl.addEventListener('blur', () => {
            setTimeout(() => {
                if (this._input.style.display !== 'none' && this._lastArgs?.searchTerm) {
                    const { searchTerm, parseActiveKV, buildKV, normalize, parseClauses } = this._lastArgs;
                    this._input.value = searchTerm;
                    this.render(searchTerm, parseActiveKV, buildKV, normalize, parseClauses);
                }
            }, 0);
        });
    }

    render(searchTerm, parseActiveKV, buildKV, normalize, parseClauses) {
        this._lastArgs = { searchTerm, parseActiveKV, buildKV, normalize, parseClauses };
        this._clearChips();
        if (!searchTerm) {
            this._showInput();
            return;
        }

        const clauses = parseClauses ? parseClauses(searchTerm) : null;

        if (clauses && clauses.length > 1) {
            // Compound query: one group of chips per clause, separated by " & "
            clauses.forEach((clause, idx) => {
                if (idx > 0) this._addSeparator();
                this._renderClause(clause, clauses, idx, buildKV, normalize);
            });
        } else {
            // Single clause or plain text
            const parsed = parseActiveKV(searchTerm);
            if (!parsed) {
                this._addChip(searchTerm, () => this._onUpdate(''));
            } else {
                this._addKeyLabel(parsed.key);
                parsed.values.forEach(v => {
                    this._addChip(v, () => {
                        const rest = parsed.values.filter(x => normalize(x) !== normalize(v));
                        this._onUpdate(rest.length ? buildKV(parsed.key, rest, parsed.quoted) : '');
                    });
                });
            }
        }

        this._input.style.display = 'none';
        this._updateOverflow();
    }

    _updateOverflow() {
        // Remove any existing overflow pill first
        this._field.querySelectorAll('.search-chip-overflow').forEach(el => el.remove());

        // Make all chips visible so we can measure them
        const chips = Array.from(this._field.querySelectorAll(
            '.search-chip, .search-chip-key, .search-chip-sep'
        ));
        chips.forEach(c => (c.style.display = ''));

        if (!chips.length) return;

        // One rAF so the browser has laid out the visible chips
        requestAnimationFrame(() => {
            const maxRight = this._field.getBoundingClientRect().right;
            let hidden = 0;
            let firstHiddenEl = null;

            for (const chip of chips) {
                const r = chip.getBoundingClientRect();
                if (r.right > maxRight) {
                    chip.style.display = 'none';
                    if (hidden === 0) firstHiddenEl = chip;
                    hidden++;
                }
            }

            if (!hidden) return;

            // Make room for the pill: keep hiding chips from the end until the
            // pill would fit, or we've hidden everything
            const pill = document.createElement('span');
            pill.className = 'search-chip-overflow';
            pill.textContent = `+${hidden}`;
            pill.addEventListener('click', (e) => { e.stopPropagation(); this._showInput(); });
            this._field.insertBefore(pill, this._input);

            // If the pill itself overflows, hide one more chip from the visible set
            requestAnimationFrame(() => {
                const pillR = pill.getBoundingClientRect();
                if (pillR.right > maxRight) {
                    // Find last visible chip and hide it
                    const visible = Array.from(this._field.querySelectorAll(
                        '.search-chip:not([style*="display: none"]), .search-chip-key:not([style*="display: none"]), .search-chip-sep:not([style*="display: none"])'
                    ));
                    if (visible.length) {
                        visible[visible.length - 1].style.display = 'none';
                        hidden++;
                        pill.textContent = `+${hidden}`;
                    }
                }
            });
        });
    }

    // ─── Internals ─────────────────────────────────────────────────────────────

    _renderClause(clause, allClauses, clauseIdx, buildKV, normalize) {
        this._addKeyLabel(clause.key);
        if (clause.values.length === 0) {
            // Empty-value clause (e.g. negation with no value): show key as a single chip
            this._addChip('', () => {
                const newClauses = allClauses.filter((_, i) => i !== clauseIdx);
                this._onUpdate(this._joinClauses(newClauses, buildKV));
            });
        } else {
            clause.values.forEach(v => {
                this._addChip(v, () => {
                    const rest = clause.values.filter(x => normalize(x) !== normalize(v));
                    const newClauses = allClauses.map((c, i) => {
                        if (i !== clauseIdx) return c;
                        return { ...c, values: rest };
                    }).filter(c => c.values.length > 0);
                    this._onUpdate(this._joinClauses(newClauses, buildKV));
                });
            });
        }
    }

    _joinClauses(clauses, buildKV) {
        return clauses.map(c => buildKV(c.key, c.values, c.quoted)).filter(Boolean).join(' & ');
    }

    _showInput() {
        this._clearChips();
        this._input.style.display = '';
        this._input.focus();
        // Trigger autocomplete suggestions immediately on reveal.
        this._input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _clearChips() {
        this._field.querySelectorAll('.search-chip, .search-chip-key, .search-chip-sep').forEach(el => el.remove());
        this._input.style.display = '';
    }

    _addKeyLabel(key) {
        const span = document.createElement('span');
        span.className = 'search-chip-key';
        span.textContent = key;
        this._field.insertBefore(span, this._input);
    }

    _addSeparator() {
        const span = document.createElement('span');
        span.className = 'search-chip-sep';
        span.textContent = '&';
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
