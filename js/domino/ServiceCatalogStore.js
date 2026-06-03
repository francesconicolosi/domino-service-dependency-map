import * as d3 from 'd3';
import { getFormattedDate, splitValues } from '../shared/utils.js';

export class ServiceCatalogStore {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.activeServiceNodes = [];
        this.activeServiceNodeIds = new Set();
        this.hasLoaded = false;
    }

    processData(data) {
        const requiredColumns = ['Service Name', 'Description', 'Type', 'Depends on', 'Status', 'Decommission Date'];
        const missingColumns = requiredColumns.filter(col => !data.columns.includes(col));
        if (missingColumns.length > 0) {
            alert(`Missing mandatory columns: ${missingColumns.join(', ')}`);
            return null;
        }

        if (data.columns.includes('Updated')) {
            const validDates = data
                .map(d => new Date(d['Updated']))
                .filter(date => !isNaN(date.getTime()));
            if (validDates.length > 0) {
                const lastUpdateEl = document.getElementById('side-last-update');
                if (lastUpdateEl) {
                    lastUpdateEl.textContent = `Last Update: ${getFormattedDate(new Date(Math.max(...validDates.map(d => d.getTime()))).toISOString())}`;
                }
            }
        }

        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        this.nodes = data.map(d => {
            const node = { id: d['Service Name'], color: colorScale(d['Type']) };
            for (const key in d) node[key] = d[key];
            return node;
        });

        const nodeIds = new Set(this.nodes.map(d => d.id));
        const usedByMap = new Map();

        this.links = data.flatMap(d => {
            const src = d['Service Name'];
            const deps = splitValues(d['Depends on']);
            return deps.map(dep => {
                const depTrim = dep.trim();
                if (!nodeIds.has(depTrim)) return null;
                if (!usedByMap.has(depTrim)) usedByMap.set(depTrim, new Set());
                usedByMap.get(depTrim).add(src);
                return { source: src, target: depTrim };
            });
        }).filter(Boolean);

        const hasUsedByColumn = data.columns.includes('Used by');
        if (!hasUsedByColumn) {
            this.nodes.forEach(n => {
                const users = Array.from(usedByMap.get(n.id) || []);
                n['Used by'] = users.join('||');
            });
            data.columns = [...data.columns, 'Used by'];
        }

        this.activeServiceNodes = this.nodes.filter(d =>
            d.Status !== 'Stopped' && d.Status !== 'Decommissioned' && !d['Decommission Date']
        );
        this.activeServiceNodeIds = new Set(this.activeServiceNodes.map(d => d.id));

        return colorScale;
    }

    reset() {
        this.nodes = [];
        this.links = [];
        this.activeServiceNodes = [];
        this.activeServiceNodeIds = new Set();
        this.hasLoaded = false;
    }
}
