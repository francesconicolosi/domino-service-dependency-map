import { buildExpandedLayoutMapFromDom } from './scenarioUtils.js';

const SCENARIO_CLIP_PREFIX = 'SOLITAIRE_SCENARIO_V1:';

export class ScenarioManager {
    constructor(app) {
        this.app = app;
        this.lsKey = 'dsm-layout-v1:default';
    }

    load() {
        try {
            return JSON.parse(localStorage.getItem(this.lsKey) || '{}');
        } catch {
            return {};
        }
    }

    save(obj) {
        localStorage.setItem(this.lsKey, JSON.stringify(obj));
    }

    getItem(key) {
        return this.load()[key];
    }

    restoreGroupPosition(groupSel) {
        const key = groupSel.attr('data-key');
        if (!key) return false;
        const saved = this.getItem(key);
        if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return false;
        groupSel.attr('transform', `translate(${saved.x},${saved.y})`);
        return true;
    }

    getSavedSize(groupSel) {
        const key = groupSel.attr('data-key');
        if (!key) return null;
        const saved = this.getItem(key);
        if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return null;
        return { w: saved.width, h: saved.height };
    }

    async handleAction(action) {
        const { app } = this;
        if (action === 'save') {
            const expanded = buildExpandedLayoutMapFromDom();
            localStorage.setItem(this.lsKey, JSON.stringify(expanded));
            app.showToast('Scenario saved ✅');
        }
        if (action === 'import') {
            try {
                const text = await this.readClipboard();
                const obj = this.parse(text);
                if (!obj || typeof obj !== 'object' || !obj.layout || typeof obj.layout !== 'object') {
                    throw new Error('Invalid scenario format');
                }
                const current = (() => {
                    try { return JSON.parse(localStorage.getItem(this.lsKey) || '{}'); } catch { return {}; }
                })();
                const merged = { ...current, ...obj.layout };
                await this.applyImported(merged);
            } catch (e) {
                console.warn('Import scenario failed:', e);
                app.showToast('Import failed: invalid clipboard scenario', 5000);
            }
        }
        if (action === 'export') {
            try {
                const expanded = buildExpandedLayoutMapFromDom();
                const exportString = this.serialize(expanded, this.lsKey);
                await this.writeClipboard(exportString);
                app.showToast('Scenario copied to clipboard ✅');
            } catch (e) {
                console.warn('Export scenario failed:', e);
                app.showToast('Export failed (clipboard not available)', 4500);
            }
        }
        if (action === 'reset') {
            localStorage.removeItem(this.lsKey);
            window.location.reload();
        }
    }

    filterLayout(layoutMap) {
        const out = {};
        for (const [k, v] of Object.entries(layoutMap || {})) {
            if (k.startsWith('stream::') || k.startsWith('theme::') || k.startsWith('team::') || k.startsWith('card::')) {
                out[k] = v;
            }
        }
        return out;
    }

    async writeClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch {}
        ta.remove();
        if (!ok) throw new Error('Clipboard write failed');
        return true;
    }

    async readClipboard() {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) return text;
            } catch (e) {
                // fallthrough
            }
        }
    }

    serialize(layoutMap, datasetKey) {
        const payload = {
            v: 1,
            app: 'solitaire',
            dataset: datasetKey || '',
            layout: this.filterLayout(layoutMap)
        };
        return SCENARIO_CLIP_PREFIX + JSON.stringify(payload);
    }

    parse(text) {
        const raw = (text || '').trim();
        if (!raw) throw new Error('Empty clipboard');
        if (!raw.startsWith(SCENARIO_CLIP_PREFIX)) {
            return JSON.parse(raw);
        }
        return JSON.parse(raw.slice(SCENARIO_CLIP_PREFIX.length));
    }

    async applyImported(importedLayoutMap) {
        localStorage.setItem(this.lsKey, JSON.stringify(importedLayoutMap));
        this.app.renderer.reset();
        await this.app.loadAndRender(this.app.db.cachedCsvText);
        this.app.showToast('Scenario imported and applied ✅');
    }
}
