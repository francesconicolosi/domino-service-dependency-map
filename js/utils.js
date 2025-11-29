import { zoomIdentity, zoomTransform, zoom as d3zoom, select } from 'd3';

export function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

export function initSideDrawerEvents() {
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

    document.getElementById('act-clear')?.addEventListener('click', () => {
        searchParam = '';
        const searchInput = document.getElementById('drawer-search-input');
        searchInput.value = searchParam;
        setSearchQuery(searchParam);
        closeSideDrawer();
    });

    document.getElementById('act-fit')?.addEventListener('click', () => {
        fitToContent(0.9);
        closeSideDrawer();
    });

    document.getElementById('act-report')?.addEventListener('click', () => {
        const subject = encodeURIComponent('Request for People Database Update');
        const body = encodeURIComponent(
            `Hello Team,

I would like to report the need for an update to the People Database: 
[insert the change here]

Thank you.`
        );

        const mailtoLink = `mailto:${peopleDBUpdateRecipients}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
        closeSideDrawer();
    });

    document.getElementById('drawer-search-go')?.addEventListener('click', () => {
        const q = document.getElementById('drawer-search-input')?.value?.trim().toLowerCase();
        if (q) searchByQuery(q);
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

    const lastUpdateEl = document.getElementById('side-last-update');
    if (lastUpdateEl) {
        if (latestUpdate instanceof Date) {
            lastUpdateEl.textContent = `Last Update: ${getFormattedDate(latestUpdate.toISOString())}`;
        } else {
            lastUpdateEl.textContent = '';
        }
    }

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

export function setQueryParam(param, value) {
    const url = new URL(window.location);
    if (value === undefined || value === null) return;
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}
export function setSearchQuery(value) {
    setQueryParam('search', value);
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
