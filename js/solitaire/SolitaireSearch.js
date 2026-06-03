import { normalizeWs, setSearchQuery, setQueryParam, removeQueryParam } from '../shared/utils.js';
import {
    applySearchDimmingForMatches,
    clearFieldHighlights,
    clearSearchDimming,
    highlightGroup as highlightGroupUtils,
} from './search.js';
import { getNameFromTitleEl } from './orgUtils.js';

const UNKNOWN_MATCHER = /^(unknown|n\/?a|not\s*(set|available)|-|—|none)$/i;

export class SolitaireSearch {
    constructor(app) {
        this.app = app;
        this.lastSearch = '';
        this.currentIndex = 0;
        // Collapsed-stream management for search
        this._savedCollapsedKeys = null;   // user's original collapsed state at search start
        this._allMatchDescs = null;        // descriptors for ALL matches across all streams
        this._currentVisibleStream = null; // which originally-collapsed stream is currently expanded
    }

    // ─── Descriptor helpers ───────────────────────────────────────────────────

    _matchDesc(el) {
        const isGroup = typeof el.matches === 'function' && el.matches('g[data-key]');
        const g = isGroup ? el : el.closest?.('g[data-key]');
        if (!g) return null;
        const groupKey = g.getAttribute('data-key');
        const parts = groupKey.split('::');
        if (parts.length < 2) return null;
        const streamKey = `stream::${parts[1]}`;
        const cls = isGroup ? null : (el.classList?.[0] ?? null);
        return { groupKey, selector: cls ? `.${cls}` : null, streamKey };
    }

    _elFromDesc({ groupKey, selector }) {
        const g = document.querySelector(`g[data-key="${groupKey}"]`);
        if (!g) return null;
        return selector ? (g.querySelector(selector) ?? g) : g;
    }

    // ─── Query helpers ────────────────────────────────────────────────────────

    _runQuery(q, missing, normalizedField) {
        const FIELD_SELECTORS = {
            role: '.role-field',
            company: '.company-field',
            location: '.location-field',
        };
        if (missing && normalizedField) {
            const attrName =
                normalizedField === 'role' ? 'data-role' :
                normalizedField === 'company' ? 'data-company' : 'data-location';
            return Array.from(document.querySelectorAll('g[data-key^="card::"]')).filter(n => {
                const norm = normalizeWs(n.getAttribute(attrName) || '').trim().toLowerCase();
                return !norm || UNKNOWN_MATCHER.test(norm);
            });
        }
        const sel = (normalizedField && FIELD_SELECTORS[normalizedField])
            || '.profile-name, .team-title, .theme-title, .stream-title, .role-field, .company-field, .location-field, [data-services]';
        return Array.from(document.querySelectorAll(sel)).filter(n => {
            const txt = (n.textContent || '').trim().toLowerCase();
            const attrMatch = (n.getAttribute?.('data-services') || '').toLowerCase().includes(q);
            return txt.includes(q) || attrMatch;
        });
    }

    // Temporarily expand all collapsed streams (in-place, no localStorage write)
    // to find matches, then collapse them back. Returns descriptors.
    _findAllMatchDescs(q, missing, normalizedField) {
        const renderer = this.app.renderer;
        const collapsed = renderer._getCollapsedKeys?.() ?? new Set();
        collapsed.forEach(k => renderer._expandInPlace?.(k));
        const matches = this._runQuery(q, missing, normalizedField);
        collapsed.forEach(k => renderer._collapseInPlace?.(k));
        return matches.map(el => this._matchDesc(el)).filter(Boolean);
    }

    // ─── Result display ───────────────────────────────────────────────────────

