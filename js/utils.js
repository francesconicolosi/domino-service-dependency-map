import * as d3 from 'd3';

export const SECOND_LEVEL_LABEL_EXTRA = 120;
export const TEAM_MEMBER_LEGENDA_LABEL = 'Team Member';

let searchActive = false;

export function formatMonthYear(value) {
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function clearSearchDimming() {
    d3.selectAll('.dimmed').classed('dimmed', false);
    d3.selectAll('.highlighted').classed('highlighted', false);
    searchActive = false;
}

function resolveScopeFromTarget(targetEl) {
    const el = targetEl instanceof Element ? targetEl : targetEl?.node?.();
    if (!el) return null;

    const cardG = el.closest('g[data-key^="card::"]');
    if (cardG) {
        const key = cardG.getAttribute('data-key');
        const parts = key.split('::');
        const s = parts[1], t = parts[2], team = parts[3];
        return {
            mode: 'member',
            streamKey: `stream::${s}`,
            themeKey:  `theme::${s}::${t}`,
            teamKey:   `team::${s}::${t}::${team}`,
            cardKey:   key
        };
    }

    const teamG = el.closest('g[data-key^="team::"]');
    if (teamG) {
        const key = teamG.getAttribute('data-key');
        const parts = key.split('::');
        const s = parts[1], t = parts[2];
        return { mode: 'team', streamKey: `stream::${s}`, themeKey: `theme::${s}::${t}`, teamKey: key };
    }

    const themeG = el.closest('g[data-key^="theme::"]');
    if (themeG) {
        const key = themeG.getAttribute('data-key');
        const parts = key.split('::');
        const s = parts[1];
        return { mode: 'theme', streamKey: `stream::${s}`, themeKey: key };
    }

    const streamG = el.closest('g[data-key^="stream::"]');
    if (streamG) {
        const key = streamG.getAttribute('data-key');
        return { mode: 'stream', streamKey: key };
    }
    return null;
}



export function applySearchDimmingForMatches(matchElements) {
    clearSearchDimming();
    if (!matchElements || matchElements.length === 0) return;

    searchActive = true;

    const hit = {
        streams: new Set(), // stream::<s>
        themes : new Set(), // theme::<s>::<t>
        teams  : new Set(), // team::<s>::<t>::<team>
        cards  : new Set()  // card::<s>::<t>::<team>::<member>
    };

    const scopes = matchElements
        .map(el => resolveScopeFromTarget(el))
        .filter(Boolean);

    scopes.forEach(s => {
        switch (s.mode) {
            case 'stream': hit.streams.add(s.streamKey); break;
            case 'theme' : hit.themes.add(s.themeKey);   break;
            case 'team'  : hit.teams.add(s.teamKey);     break;
            case 'member': hit.cards.add(s.cardKey);     break;
        }
    });

    d3.selectAll('#streamLayer > g, #themeLayer > g, #teamLayer > g, #cardLayer > g')
        .classed('dimmed', true)
        .classed('highlighted', false);

    const undimByKey = (key) => d3.select(`g[data-key="${key}"]`).classed('dimmed', false);
    const markByKey  = (key) => d3.select(`g[data-key="${key}"]`).classed('highlighted', true);
    const undimSel   = (sel) => sel.classed('dimmed', false);

    hit.streams.forEach(streamKey => {
        const s = streamKey.split('::')[1];

        undimByKey(streamKey); markByKey(streamKey);
        undimSel(d3.selectAll(`g[data-key^="theme::${s}::"]`));
        undimSel(d3.selectAll(`g[data-key^="team::${s}::"]`));
        undimSel(d3.selectAll(`g[data-key^="card::${s}::"]`));
    });

    hit.themes.forEach(themeKey => {
        const parts  = themeKey.split('::');           // theme::s::t
        const stream = `stream::${parts[1]}`;
        const suffix = parts.slice(1).join('::');      // s::t

        undimByKey(stream); markByKey(stream);

        undimByKey(themeKey); markByKey(themeKey);

        undimSel(d3.selectAll(`g[data-key^="team::${suffix}::"]`));
        undimSel(d3.selectAll(`g[data-key^="card::${suffix}::"]`));
    });

    hit.teams.forEach(teamKey => {
        const parts   = teamKey.split('::');              // team::s::t::team
        const stream  = `stream::${parts[1]}`;
        const theme   = `theme::${parts[1]}::${parts[2]}`;
        const suffix  = parts.slice(1).join('::');        // s::t::team

        undimByKey(stream); markByKey(stream);
        undimByKey(theme);  markByKey(theme);

        undimByKey(teamKey); markByKey(teamKey);

        undimSel(d3.selectAll(`g[data-key^="card::${suffix}::"]`));
    });

    hit.cards.forEach(cardKey => {
        const parts   = cardKey.split('::');              // card::s::t::team::member
        const stream  = `stream::${parts[1]}`;
        const theme   = `theme::${parts[1]}::${parts[2]}`;
        const team    = `team::${parts[1]}::${parts[2]}::${parts[3]}`;

        undimByKey(stream); markByKey(stream);
        undimByKey(theme);  markByKey(theme);
        undimByKey(team);   markByKey(team);

        undimByKey(cardKey); markByKey(cardKey);
    });
}

export function truncateString(str, maxLength = 25) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}

