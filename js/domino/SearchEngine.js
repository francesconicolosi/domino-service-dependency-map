import { splitValues, setSearchQuery } from '../shared/utils.js';

const DEFAULT_SEARCH_KEY = 'id';
const LS_RELAXED_SEARCH = 'solitaire_relaxed_search';

export class SearchEngine {
    constructor(app) {
        this.app = app;
        this.searchTerm = '';
        this.hideStoppedServices = true;
        this.currentSearchedNodes = new Set();
        this.currentNodes = [];
    }

    getTermToCompare(term) {
        return term.replaceAll('\n', '').replaceAll(' ', '').toLowerCase();
    }

    normalizeForCompare(v) {
        return (v ?? '').toString().replaceAll('\n', '').replaceAll(' ', '').toLowerCase();
    }

    parseActiveKeyValueSearch(term) {
        if (!term || !term.includes(':')) return null;
        const raw = term.trim();
        if (raw.startsWith('!')) return null;
        const idx = raw.indexOf(':');
        const key = raw.slice(0, idx).trim();
        const valuePart = raw.slice(idx + 1).trim();
        const quoted = valuePart.includes('"');
        const clean = valuePart.replaceAll('"', '');
        const values = splitValues(clean).map(v => v.trim()).filter(Boolean);
        return { key, values, quoted };
    }

    buildKeyValueSearch(key, values, quoted) {
        if (!key || !values || !values.length) return '';
        const body = quoted ? values.map(v => `"${v}"`).join(',') : values.join(',');
        return `${key}:${body}`;
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
    }

    handleQuery(q, showDrawer = true) {
        this.app.graph.clickedNode = null;
        this.searchTerm = q;
        const input = document.getElementById('drawer-search-input');
        if (input) input.value = q;
        setSearchQuery(q);
        this.app.graph.updateVisualization(showDrawer);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