    // Expands exactly the stream needed for the current result (if it was originally
    // collapsed), collapses any previously-expanded stream, and re-renders via
    // loadAndRender so neighbouring streams reposition correctly (no overlap).
    _showResult(q, missing, noZoom) {
        if (!this._allMatchDescs?.length) return;
        const { app } = this;
        const renderer = app.renderer;

        const desc = this._allMatchDescs[this.currentIndex];
        const inOriginallyCollapsed = this._savedCollapsedKeys?.has(desc.streamKey) ?? false;
        const nextVisibleStream = inOriginallyCollapsed ? desc.streamKey : null;

        if (nextVisibleStream !== this._currentVisibleStream) {
            // Build the collapsed set: original, minus the one stream we need open
            const newCollapsed = new Set(this._savedCollapsedKeys ?? []);
            if (nextVisibleStream) newCollapsed.delete(nextVisibleStream);

            // Only re-render if the collapsed state actually differs from what's stored
            const currentStored = renderer._getCollapsedKeys?.() ?? new Set();
            const stateChanged =
                newCollapsed.size !== currentStored.size ||
                [...newCollapsed].some(k => !currentStored.has(k));

            this._currentVisibleStream = nextVisibleStream;

            if (stateChanged) {
                localStorage.setItem('dsm-collapsed-v1', JSON.stringify([...newCollapsed]));
                app.loadAndRender(app.db.cachedCsvText);
            }
        }

        const target = this._elFromDesc(desc);
        if (!target) return;

        // Collect fresh versions of ALL match descriptors for dimming
        // (elements in collapsed streams are still in the DOM, just hidden)
        const allFresh = this._allMatchDescs.map(d => this._elFromDesc(d)).filter(Boolean);
        applySearchDimmingForMatches(allFresh);

        if (!missing && !noZoom) {
            const zoomTarget = target.matches?.('g[data-key^="card::"]')
                ? (target.querySelector('.profile-box') || target)
                : target;
            const containerGroup = target.closest?.(
                'g[data-key^="stream::"], g[data-key^="theme::"], g[data-key^="team::"]'
            );
            if (containerGroup) {
                renderer.fitElementToView(containerGroup, 600);
            } else {
                renderer.zoomToElement(zoomTarget, 1, 600);
            }
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    clear() {
        const { app } = this;
        // Restore the user's original collapsed state and re-render if we changed it
        if (this._savedCollapsedKeys !== null) {
            const currentStored = app.renderer._getCollapsedKeys?.() ?? new Set();
            const savedArr  = [...this._savedCollapsedKeys].sort();
            const storedArr = [...currentStored].sort();
            if (JSON.stringify(savedArr) !== JSON.stringify(storedArr)) {
                localStorage.setItem('dsm-collapsed-v1', JSON.stringify([...this._savedCollapsedKeys]));
                app.loadAndRender(app.db.cachedCsvText);
            }
            this._savedCollapsedKeys = null;
            this._allMatchDescs = null;
            this._currentVisibleStream = null;
        }
        const output = document.getElementById('output');
        if (output) output.textContent = '';
        app.searchParam = '';
        const searchInput = document.getElementById('drawer-search-input');
        if (searchInput) searchInput.value = '';
        setSearchQuery('');
        removeQueryParam('missing');
        clearSearchDimming();
        clearFieldHighlights();
        app.renderer.fitToContent(0.9);
        app.drawer.close();
    }

    search(query, opts = {}) {
        const { app } = this;
        const q = (query ?? '').toString().trim().toLowerCase();
        const scopeField = (opts.field || '').toLowerCase();
        const missing = !!opts.missing;
        const noZoom = !!opts.noZoom;

        if (!q && !missing) {
            this.clear();
            return;
        }

        const searchInput = document.getElementById('drawer-search-input');
        if (searchInput && searchInput.value.trim().toLowerCase() !== q) {
            searchInput.value = q;
        }

        const normalizeFieldName = (f) => {
            const fLow = (f || '').toLowerCase();
            if (fLow.includes('role')) return 'role';
            if (fLow.includes('company')) return 'company';
            if (fLow.includes('location')) return 'location';
            return '';
        };

        const normalizedField = normalizeFieldName(scopeField);
        const renderer = app.renderer;

        // Capture the user's collapsed state on the first search after a clear
        if (this._savedCollapsedKeys === null) {
            this._savedCollapsedKeys = renderer._getCollapsedKeys?.() ?? new Set();
        }

        const isNewQuery = q !== this.lastSearch || missing;

        if (isNewQuery) {
            // Restore localStorage to the user's original state before finding matches
            localStorage.setItem('dsm-collapsed-v1', JSON.stringify([...this._savedCollapsedKeys]));
            this._currentVisibleStream = null;

            // Find ALL matches across all streams (in-place expand → query → collapse back)
            this._allMatchDescs = this._findAllMatchDescs(q, missing, normalizedField);

            if (this._allMatchDescs.length === 0) {
                clearSearchDimming();
                app.showToast(missing ? 'No result found for Unknown' : `No result found for ${q}`);
                return;
            }

            this.lastSearch = q;
            this.currentIndex = 0;
        } else {
            if (!this._allMatchDescs?.length) return;
            this.currentIndex = (this.currentIndex + 1) % this._allMatchDescs.length;
        }

        clearFieldHighlights();
        app.drawer.close();

        this._showResult(q, missing, noZoom);

        const count = this._allMatchDescs.length;
        app.showToast(
            missing
                ? `Found ${count} result(s).`
                : `Found ${count} result(s). Showing ${this.currentIndex + 1}/${count}.`
        );
        if (!missing) {
            setSearchQuery(q);
            removeQueryParam('missing');
        } else {
            removeQueryParam('search');
            setQueryParam('missing', opts.field || '');
        }

        // Field highlight on current result
        if (!missing) {
            const target = this._elFromDesc(this._allMatchDescs[this.currentIndex]);
            if (target) {
                const FIELD_CLASSES = ['role-field', 'company-field', 'location-field'];
                const hitClass = FIELD_CLASSES.find(c => target.classList?.contains(c));
                if (hitClass) {
                    target.classList.add('field-hit-highlight');
                } else {
                    const group = target.closest?.('g[data-key^="card::"]');
                    if (group) {
                        FIELD_CLASSES.forEach(cls => {
                            const el = group.querySelector('.' + cls);
                            if (!el) return;
                            if ((el.textContent || '').toLowerCase().includes(q))
                                el.classList.add('field-hit-highlight');
                        });
                    }
                }
            }
        }

        // Role drawer
        if (!missing) {
            const roleMapping = app.db.roleDetailsMapping.get(query);
            if (scopeField?.toLowerCase() === 'role' && roleMapping) {
                app.drawer.open({
                    name: query,
                    description: roleMapping['description'],
                    elements: {
                        items: (roleMapping['grants'] || '').split(',').map(s => s.trim()).filter(Boolean)
                    },
                    elementsTitle: 'Role Grants'
                });
            }
        }

        // Service drawer
        if (!missing) {
            try {
                const target = this._elFromDesc(this._allMatchDescs[this.currentIndex]);
                if (!target) return;
                const group = target.closest?.('g');
                const teamTitleEl = group ? group.querySelector('text.team-title') : null;
                if (!teamTitleEl) return;

                const rawServices = (teamTitleEl.getAttribute('data-services') || '')
                    .split(',').map(s => s.trim()).filter(Boolean);
                if (rawServices.length === 0) return;

                const norm = v => (v || '').toString().trim().toLowerCase();
                const normalized = rawServices.map(s => ({ raw: s, norm: norm(s) }));
                const hit = normalized.find(svc => svc.norm.includes(q));
                if (!hit) return;

                const teamName = teamTitleEl.getAttribute('data-team-name') || getNameFromTitleEl(teamTitleEl);
                const email = teamTitleEl.getAttribute('data-team-email') || '';
                const channels = (() => {
                    try { return JSON.parse(teamTitleEl.getAttribute('data-team-channels') || '[]'); }
                    catch { return []; }
                })();
                const description = teamTitleEl.getAttribute('data-team-description') || '';

                app.drawer.open({
                    name: teamName,
                    description,
                    elements: { items: rawServices },
                    channels,
                    email,
                    highlightService: hit.raw,
                    highlightQuery: q,
                    elementsBaseUrl: (s) => `domino.html?search=id%3A"${encodeURIComponent(s)}"`
                });
            } catch (e) {
                console.warn('Drawer open/highlight skipped:', e);
            }
        }
    }
}