export function addTagToElement(element, number, tag = 'br') {
    element.insertAdjacentHTML('beforeend', `<${tag}>`.repeat(number));
}

export function buildFallbackMailToLink(peopleDBUpdateRecipients, subjectParam, bodyParam) {
    window.location.href = `mailto:${peopleDBUpdateRecipients.join(",")}?subject=${encodeURIComponent(subjectParam)}&body=${encodeURIComponent(bodyParam)}`;
}

export function createHrefElement(cleanUrl, textContent) {
    const a = document.createElement('a');

    a.href = cleanUrl;
    a.textContent = textContent ?? "🔗External Link";
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.color = '#0078d4';
    a.style.textDecoration = 'underline';
    return a;
}

function textNodeWithLinksToNodes(text) {
    const nodes = [];
    const urlRe = /(https?:\/\/[^\s<>"')\]]+)/g;

    let lastIndex = 0;
    let match;
    while ((match = urlRe.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index);
        if (before) nodes.push(document.createTextNode(before));

        let url = match[1];
        const trailingPunct = /[.,;:!?)+\]]+$/;
        let punct = '';
        const m2 = url.match(trailingPunct);
        if (m2) {
            punct = m2[0];
            url = url.slice(0, -punct.length);
        }

        nodes.push(createHrefElement(url));
        if (punct) nodes.push(document.createTextNode(punct));
        lastIndex = urlRe.lastIndex;
    }

    const rest = text.slice(lastIndex);
    if (rest) nodes.push(document.createTextNode(rest));
    return nodes;
}

const allowedAttributesByTag = {
    'a': new Set(['href', 'title', 'target', 'rel']),
};

function sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();

    const forbiddenSchemes = ['javascript:', 'vbscript:'];
    if (forbiddenSchemes.some(s => lower.startsWith(s))) {
        return '';
    }

    try {
        const u = new URL(trimmed, window.location.origin);
        const allowed = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];
        if (!allowed.includes(u.protocol) && !trimmed.startsWith('/')) {
            return '';
        }
    } catch (_) {
    }

    return trimmed;
}

