import { splitValues, setSearchQuery, normalizeForCompare, parseActiveKeyValueSearch, buildKeyValueSearch } from '../shared/utils.js';
import { ChipBar } from '../shared/ChipBar.js';

const DEFAULT_SEARCH_KEY = 'id';
const LS_RELAXED_SEARCH = 'solitaire_relaxed_search';

export class SearchEngine {
    constructor(app) {
        this.app = app;
        this.searchTerm = '';
        this.hideStoppedServices = true;
        this.currentSearchedNodes = new Set();
        this.currentNodes = [];
        this._chipBar = null;
    }

    // Kept as instance method for callers that use search.normalizeForCompare(...)
    normalizeForCompare(v) {
        return normalizeForCompare(v);
    }

    // Kept as instance methods so DetailDrawer / GraphRenderer can call search.parseActiveKeyValueSearch(...)
    parseActiveKeyValueSearch(term) {
        return parseActiveKeyValueSearch(term);
    }

    buildKeyValueSearch(key, values, quoted) {
        return buildKeyValueSearch(key, values, quoted);
    }

    // ─── Chip bar ─────────────────────────────────────────────────────────────

    initChipBar() {
        const field = document.getElementById('search-field');
        const input = document.getElementById('drawer-search-input');
        if (!field || !input) return;
        this._chipBar = new ChipBar(field, input, (term) => this.updateSearchAndRefresh(term));
    }

    _refreshChips() {
        this._chipBar?.render(
            this.searchTerm,
            parseActiveKeyValueSearch,
            buildKeyValueSearch,
            normalizeForCompare
        );
    }

    // ─── Matching ─────────────────────────────────────────────────────────────

    getTermToCompare(term) {
        return term.replaceAll('\n', '').replaceAll(' ', '').toLowerCase();
    }

    isSearchResultWithKeyValue(node) {
        if (!this.searchTerm.includes(':')) return false;
        const isNegation = this.searchTerm.trim().startsWith('!');
        const term = isNegation ? this.searchTerm.trim().slice(1) : this.searchTerm.trim();
        const isAccurateSearch = term.includes('"');
        const termClean = isAccurateSearch ? term.replaceAll('"', '') : term;
        const parts = termClean.split(':');
        if (parts.length !== 2) return false;
        const key = parts[0];
        if (!Object.keys(node).includes(key)) return false;
        const rawValue = parts[1].trim();
        if (isNegation && rawValue === '') return (node[key] ?? '').trim() !== '';
        const expectedValues = splitValues(rawValue).map(v => this.getTermToCompare(v));
        const nodeParts = splitValues(node[key] ?? '');
        const matches = expectedValues.some(ev =>
            nodeParts.some(p =>
                isAccurateSearch
                    ? this.getTermToCompare(p) === ev
                    : this.getTermToCompare(p).includes(ev)
            )
        );
        return isNegation ? !matches : matches;
    }

    isSearchResultValueOnly(d) {
        if (this.searchTerm === '' || this.searchTerm.includes(':')) return false;
        const terms = this.searchTerm.toLowerCase().split(',').map(t => t.trim());
        return Object.values(d).some(value =>
            typeof value === 'string' && terms.some(t => value.toLowerCase().includes(t))
        );
    }

    prepareSearchTerm() {
        const relaxed = document.getElementById('relaxed-search');
        const relaxedEnabled = relaxed?.checked ?? false;
        if (this.searchTerm !== '' && !this.searchTerm.includes(':') && !this.searchTerm.includes(',') && !relaxedEnabled) {
            this.searchTerm = `${DEFAULT_SEARCH_KEY}:"${this.searchTerm}"`;
            const input = document.getElementById('drawer-search-input');
            if (input) input.value = this.searchTerm;
            setSearchQuery(this.searchTerm);
        }
    }

    updateSearchAndRefresh(q) {
        this.searchTerm = q || '';
        const input = document.getElementById('drawer-search-input');
        if (input) input.value = this.searchTerm;
        setSearchQuery(this.searchTerm);
        this.app.graph.updateVisualization(true);
        if (this.app.graph.clickedNode) {
            this.app.drawer.showNodeDetails(this.app.graph.clickedNode, true);
        }
        this._refreshChips();
    }

    handleQuery(q, showDrawer = true) {
        this.app.graph.clickedNode = null;
        this.searchTerm = q;
        const input = document.getElementById('drawer-search-input');
        if (input) input.value = q;
        setSearchQuery(q);
        this.app.graph.updateVisualization(showDrawer);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this._refreshChips();
    }

    initRelaxedSearchPersistence() {
        const relaxed = document.getElementById('relaxed-search');
        if (!relaxed) return;
        const saved = localStorage.getItem(LS_RELAXED_SEARCH);
        if (saved !== null) relaxed.checked = saved === '1' || saved === 'true';
        if (!relaxed.dataset.boundRelaxedPersist) {
            relaxed.dataset.boundRelaxedPersist = '1';
            relaxed.addEventListener('change', () => {
                localStorage.setItem(LS_RELAXED_SEARCH, relaxed.checked ? '1' : '0');
                this.app.graph.updateVisualization();
            });
        }
    }
}
