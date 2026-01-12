export const SECOND_LEVEL_LABEL_EXTRA = 120;
export const TEAM_MEMBER_LEGENDA_LABEL = 'Team Member';

export function buildFallbackMailToLink(peopleDBUpdateRecipients, subjectParam, bodyParam) {
    window.location.href = `mailto:${peopleDBUpdateRecipients.join(",")}?subject=${encodeURIComponent(subjectParam)}&body=${encodeURIComponent(bodyParam)}`;
}

export function createFormattedLongTextElementsFrom(description) {
    const elementsToAppend = [];
    if (description) {
        const lines = description.split('\n');
        lines.forEach((line, index) => {
            const parts = line.split(/\s+/);
            parts.forEach(part => {
                if (part.startsWith('http')) {
                    const cleanUrl = part.replace(/[.,;:]+$/, '');
                    const a = document.createElement('a');
                    a.href = cleanUrl;
                    a.textContent = "🔗External Link";
                    a.target = '_blank';
                    a.style.color = '#0078d4';
                    a.style.textDecoration = 'underline';
                    elementsToAppend.push(a);
                } else {
                    elementsToAppend.push(document.createTextNode(part + ' '));
                }
            });

            if (index < lines.length - 1) {
                elementsToAppend.push(document.createElement('br'));
            }
        });
    }
    return elementsToAppend;
}

function computeThemeWidth(numTeams, thirdLevelBoxWidth, thirdLevelBoxPadX) {
    const n = Number(numTeams) || 0;
    if (n <= 0) {
        return SECOND_LEVEL_LABEL_EXTRA;
    }
    return n * thirdLevelBoxWidth + (n - 1) * thirdLevelBoxPadX + SECOND_LEVEL_LABEL_EXTRA;
}


export function computeStreamBoxWidthWrapped(
    secondLevelItems,
    secondLevelBoxPadX,
    secondLevelNA,
    thirdLevelBoxPadX,
    thirdLevelBoxWidth,
    themesPerRow = 4,
    minWidth = 600,
    firstLevelPad = 80
) {

    const themeEntries = Object.entries(secondLevelItems)
        .filter(([themeKey]) => !themeKey.includes(secondLevelNA));

    const teamsPerThemeInStream = themeEntries.map(([, thirdLevelItems]) =>
        Object.keys(thirdLevelItems).length
    );

    const themeWidths = teamsPerThemeInStream.map(n =>
        computeThemeWidth(n, thirdLevelBoxWidth, thirdLevelBoxPadX)
    );

    if (!themeWidths || themeWidths.length === 0) return minWidth;

    let maxRowWidth = 0;
    for (let i = 0; i < themeWidths.length; i += themesPerRow) {
        const row = themeWidths.slice(i, i + themesPerRow);
        const rowSum = row.reduce((acc, w) => acc + (Number(w) || 0), 0);
        const pads = (row.length - 1) * secondLevelBoxPadX;
        const rowWidth = rowSum + pads + firstLevelPad;

        if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
    }
    return Math.max(maxRowWidth, minWidth);
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


    const guestValues = Array.from(specialLegendaItemsMap.values()).flat().map(s => s.trim()).filter(Boolean);
    const foundGuests = new Set();
    for (const m of items) {
        const raw = (m?.[specialMappedField] ?? '').toString();
        const rawLower = raw.toLowerCase();
        guestValues.forEach(gv => {
            if (gv && rawLower.includes(gv.toLowerCase())) {
                foundGuests.add(gv);
            }
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
