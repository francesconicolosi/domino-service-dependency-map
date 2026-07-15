import { splitValues } from './utils.js';

const AUTOCOMPLETE_ID = 'search-suggestions';
const MAX_KEYS = 50;
const MAX_VALUES_PER_KEY = 2000;
const MAX_OPTIONS = 25;

export class AutocompleteEngine {
    // Can be constructed two ways:
    //   new AutocompleteEngine(keys, valuesByKey, opts)  — pre-built index (Solitaire, new Domino)
    //   new AutocompleteEngine(app)                      — legacy: call buildIndex() after construction
    // opts.allowMultiValue (default true) — when false, comma-based multi-value suggestions are disabled
    constructor(keysOrApp, valuesByKey, opts = {}) {
        if (keysOrApp && typeof keysOrApp === 'object' && !Array.isArray(keysOrApp) && keysOrApp.store) {
            // Legacy app-based construction
            this._app = keysOrApp;
            this.keys = [];
            this.valuesByKey = new Map();
            this.allowMultiValue = true;
            this.allowMultiField = opts.allowMultiField === true;
        } else {
            this._app = null;
            this.keys = keysOrApp ?? [];
            this.valuesByKey = valuesByKey ?? new Map();
            this.allowMultiValue = opts.allowMultiValue !== false;
            this.allowMultiField = opts.allowMultiField === true;
        }
    }