function copyAllowedAttributes(srcElem, dstElem, allowedAttributesByTag) {
    const tag = srcElem.tagName.toLowerCase();
    const allowedAttrs = allowedAttributesByTag[tag];
    if (!allowedAttrs) return;

    for (const attr of srcElem.attributes) {
        const name = attr.name.toLowerCase();
        if (!allowedAttrs.has(name)) continue;

        let value = attr.value;

        if (tag === 'a') {
            if (name === 'href') {
                value = sanitizeUrl(value);
                if (!value) continue;
            }
            if (name === 'target') {
                const allowedTargets = new Set(['_blank', '_self']);
                if (!allowedTargets.has(value)) value = '_blank';
            }
            if (name === 'rel') {
                const parts = new Set(
                    value.split(/\s+/).filter(Boolean).map(v => v.toLowerCase())
                );
                parts.add('noopener');
                parts.add('noreferrer');
                value = Array.from(parts).join(' ');
            }
        }

        dstElem.setAttribute(name, value);
    }

    if (tag === 'a' && dstElem.hasAttribute('href')) {
        if (!dstElem.hasAttribute('rel')) {
            dstElem.setAttribute('rel', 'noopener noreferrer');
        }
        if (!dstElem.hasAttribute('target')) {
            dstElem.setAttribute('target', '_blank');
        }
    }
}


function sanitizeAndTransformNode(node, allowedTags) {
    if (node.nodeType === Node.TEXT_NODE) {
        return textNodeWithLinksToNodes(node.nodeValue || '');
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const normalizedTag = node.tagName.toLowerCase();

        if (allowedTags.has(normalizedTag)) {
            const clone = document.createElement(normalizedTag);

            copyAllowedAttributes(node, clone, allowedAttributesByTag);

            node.childNodes.forEach(child => {
                const childParts = sanitizeAndTransformNode(child, allowedTags);
                childParts.forEach(p => clone.appendChild(p));
            });

            if (normalizedTag === 'a' && !clone.getAttribute('href')) {
                const fragmentNodes = [];
                clone.childNodes.forEach(c => fragmentNodes.push(c));
                return fragmentNodes;
            }
            return [clone];
        }

        const fragmentNodes = [];
        node.childNodes.forEach(child => {
            const childParts = sanitizeAndTransformNode(child, allowedTags);
            childParts.forEach(p => fragmentNodes.push(p));
        });
        return fragmentNodes;
    }

    return [];
}

export function createFormattedElementsFrom(lines) {
    const elementsToAppend = [];
    const allowedTags = new Set(['b', 'i', 'ul', 'li', 'a']);

    lines.forEach((line, index) => {

        const template = document.createElement('template');
        template.innerHTML = line;

        Array.from(template.content.childNodes).forEach(node => {
            const parts = sanitizeAndTransformNode(node, allowedTags);
            parts.forEach(p => elementsToAppend.push(p));
        });

        if (index < lines.length - 1) {
            elementsToAppend.push(document.createElement('br'));
        }
    });
    return elementsToAppend;
}

export function createFormattedLongTextElementsFrom(longText) {
    let elementsToAppend = [];
    if (longText) {
        const lines = longText.split('\n');
        elementsToAppend = createFormattedElementsFrom(lines, elementsToAppend);
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

export function createOutlookUrl(to, cc = [], subject = '', body = '') {
    const toParam = to.length > 1 ? encodeURIComponent(to.join(';')) : '';
    const ccParam = cc.length > 1 ? encodeURIComponent(cc.join(';')) : '';

    const subjectParam = encodeURIComponent(subject);
    const bodyParam = encodeURIComponent(body);

    let url = `https://outlook.office.com/mail/deeplink/compose?subject=${subjectParam}&body=${bodyParam}`;
    if (toParam) url += `&to=${toParam}`;
    if (ccParam) url += `&cc=${ccParam}`;
    return url;
}

export function openOutlookWebCompose({to = [], cc = [], bcc = [], subject = '', body = ''}) {
    window.open(createOutlookUrl(to, cc, subject, body), '_blank', 'noopener');
}

export function isMobileDevice() {
    try {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
            return navigator.userAgentData.mobile;
        }
    } catch (_) {
    }

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
            if (inQuotes && text[i + 1] === '"') {
                value += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            current.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (value || current.length > 0) {
                current.push(value);
                rows.push(current);
                current = [];
                value = '';
            }
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else {
            value += char;
        }
    }
    if (value || current.length > 0) {
        current.push(value);
        rows.push(current);
    }
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
