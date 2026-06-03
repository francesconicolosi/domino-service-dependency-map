import * as d3 from 'd3';
import { normalizeWs } from '../shared/utils.js';
import {
    NEUTRAL_COLOR,
    TEAM_MEMBER_LEGENDA_LABEL,
    ROLE_FIELD_WITH_MAPPING,
    COMPANY_FIELD,
    LOCATION_FIELD,
    firstLevelNA,
    secondLevelNA,
    thirdLevelNA,
    emailField,
} from './constants.js';
import { buildCompositeKey, getAllowedStreamsSet } from './orgUtils.js';
import { normalizeKey } from '../shared/utils.js';

const MOST_FREQUENT_FIXED_COLOR = NEUTRAL_COLOR;

export function makeKeyColorScale(keys, topKey) {
    const palette = d3.schemeTableau10;
    const map = new Map();
    keys.forEach((k, i) => map.set(k, palette[i % palette.length]));
    if (topKey) map.set(topKey, MOST_FREQUENT_FIXED_COLOR);
    const scale = (k) => map.get(k) || NEUTRAL_COLOR;
    scale.domain = () => keys.slice();
    scale.colorOf = (k) => map.get(k) || NEUTRAL_COLOR;
    return scale;
}

export function getLegendTitleFor(fieldName) {
    if (fieldName === ROLE_FIELD_WITH_MAPPING) return 'Roles';
    if (fieldName === COMPANY_FIELD)           return 'Companies';
    if (fieldName === LOCATION_FIELD)          return 'Locations';
    return 'Legend';
}

export function computeKeysAndCounts(members, fieldName) {
    const counts = new Map();
    for (const m of members || []) {
        const k = normalizeWs(m?.[fieldName]);
        const key = k || 'Unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const keys = Array.from(counts.keys())
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    let topKey = null, max = -1;
    for (const [k, c] of counts) {
        if (c > max) { max = c; topKey = k; }
    }
    return { keys, counts, topKey };
}

export function computeKeysAndCountsFromVisibleOrg(org, fieldName) {
    const counts = new Map();
    const seen = new Set();
    const allowed = getAllowedStreamsSet();

    const isAllowedStream = (s) => {
        if (!allowed || allowed.size === 0) return true;
        const n1 = (s ?? '').toString().trim();
        const n2 = normalizeKey(n1);
        return allowed.has(n1) || allowed.has(n2);
    };

    const pickKey = (m) => {
        if (!m) return 'Unknown';
        if (fieldName === ROLE_FIELD_WITH_MAPPING) return normalizeWs(m?.[ROLE_FIELD_WITH_MAPPING]) || 'Unknown';
        if (fieldName === COMPANY_FIELD)           return normalizeWs(m?.[COMPANY_FIELD])           || 'Unknown';
        if (fieldName === LOCATION_FIELD)          return normalizeWs(m?.[LOCATION_FIELD])          || 'Unknown';
        return normalizeWs(m?.[fieldName]) || 'Unknown';
    };

    Object.entries(org || {}).forEach(([first, themes]) => {
        if ((first || '').includes(firstLevelNA)) return;
        if (!isAllowedStream(first)) return;
        Object.entries(themes || {}).forEach(([second, teams]) => {
            if ((second || '').includes(secondLevelNA)) return;
            Object.entries(teams || {}).forEach(([third, members]) => {
                if ((third || '').includes(thirdLevelNA)) return;
                (members || []).forEach(m => {
                    const id = buildCompositeKey(m, emailField);
                    if (id && seen.has(id)) return;
                    if (id) seen.add(id);
                    const key = pickKey(m);
                    counts.set(key, (counts.get(key) || 0) + 1);
                });
            });
        });
    });

    const keys = Array.from(counts.keys())
        .sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b, 'en', { sensitivity: 'base' }));
    let topKey = null, max = -1;
    for (const [k, c] of counts) {
        if (c > max) { max = c; topKey = k; }
    }
    return { keys, counts, topKey };
}

export function updateLegend(scale, field, d3param) {
    const legend = d3param.select('#legend');
    legend.html('');
    legend.append('div').attr('class', 'legend-title').text(`${field} Legenda`);
    const itemsWrap = legend.append('div').attr('class', 'legend-items');
    const domain = scale.domain();
    domain.forEach(label => {
        const key = label || 'Unknown';
        const row = itemsWrap.append('div').attr('class', 'legend-item');
        row.append('span').attr('class', 'legend-swatch').style('background', scale(key));
        row.append('span').attr('class', 'legend-label').text(`${key}`);
    });
}

export function buildLegendaColorScale(field, items, d3param, palette, neutralColor, specialMappedField, guestValues) {
    if (specialMappedField === undefined || field !== specialMappedField) {
        const domainArr = Array.from(new Set(
            items.map(m => (m?.[field] ?? '').toString().trim() || 'Unknown')
        ));
        return d3param.scaleOrdinal(domainArr, palette);
    }
    const foundGuests = new Set();
    for (const m of items) {
        const raw = (m?.[specialMappedField] ?? '').toString();
        const rawLower = raw.toLowerCase();
        guestValues.forEach(gv => {
            if (gv && rawLower.includes(gv.toLowerCase())) foundGuests.add(gv);
        });
    }
    const domainWithOther = [...foundGuests, TEAM_MEMBER_LEGENDA_LABEL];
    const paletteForSpecialEntries = domainWithOther.map((_, i) =>
        i < foundGuests.size ? palette[i % palette.length] : neutralColor
    );
    const scale = d3param.scaleOrdinal(domainWithOther, paletteForSpecialEntries);
    scale.isGuest = (specificField) => {
        const val = (specificField || '').toString().toLowerCase();
        return guestValues.some(gv => val.includes(gv.toLowerCase()));
    };
    return scale;
}