    // Legacy method used by Domino tests and old DominoApp usage
    buildIndex() {
        if (!this._app) return;
        const { nodes } = this._app.store;
        if (!nodes || !nodes.length) return;

        const keys = new Set(['id']);
        Object.keys(nodes[0] || {}).forEach(k => {
            if (!k) return;
            if (['index', 'x', 'y', 'vx', 'vy', 'fx', 'fy', 'color'].includes(k)) return;
            keys.add(k === 'Service Name' ? 'id' : k);
        });
        this.keys = Array.from(keys).slice(0, MAX_KEYS);

        const m = new Map();
        this.keys.forEach(k => {
            const set = new Set();
            if (k === 'id') {
                for (const n of nodes) {
                    if (set.size >= MAX_VALUES_PER_KEY) break;
                    const v = (n?.id ?? '').toString().trim();
                    if (v) set.add(v);
                }
            } else {
                for (const n of nodes) {
                    if (set.size >= MAX_VALUES_PER_KEY) break;
                    const raw = n?.[k];
                    if (typeof raw !== 'string' || !raw) continue;
                    for (const p of splitValues(raw).map(s => (s ?? '').toString().trim()).filter(Boolean)) {
                        if (set.size >= MAX_VALUES_PER_KEY) break;
                        set.add(p);
                    }
                }
            }
            m.set(k, Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
        });
        this.valuesByKey = m;
    }

    _splitMultiFieldInput(value) {
        let inQuote = false;
        let lastAmp = -1;
        for (let i = 0; i < value.length; i++) {
            const ch = value[i];
            if (ch === '"') inQuote = !inQuote;
            if (ch === '&' && !inQuote) lastAmp = i;
        }
        if (lastAmp === -1) return { prefix: '', current: value };
        return {
            prefix: value.slice(0, lastAmp + 1),
            current: value.slice(lastAmp + 1),
        };
    }

    _computeSingleClauseSuggestions(raw) {
        const value = (raw ?? '').toString();
        if (!value.includes(':')) {
            const leading = (value.match(/^\s*/)?.[0] ?? '');
            const trimmed = value.trimStart();
            const bang = trimmed.startsWith('!') ? '!' : '';
            const keyPrefix = (bang ? trimmed.slice(1) : trimmed).trim();
            const keys = this.keys.length ? this.keys : ['id'];
            const keySuggestions = keys
                .filter(k => k.toLowerCase().startsWith(keyPrefix.toLowerCase()))
                .map(k => `${leading}${bang}${k}:`);
            const idValues = this.valuesByKey.get('id') || [];
            const nameSuggestions = keyPrefix
                ? idValues
                    .filter(v => v.toLowerCase().startsWith(keyPrefix.toLowerCase()))
                    .map(v => `${leading}${bang}${v}`)
                : [];
            return [...nameSuggestions, ...keySuggestions];
        }

        const colonPos = value.indexOf(':');
        const keyTokenOriginal = value.slice(0, colonPos);
        const key = keyTokenOriginal.trim().replace(/^!/, '');
        const valuePartFull = value.slice(colonPos + 1);
        const vParts = this.allowMultiValue ? valuePartFull.split(',') : [valuePartFull];
        const lastValRaw = (vParts.pop() ?? '');
        const preValsRaw = this.allowMultiValue ? vParts.join(',') : '';
        const lastLeadingWs = (lastValRaw.match(/^\s*/)?.[0] ?? '');
        const quotedMode = valuePartFull.includes('"');
        const lastValClean = lastValRaw.trim().replace(/^"/, '').replace(/"$/, '');
        const values = this.valuesByKey.get(key) || [];
        const filtered = values.filter(v => v.toLowerCase().startsWith(lastValClean.toLowerCase()));
        const prefix = `${keyTokenOriginal}:${preValsRaw}${preValsRaw ? ',' : ''}${lastLeadingWs}`;
        const renderValue = (v) => quotedMode ? `"${v}"` : v;
        const out = filtered.map(v => prefix + renderValue(v));

        if (this.allowMultiValue) {
            if (lastValClean && values.some(v => v.toLowerCase() === lastValClean.toLowerCase()) && !value.trimEnd().endsWith(',')) {
                out.unshift(value.trimEnd() + ',');
            }
            if (value.trimEnd().endsWith(',')) {
                const prefixAfterComma = `${keyTokenOriginal}:${preValsRaw}${preValsRaw ? ',' : ''}`;
                out.unshift(...values.slice(0, MAX_OPTIONS).map(v => prefixAfterComma + renderValue(v)));
            }
        }
        return out;
    }

    computeSuggestions(raw) {
        const value = (raw ?? '').toString();

        if (!this.allowMultiField) {
            return this._computeSingleClauseSuggestions(value);
        }

        const { prefix, current } = this._splitMultiFieldInput(value);
        const out = [];
        const currentSuggestions = this._computeSingleClauseSuggestions(current)
            .map(s => `${prefix}${s}`);
        out.push(...currentSuggestions);

        const trimmed = value.trimEnd();
        const currentTrimmed = current.trimEnd();
        const hasKeyValue = currentTrimmed.includes(':') && currentTrimmed.slice(currentTrimmed.indexOf(':') + 1).trim().length > 0;
        if (hasKeyValue && !trimmed.endsWith('&')) {
            // Suggest adding another field once the current field has at least one value.
            out.unshift(`${trimmed}&`);
        }

        // Remove duplicates while keeping ranking.
        return Array.from(new Set(out));
    }
    refreshSuggestions(raw) {
        const dl = document.getElementById(AUTOCOMPLETE_ID);
        if (!dl) return;
        dl.innerHTML = '';
        this.computeSuggestions(raw).slice(0, MAX_OPTIONS).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            dl.appendChild(opt);
        });
    }

    init() {
        const input = document.getElementById('drawer-search-input');
        if (!input) return;

        let dl = document.getElementById(AUTOCOMPLETE_ID);
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = AUTOCOMPLETE_ID;
            document.body.appendChild(dl);
        }
        if (!input.getAttribute('list')) input.setAttribute('list', AUTOCOMPLETE_ID);

        const update = () => this.refreshSuggestions(input.value || '');
        if (!input.dataset.boundAutocomplete) {
            input.dataset.boundAutocomplete = '1';
            input.addEventListener('input', update);
            input.addEventListener('focus', update);
        }
        update();
    }
}
