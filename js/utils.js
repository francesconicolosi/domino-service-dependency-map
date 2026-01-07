import * as d3 from 'd3';

const LEGEND_KEY = 'legend::pos';

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function getLegend() {
    return document.getElementById('legend');
}

export function saveLegendPosition() {
    const legend = getLegend();
    if (!legend) return;
    const top  = parseFloat(legend.style.top)  || 0;
    const left = parseFloat(legend.style.left) || 0;

    const all = loadLayout();
    all[LEGEND_KEY] = { top, left };
    saveLayout(all);
}

export function restoreLegendPosition() {
    const legend = getLegend();
    if (!legend) return;
    const saved = getItemLayout(LEGEND_KEY);
    if (!saved || !Number.isFinite(saved.top) || !Number.isFinite(saved.left)) return;

    legend.style.top    = `${clamp(saved.top, 0, window.innerHeight - legend.offsetHeight)}px`;
    legend.style.left   = `${clamp(saved.left, 0, window.innerWidth  - legend.offsetWidth)}px`;
    legend.style.bottom = 'auto';
    legend.style.right  = 'auto';
}

export function initLegendDrag() {
    const legend = document.getElementById('legend');
    if (!legend) return;

    legend.style.zIndex = '10001';
    legend.style.userSelect = 'none';
    legend.style.cursor = 'move';
    legend.style.touchAction = 'none';

    const comp = window.getComputedStyle(legend);
    const rect = legend.getBoundingClientRect();
    const hasBottom = comp.bottom !== 'auto' && comp.bottom !== '' && comp.bottom !== '0px';

    if (hasBottom || !legend.style.top) {
        const bottom = parseFloat(comp.bottom || '20') || 20;
        const left   = parseFloat(comp.left   || '20') || 20;
        const top    = window.innerHeight - bottom - rect.height;

        legend.style.top    = `${Math.max(0, Math.min(top,  window.innerHeight - rect.height))}px`;
        legend.style.left   = `${Math.max(0, Math.min(left, window.innerWidth  - rect.width ))}px`;
        legend.style.bottom = 'auto';
        legend.style.right  = 'auto';
    }

    legend.addEventListener('mousedown',  e => e.stopPropagation(), { capture: true });
    legend.addEventListener('touchstart', e => e.stopPropagation(), { capture: true, passive: true });

    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    const dragHandler = d3.drag()
        .on('start', (event) => {
            const se = event.sourceEvent;
            const r  = legend.getBoundingClientRect();
            startX    = (se?.touches?.[0]?.clientX ?? se?.clientX ?? 0);
            startY    = (se?.touches?.[0]?.clientY ?? se?.clientY ?? 0);
            startLeft = r.left;
            startTop  = r.top;
            legend.classList.add('dragging');
        })
        .on('drag', (event) => {
            const se   = event.sourceEvent;
            const cx   = (se?.touches?.[0]?.clientX ?? se?.clientX ?? startX);
            const cy   = (se?.touches?.[0]?.clientY ?? se?.clientY ?? startY);
            const dx   = cx - startX;
            const dy   = cy - startY;
            const left = Math.max(0, Math.min(window.innerWidth  - legend.offsetWidth,  startLeft + dx));
            const top  = Math.max(0, Math.min(window.innerHeight - legend.offsetHeight, startTop  + dy));

            legend.style.left = `${left}px`;
            legend.style.top  = `${top}px`;
        })
        .on('end', () => {
            legend.classList.remove('dragging');
        });

    d3.select(legend).on('.drag', null).call(dragHandler); // pulisci eventuali handler precedenti

    window.addEventListener('resize', () => {
        const r = legend.getBoundingClientRect();
        legend.style.left = `${Math.max(0, Math.min(r.left, window.innerWidth  - r.width))}px`;
        legend.style.top  = `${Math.max(0, Math.min(r.top,  window.innerHeight - r.height))}px`;
    });
}

export function buildFallbackMailToLink(peopleDBUpdateRecipients, subjectParam, bodyParam) {
    window.location.href = `mailto:${peopleDBUpdateRecipients.join(",")}?subject=${encodeURIComponent(subjectParam)}&body=${encodeURIComponent(bodyParam)}`;
}

export function updateLegend(scale, field, d3param) {
    const legend = d3param.select('#legend');
    legend.html('');

    legend.append('div')
        .attr('class', 'legend-title')
        .text(`${field} Legenda`);

    const itemsWrap = legend.append('div').attr('class', 'legend-items');

    const domain = scale.domain();

    domain.forEach(label => {
        const key = label || 'Unknown';
        const row = itemsWrap.append('div').attr('class', 'legend-item');

        row.append('span')
            .attr('class', 'legend-swatch')
            .style('background', scale(key));

        row.append('span')
            .attr('class', 'legend-label')
            .text(`${key}`);
    });
}

export function buildLegendaColorScale(field, items, d3param, palette, neutralColor, specialMappedField, specialLegendaItemsMap) {
    if (specialMappedField === undefined || field !== specialMappedField) {
        const domainArr = Array.from(new Set(
            items.map(m => (m?.[field] ?? '').toString().trim() || 'Unknown')
        ));
        return d3param.scaleOrdinal(domainArr, palette);
    }

    const additionalExclusiveDomain = [...specialLegendaItemsMap.values()]
        .flat()
        .filter(r => new Set(
            items
                .map(m => (m?.[specialMappedField] ?? '').toString().trim())
                .filter(Boolean)
        ).has(r));

    const domainWithOther = [...additionalExclusiveDomain, 'Other'];
    const paletteForSpecialEntries = domainWithOther.map((_, i) => i < additionalExclusiveDomain.length
        ? palette[i % palette.length]
        : neutralColor
    );


    const scale = d3param.scaleOrdinal(domainWithOther, paletteForSpecialEntries);

    scale.isGuest = (specificField) => {
        return additionalExclusiveDomain.includes((specificField || '').trim());
    }
    return scale;
}

export function openOutlookWebCompose({to = [], cc = [], bcc = [], subject = '', body = ''}) {
    const toParam = to.length ? encodeURIComponent(to.join(';')) : '';
    const ccParam = cc.length ? encodeURIComponent(cc.join(';')) : '';

    const subjectParam = encodeURIComponent(subject);
    const bodyParam = encodeURIComponent(body);

    let url = `https://outlook.office.com/mail/deeplink/compose?subject=${subjectParam}&body=${bodyParam}`;
    if (toParam) url += `&to=${toParam}`;
    if (ccParam) url += `&cc=${ccParam}`;

    window.open(url, '_blank', 'noopener');
}

export function isMobileDevice() {
    try {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
            return navigator.userAgentData.mobile;
        }
    } catch (_) {}

    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    const uaIsMobile =
        /android|iphone|ipod|ipad|iemobile|mobile|blackberry|opera mini|opera mobi|silk/.test(ua) ||
        ((/macintosh/.test(ua) || /mac os x/.test(ua)) && 'ontouchend' in document);

    const smallViewport = Math.min(window.screen.width, window.screen.height) <= 820; // tablet/phone

    return uaIsMobile || smallViewport;
}


export function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

export function setQueryParam(param, value) {
    const url = new URL(window.location);
    if (value === undefined || value === null) return;
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}
export function setSearchQuery(value) {
    setQueryParam('search', value);
}

export function initCommonActions() {
    const overlay = document.getElementById('side-overlay');
    const closeBtn = document.getElementById('side-close');

    overlay?.addEventListener('click', closeSideDrawer);
    closeBtn?.addEventListener('click', closeSideDrawer);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSideDrawer();
    });

    const toggleCta = document.getElementById('toggle-cta');
    toggleCta?.addEventListener('click', (e) => {
        e.preventDefault();
        openSideDrawer();
    });

    document.getElementById('act-upload')?.addEventListener('click', () => {
        document.getElementById('fileInput')?.click();
        closeSideDrawer();
    });
}

export function openSideDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('side-overlay');
    if (!drawer) return;

    drawer.classList.add('open');
    overlay?.classList.add('visible');
    document.body.classList.add('side-drawer-open');
    drawer.setAttribute('aria-hidden', 'false');

    document.getElementById('act-upload')?.focus();
}

export function closeSideDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('side-overlay');
    if (!drawer) return;
    drawer.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.classList.remove('side-drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
}

export function toggleClearButton(buttonId, value) {
    const el = document.getElementById(buttonId);
    if (!el) return;
    el.classList.toggle('hidden', !value);
}

export function getFormattedDate(isoDate, locale = 'it-IT', timeZone = 'Europe/Rome') {
    const date = new Date(isoDate);
    return date.toLocaleString(locale, {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function parseCSV(text) {
    const rows = [];
    let current = [];
    let inQuotes = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') { value += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            current.push(value); value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (value || current.length > 0) { current.push(value); rows.push(current); current = []; value = ''; }
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else {
            value += char;
        }
    }
    if (value || current.length > 0) { current.push(value); rows.push(current); }
    return rows;
}

export function clearHighlights(viewport) {
    viewport.selectAll('rect').attr('stroke', null).attr('stroke-width', null);
}

export function highlightGroup(groupSel) {
    clearHighlights(groupSel);
    const rect = groupSel.select('rect.profile-box').node()
        ? groupSel.select('rect.profile-box')
        : groupSel.select('rect');
    if (rect.node()) rect.attr('stroke', '#ff9900').attr('stroke-width', 3);
}
