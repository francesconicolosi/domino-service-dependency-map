import * as d3 from 'd3';

import {
    addTagToElement,
    applySearchDimmingForMatches, askModal,
    buildCompositeKey,
    buildFallbackMailToLink,
    buildLegendaColorScale,
    clearFieldHighlights,
    clearSearchDimming,
    closeSideDrawer,
    computeStreamBoxWidthWrapped,
    createFormattedLongTextElementsFrom,
    createHrefElement,
    createOutlookUrl,
    formatMonthYear,
    getAllowedStreamsSet,
    getFormattedDate, getNameFromTitleEl,
    getQueryParam,
    getVisiblePeopleForLegend,
    highlightGroup as highlightGroupUtils,
    initCommonActions,
    normalizeKey,
    openPersonReportCompose,
    parseCSV,
    SECOND_LEVEL_LABEL_EXTRA,
    setSearchQuery,
    TEAM_MEMBER_LEGENDA_LABEL,
    truncateString,
    updateLegend
} from './utils.js';

let lastSearch = '';
let currentIndex = 0;
let logoLayer;

let people = [];
let colorScale = null;


const THEMES_PER_ROW = 4;
const secondLevelRowPadY = 60;

const firstOrgLevel = 'Team Stream';
const secondOrgLevel = 'Team Theme';
const thirdOrgLevel = 'Team member of';
const firstLevelNA = `No ${firstOrgLevel}`;
const secondLevelNA = `No ${secondOrgLevel}`;
const thirdLevelNA = `No ${thirdOrgLevel}`;

const PALETTE = [
    '#a0c4ff', '#ffd6e0', '#b2f7ef', '#ffe066', '#caffbf',
    '#ffadad', '#fdffb6', '#bdb2ff', '#9bf6ff', '#ffc6ff'
];

const ROLE_FIELD_WITH_MAPPING = 'Role';
const LOCATION_FIELD = 'Location';
const COMPANY_FIELD = 'Company';
let colorBy = ROLE_FIELD_WITH_MAPPING;

const guestRolesMap = new Map([
    ["Team Product Manager", ["Product Manager"]],
    ["Team Delivery Manager", ["Delivery Manager"]],
    ["Team Scrum Master", ["Agile Coach/Scrum Master"]],
    ["Team Solution Architect", ["Solution Architect"]],
    ["Team Development Manager", ["Development Manager"]],
    ["Team Security Champion", ["Security Champion"]]
]);

const additionalRolesToHighlight = ["OMS expert", "Project Manager", "Business Analyst"];

const legendaRoles = Array.from(new Set([
    ...Array.from(guestRolesMap.values()).flat(),
    ...additionalRolesToHighlight
]));

const guestRoleColumns = Array.from(guestRolesMap.keys());

let colorKeyMappings = new Map();
const emailField = "Company email"; // this will be used to resolve the photo filename

const peopleDBUpdateRecipients = [
    'teams@share.software.net'
];

const portfolioDBUpdateRecipients = ['portfolio@nycosoft.com', 'bleiz.jonas@nycosoft.com'];

const NEUTRAL_COLOR = '#fcfcfc';


function initColorScale(initialField, members) {
    colorBy = initialField;
    colorScale = buildLegendaColorScale(colorBy, members.slice(), d3, PALETTE, NEUTRAL_COLOR, ROLE_FIELD_WITH_MAPPING, legendaRoles);

    if (typeof colorScale !== 'function') {
        throw new Error('colorScale was not created as a function');
    }
}

function getCardFill(g) {
    if (typeof colorScale !== 'function') return NEUTRAL_COLOR;

    let colorKey;

    if (colorBy === ROLE_FIELD_WITH_MAPPING) {
        const dataRole = (g.attr('data-role') || '').toString().toLowerCase();

        const guestValues = Array.from(guestRolesMap.values()).flat();

        const firstIncludedGuest = legendaRoles.find(v =>
            v && dataRole.includes(v.toLowerCase())
        );
        colorKey = firstIncludedGuest ? firstIncludedGuest : TEAM_MEMBER_LEGENDA_LABEL;
    } else if (colorBy === COMPANY_FIELD) {
        colorKey = (g.attr('data-company') || 'Unknown');
    } else {
        colorKey = (g.attr('data-location') || 'Unknown');
    }

    const finalColor = colorScale(colorKey);
    return (typeof finalColor === 'string' && finalColor) ? finalColor : NEUTRAL_COLOR;
}

function recolorProfileCards(field) {
    colorBy = field;
    const allowedStreams = getAllowedStreamsSet?.() ?? (() => {
        const p = getQueryParam('stream');
        if (!p) return null;
        const set = new Set();
        p.split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(x => {
                set.add(x);
                set.add(normalizeKey(x));
            });
        return set;
    })();

    const visiblePeopleForLegend = getVisiblePeopleForLegend(people, allowedStreams, firstOrgLevel);

    colorScale = buildLegendaColorScale(
        colorBy,
        visiblePeopleForLegend.slice(),
        d3,
        PALETTE,
        NEUTRAL_COLOR,
        ROLE_FIELD_WITH_MAPPING,
        legendaRoles
    );
    updateLegend(colorScale, colorBy, d3);

    d3.selectAll('g[data-key^="card::"]').each(function () {
        const g = d3.select(this);
        g.select('rect.profile-box')
            .transition().duration(200)
            .attr('fill', getCardFill(g));
    });

}


function setColorMode(mode) {
    const roleEl = document.getElementById('toggle-color-role');
    const compEl = document.getElementById('toggle-color-company');
    const locEl = document.getElementById('toggle-color-location');

    if (!roleEl || !compEl || !locEl) return;


    if (mode === ROLE_FIELD_WITH_MAPPING) {
        roleEl.checked = true;
        compEl.checked = false;
        locEl.checked = false;
    } else if (mode === COMPANY_FIELD) {
        roleEl.checked = false;
        compEl.checked = true;
        locEl.checked = false;
    } else {
        if (mode === LOCATION_FIELD) {
            roleEl.checked = false;
            compEl.checked = false;
            locEl.checked = true;
        }
    }

    recolorProfileCards(mode);
}


const drag = d3.drag()
    .on("start", function () {
        d3.select(this).raise();
    })
    .on("drag", function (event) {
        const transform = d3.select(this).attr("transform");
        const translate = transform.match(/translate\(([^,]+),([^\)]+)\)/);
        const x = parseFloat(translate[1]) + event.dx;
        const y = parseFloat(translate[2]) + event.dy;
        d3.select(this).attr("transform", `translate(${x},${y})`);
    });


let searchParam;

let svg;
let viewport;
let backgroundLayer;
let cardLayer;
let streamLayer;
let themeLayer;
let teamLayer;

let zoom;
let width = 1200;
let height = 800;

function findHeaderIndex(headers, name) {
    const target = (name || '').trim().toLowerCase();
    return headers.findIndex(h => (h || '').trim().toLowerCase() === target);
}

let LS_KEY = 'dsm-layout-v1:default';

function loadLayout() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveLayout(obj) {
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

function getItemLayout(key) {
    return loadLayout()[key];
}

function upsertItemLayout(key, patch) {
    const all = loadLayout();
    all[key] = {...(all[key] || {}), ...patch};
    saveLayout(all);
}

function parseTranslate(transform) {
    if (!transform) return {x: 0, y: 0};
    const m = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    return m ? {x: +m[1] || 0, y: +m[2] || 0} : {x: 0, y: 0};
}

function restoreGroupPosition(groupSel) {
    const key = groupSel.attr('data-key');
    if (!key) return false;
    const saved = getItemLayout(key);
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return false;
    groupSel.attr('transform', `translate(${saved.x},${saved.y})`);
    return true;
}

function getSavedSizeForGroup(groupSel) {
    const key = groupSel.attr('data-key');
    if (!key) return null;
    const saved = getItemLayout(key);
    if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return null;
    return {w: saved.width, h: saved.height};
}


function makeResizable(group, rect, opts = {}) {
    const minW = Number(opts.minWidth) || 200;
    const minH = Number(opts.minHeight) || 150;

    const title = group.select('text');

    const savedSize = getSavedSizeForGroup(group);
    let w = (savedSize?.w ?? Number(rect.attr('width'))) || minW;
    let h = (savedSize?.h ?? Number(rect.attr('height'))) || minH;

    const handleSize = 14;
    const hitPad = 10;

    const handles = group.append('g').attr('class', 'resize-handles');
    handles.raise();

    const handleE = handles.append('rect').attr('class', 'resize-handle e');
    const handleS = handles.append('rect').attr('class', 'resize-handle s');
    const handleSE = handles.append('rect').attr('class', 'resize-handle se');

    const hitE = handles.append('rect').attr('class', 'resize-hit e');
    const hitS = handles.append('rect').attr('class', 'resize-hit s');
    const hitSE = handles.append('rect').attr('class', 'resize-hit se');

    function positionHandles() {
        handleE
            .attr('x', w - handleSize / 2)
            .attr('y', h / 2 - handleSize / 2)
            .attr('width', handleSize)
            .attr('height', handleSize);

        handleS
            .attr('x', w / 2 - handleSize / 2)
            .attr('y', h - handleSize / 2)
            .attr('width', handleSize)
            .attr('height', handleSize);

        handleSE
            .attr('x', w - handleSize / 2)
            .attr('y', h - handleSize / 2)
            .attr('width', handleSize)
            .attr('height', handleSize);

        hitE
            .attr('x', w - (handleSize / 2 + hitPad))
            .attr('y', h / 2 - (handleSize / 2 + hitPad))
            .attr('width', handleSize + 2 * hitPad)
            .attr('height', handleSize + 2 * hitPad);

        hitS
            .attr('x', w / 2 - (handleSize / 2 + hitPad))
            .attr('y', h - (handleSize / 2 + hitPad))
            .attr('width', handleSize + 2 * hitPad)
            .attr('height', handleSize + 2 * hitPad);

        hitSE
            .attr('x', w - (handleSize / 2 + hitPad))
            .attr('y', h - (handleSize / 2 + hitPad))
            .attr('width', handleSize + 2 * hitPad)
            .attr('height', handleSize + 2 * hitPad);
    }

    function applySize() {
        rect.attr('width', w).attr('height', h);

        if (!title.empty()) {
            const anchor = title.attr('text-anchor');
            if (anchor === 'middle') {
                title.attr('x', w / 2);
            }
        }

        positionHandles();
        if (typeof opts.onResize === 'function') {
            opts.onResize({width: w, height: h});
        }
    }

    function makeDeltaTracker() {
        let prev = null;
        const getSvgPoint = (event) => {
            const t = d3.zoomTransform(svg.node());
            const [px, py] = d3.pointer(event, svg.node());
            return t.invert([px, py]);
        };
        return {
            start(event) {
                prev = getSvgPoint(event);
            },
            drag(event) {
                const curr = getSvgPoint(event);
                if (!prev) prev = curr;
                const dx = curr[0] - prev[0];
                const dy = curr[1] - prev[1];
                prev = curr;
                return {dx, dy};
            }
        };
    }

    const trackerE = makeDeltaTracker();
    const trackerS = makeDeltaTracker();
    const trackerSE = makeDeltaTracker();

    const dragE = d3.drag()
        .on('start', (event) => {
            event.sourceEvent?.stopPropagation();
            trackerE.start(event);
        })
        .on('drag', (event) => {
            const {dx} = trackerE.drag(event);
            w = Math.max(minW, w + dx);
            applySize();
        });

    const dragS = d3.drag()
        .on('start', (event) => {
            event.sourceEvent?.stopPropagation();
            trackerS.start(event);
        })
        .on('drag', (event) => {
            const {dy} = trackerS.drag(event);
            h = Math.max(minH, h + dy);
            applySize();
        });

    const dragSE = d3.drag()
        .on('start', (event) => {
            event.sourceEvent?.stopPropagation();
            trackerSE.start(event);
        })
        .on('drag', (event) => {
            const {dx, dy} = trackerSE.drag(event);
            w = Math.max(minW, w + dx);
            h = Math.max(minH, h + dy);
            applySize();
        });

    handleE.call(dragE);
    hitE.call(dragE);
    handleS.call(dragS);
    hitS.call(dragS);
    handleSE.call(dragSE);
    hitSE.call(dragSE);

    handles
        .style('display', isDraggable ? null : 'none')
        .style('pointer-events', isDraggable ? 'all' : 'none');

    applySize();
}


function aggregateInfoByHeader(members, headers, headerName = 'Team Managed Services', sortElements = false) {
    const idx = findHeaderIndex(headers, headerName);
    if (idx === -1) {
        return {exists: false, items: []};
    }
    const headerRealName = headers[idx];
    const set = new Set();

    members.forEach(m => {
        const raw = m[headerRealName];
        if (!raw) return;
        if (sortElements) {
            raw
                .split(/\n|,/)
                .map(s => s.trim())
                .filter(Boolean)
                .forEach(v => set.add(v));
        } else {
            set.add(raw);
        }
    });

    const itemsToReturn = sortElements ? [...set].sort((a, b) => a.localeCompare(b, 'it', {sensitivity: 'base'})) : [...set];

    return {
        exists: true,
        items: itemsToReturn
    };
}

function clearSearch() {
    const output = document.getElementById('output');
    output.textContent = '';
    searchParam = '';
    const searchInput = document.getElementById('drawer-search-input');
    searchInput.value = searchParam;
    setSearchQuery(searchParam);
    clearSearchDimming();
    clearFieldHighlights();
    fitToContent(0.9);
    closeDrawer();
    //closeSideDrawer();
}

function initSideDrawerEvents() {
    initCommonActions();

    document.getElementById('act-clear')?.addEventListener('click', () => {
        clearSearch();
        if (getQueryParam('stream')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('stream');
            window.location.href = url.toString();
        }
    });

    document.getElementById('act-fit')?.addEventListener('click', () => {
        fitToContent(0.9);
        //closeSideDrawer();
    });

    document.getElementById('toggle-color-role')?.addEventListener('change', (e) => {
        if (e.target.checked) setColorMode(ROLE_FIELD_WITH_MAPPING);
    });
    document.getElementById('toggle-color-company')?.addEventListener('change', (e) => {
        if (e.target.checked) setColorMode(COMPANY_FIELD);
    });
    document.getElementById('toggle-color-location')?.addEventListener('change', (e) => {
        if (e.target.checked) setColorMode(LOCATION_FIELD);
    });

    document.getElementById('act-about')?.addEventListener('click', (e) => {
        closeSideDrawer();
        openDrawer({
            name: "About Solitaire ♤", description:
                `Org charts highlight hierarchy—but not how teams actually work. Much of the real collaboration that drives the Company operations happens across functions, services, and roles, yet remains invisible. This reinforces silos and hides the complexity of our shared work. More info on <a href="https://www.gamerdad.cloud/" target="_blank">my personal blog</a>\n` +
                "\n" +
                `<b><i>Our Vision</b></i>\n` +
                "By visualizing how teams operate—the people, services, and responsibilities behind daily activities—we strengthen a culture that is collaborative, transparent, and service‑oriented. Visibility turns shared accountability into a tangible part of our operating model.\n" +
                "\n" +
                `<b><i>What we're building</b></i>\n` +
                "A custom Visual People Database that brings together data from several systems into a single, interactive view.\n" +
                "\n" +
                `<b><i>It provides:</b></i>\n` +
                `<ul>` +
                `<li>A clear map of team members (internal staff and suppliers)</li>` +
                `<li>The services each team manages</li>` +
                `<li>Roles and responsibilities across the organization</li>` +
                `<li>Quick access to Domino Service Catalog</li>` +
                `<li>A built‑in “Request an update” feature to keep information fresh and accurate</li></ul>` +
                "\n" +
                "<b><i>The Benefits</b></i>\n" +
                `<ul><li>Understand who works on what across projects and services</li>` +
                `<li>Make hidden operational networks visible</li>` +
                `<li>Consolidate data not available in systems like the one used by the HR</li>` +
                `<li>Strengthen transparency, alignment, and cross‑team collaboration</li>` +
                `<li>Provide a single source of truth for service ownership and responsibilities</li></ul>`
        });
    });


    document.getElementById('act-report')?.addEventListener('click', async () => {
        try {
            openPersonReportCompose( peopleDBUpdateRecipients, portfolioDBUpdateRecipients).then(r =>  closeSideDrawer());
        } catch (e) {
            console.log(e);
            buildFallbackMailToLink(peopleDBUpdateRecipients, subject, body);
        }
    });

    document.getElementById('drawer-search-go')?.addEventListener('click', () => {
        const q = document.getElementById('drawer-search-input')?.value?.trim().toLowerCase();
        if (q) searchByQuery(q);
        //closeSideDrawer();
    });
}

window.addEventListener('DOMContentLoaded', initSideDrawerEvents);

(function handleAdvancedMode() {
    const params = new URLSearchParams(window.location.search);
    const isAdvanced = params.get("advanced") === "true";

    function show(elId, visible) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.style.display = visible ? "" : "none";
    }

    show("act-upload", isAdvanced);
    show("label-file", isAdvanced);
    show("toggle-draggable", isAdvanced);
    show("act-save", isAdvanced);
    show("act-reset-layout", isAdvanced);
    show("switch-label", isAdvanced);
})();

(function blockDesktopPinch() {
    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isMac = (navigator.platform || '').toUpperCase().includes('MAC') || /Mac OS X/.test(navigator.userAgent);

    if (!(isDesktop && isMac)) return; //

    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, {passive: false});

    window.addEventListener('gesturestart', (e) => e.preventDefault(), {passive: false});
    window.addEventListener('gesturechange', (e) => e.preventDefault(), {passive: false});
    window.addEventListener('gestureend', (e) => e.preventDefault(), {passive: false});
})();

function openDrawer({name: title, description, services, channels, email, highlightService, highlightQuery}) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const titleEl = document.getElementById('drawer-title');
    const listEl = document.getElementById('drawer-list');
    const descEl = document.getElementById('drawer-description');

    if (!drawer || !titleEl || !listEl || !descEl) return;

    titleEl.textContent = `${title}`;


    descEl.innerHTML = '';

    createFormattedLongTextElementsFrom(description).forEach(element => descEl.appendChild(element));
    if (description) {
        addTagToElement(descEl, 1, 'hr');
    }

    if (channels && channels.length > 0) {
        addTagToElement(descEl, 1);
        descEl.appendChild(document.createTextNode('Channels 💬'));
        addTagToElement(descEl, 1);
        const ul = document.createElement('ul');
        channels.forEach(channel => {
            const li = document.createElement('li');
            const channelLink = createHrefElement(channel, channel?.includes("slack.com") ? "Slack Channel" : "Link");
            li.appendChild(channelLink);
            ul.appendChild(li);
        })
        descEl.appendChild(ul);
        addTagToElement(descEl, 1);
        addTagToElement(descEl, 1, 'hr');
        addTagToElement(descEl, 1);
    }

    if (email && email !== "") {
        descEl.appendChild(document.createTextNode('Team Mailbox ✉️'));
        addTagToElement(descEl, 1);
        descEl.appendChild(createHrefElement(createOutlookUrl([email]), `${truncateString(email, 25)}`));
        addTagToElement(descEl, 2);
        addTagToElement(descEl, 1, 'hr');
    }

    listEl.innerHTML = '';

    if (services && services.items && services.items.length !== 0) {
        descEl.appendChild(document.createTextNode('Managed Services:'));
        services.items.forEach(s => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `index.html?search=id%3A"${encodeURIComponent(s)}"`;
            a.textContent = s;
            a.target = '_blank';
            li.appendChild(a);
            listEl.appendChild(li);
        });

        (function multiHighlight() {
            const norm = v => (v || '').toString().trim().toLowerCase();
            const anchors = Array.from(listEl.querySelectorAll('li > a'));
            listEl.querySelectorAll('.service-hit-highlight')
                .forEach(el => el.classList.remove('service-hit-highlight'));

            let firstHighlighted = null;
            const q = (highlightQuery || '').trim();
            if (q) {
                const qn = norm(q);
                anchors.forEach(a => {
                    const tn = norm(a.textContent);
                    if (tn.includes(qn)) {
                        a.classList.add('service-hit-highlight');
                        if (!firstHighlighted) firstHighlighted = a;
                    }
                });
            }

            if (highlightService) {
                const target = norm(highlightService);
                anchors.forEach(a => {
                    if (norm(a.textContent) === target) {
                        a.classList.add('service-hit-highlight');
                        if (!firstHighlighted) firstHighlighted = a;
                    }
                });
            }

            if (firstHighlighted) {
                try {
                    firstHighlighted.scrollIntoView({block: 'center', behavior: 'smooth'});
                } catch {
                }
            }
        })();

    }

    drawer.classList.add('open');
    overlay?.classList.add('visible');
    document.body.classList.add('drawer-open');
    drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;
    drawer.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.classList.remove('drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
}

function initDrawerEvents() {
    const overlay = document.getElementById('drawer-overlay');
    const closeBtn = document.getElementById('drawer-close');
    overlay?.addEventListener('click', closeDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}

window.addEventListener('DOMContentLoaded', initDrawerEvents);

window.addEventListener('load', function () {
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample-people-database.csv')
        .then(response => response.text())
        .then(csvData => {
            resetVisualization();
            extractData(csvData);
            searchParam = getQueryParam('search');
            if (searchParam) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        searchByQuery(searchParam);
                    });
                });
            }
        })
        .catch(error => console.error('Error loading the CSV file:', error));
});

document.getElementById('act-save')?.addEventListener('click', () => {
    const layout = {};

    d3.selectAll('.draggable').each(function () {
        const sel = d3.select(this);
        const key = sel.attr('data-key');
        if (!key) return;

        const {x, y} = parseTranslate(sel.attr('transform'));
        layout[key] = {x, y};
    });

    d3.selectAll('.draggable').each(function () {
        const sel = d3.select(this);
        const key = sel.attr('data-key');
        if (!key) return;

        const rect = sel.select('rect');
        if (!rect.empty()) {
            const w = +rect.attr('width');
            const h = +rect.attr('height');
            layout[key] = {...(layout[key] || {}), width: w, height: h};
        }
    });

    localStorage.setItem(LS_KEY, JSON.stringify(layout));
    showToast('Scenario successfully saved!');
});


function resetVisualization() {
    const svgEl = document.getElementById('canvas');
    if (!svgEl) {
        console.error('canvas not found');
        return;
    }

    width = svgEl.clientWidth || +svgEl.getAttribute('width') || 1200;
    height = svgEl.clientHeight || +svgEl.getAttribute('height') || 800;

    d3.select(svgEl).selectAll('*').remove();

    svg = d3.select(svgEl)
        .attr('width', width)
        .attr('height', height)
        .attr('cursor', 'grab');

    viewport = svg.append('g').attr('id', 'viewport');
    streamLayer = viewport.append('g').attr('id', 'streamLayer');
    themeLayer = viewport.append('g').attr('id', 'themeLayer');
    teamLayer = viewport.append('g').attr('id', 'teamLayer');
    cardLayer = viewport.append('g').attr('id', 'cardLayer');
    logoLayer = viewport.append('g').attr('id', 'logoLayer');

    zoom = d3.zoom()
        .filter((event) => {
            if (event.type === 'wheel') return !event.ctrlKey;          // ⬅️ ignora pinch su trackpad
            if (event.type === 'mousedown') return event.button === 0;
            if (event.type.startsWith('touch')) return true;
            return !event.ctrlKey;
        })
        .scaleExtent([0.1, 1])
        .on('start', () => svg.attr('cursor', 'grabbing'))
        .on('end', () => svg.attr('cursor', 'grab'))
        .on('zoom', (event) => {
            viewport.attr('transform', event.transform);
        });

    svg.call(zoom);
}

function showToast(message, duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function fitToContent(paddingRatio = 0.9) {
    if (!viewport) return;

    const bbox = viewport.node().getBBox();
    if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) {
        svg.call(zoom.transform, d3.zoomIdentity);
        return;
    }

    const scale = Math.min(width / bbox.width, height / bbox.height) * paddingRatio;
    const x = width / 2 - (bbox.x + bbox.width / 2) * scale;
    const y = height / 2 - (bbox.y + bbox.height / 2) * scale;

    const t = d3.zoomIdentity.translate(x, y).scale(scale);
    svg.call(zoom.transform, t);
}

function zoomToElement(element, desiredScale = 1.5, duration = 500) {
    if (!element || !svg) return;

    const svgNode = svg.node();
    const t = d3.zoomTransform(svgNode);

    const elRect = element.getBoundingClientRect();
    const svgRect = svgNode.getBoundingClientRect();
    const centerScreenX = elRect.left + elRect.width / 2 - svgRect.left;
    const centerScreenY = elRect.top + elRect.height / 2 - svgRect.top;

    const [cx, cy] = t.invert([centerScreenX, centerScreenY]);

    const k = desiredScale;
    const offsetY = 190;
    const tx = width / 2 - cx * k;
    const ty = height / 2 - cy * k - offsetY;

    const targetTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
    svg.transition().duration(duration).call(zoom.transform, targetTransform);

    const group = element.closest('g');
    if (group) highlightGroupUtils(d3.select(group));
}

const cleanName = name => name.replace(/[\s\t\r\n]+/g, ' ').trim();

const findPersonByName = (targetName, result) =>
    Object.values(result).flatMap(stream =>
        Object.values(stream).flatMap(theme =>
            Object.values(theme).flatMap(team => team)
        )
    ).find(person =>
        person.Name && person.Name.trim().toLowerCase() === targetName.trim().toLowerCase()
    ) || null;

function buildOrganization(people) {
    const organization = {};
    for (const person of people) {
        let firstLevelItems = (person[firstOrgLevel] || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (firstLevelItems.length === 0) firstLevelItems = [firstLevelNA];

        let secondLevelItems = (person[secondOrgLevel] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (secondLevelItems.length === 0) secondLevelItems = [secondLevelNA];

        let thirdLevelItems = (person[thirdOrgLevel] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (thirdLevelItems.length === 0) thirdLevelItems = [thirdLevelNA];

        for (const firstLevelItem of firstLevelItems) {
            if (!organization[firstLevelItem]) organization[firstLevelItem] = {};
            for (const theme of secondLevelItems) {
                if (!organization[firstLevelItem][theme]) organization[firstLevelItem][theme] = {};
                for (const team of thirdLevelItems) {
                    if (!organization[firstLevelItem][theme][team]) organization[firstLevelItem][theme][team] = [];
                    person.Name = person.Name ? cleanName(person.Name) : person.User;
                    person.Name = cleanName(person.Name || '')
                        || (person.User || '').trim()
                        || (person[emailField] || '').trim()
                        || 'Unknown';

                    const teamArr = organization[firstLevelItem][theme][team];

                    const existingKeys = new Set(
                        teamArr.map(p => buildCompositeKey(p, emailField)).filter(Boolean)
                    );

                    let compositeKey = buildCompositeKey(person, emailField);

                    const isFullyEmptyKey = !compositeKey;

                    const isDuplicate = compositeKey ? existingKeys.has(compositeKey) : false;

                    if (!isFullyEmptyKey && !isDuplicate) {
                        teamArr.push(person);
                    }
                }
            }
        }
    }
    return organization;
}

const addGuestManagersByRole = (person, guestRole, thirdLevel, organization) => {
    if (!person[guestRole]) return;
    const guestNames = [...new Set(
        person[guestRole].split(/\n|,/).map(m => m.trim()).filter(Boolean)
    )];

    guestNames.forEach(name => {
        const manager = findPersonByName(name, organization);
        if (!manager) {
            return;
        }
        const alreadyPresent = thirdLevel.some(member => cleanName(member.Name) === cleanName(name));
        if (!alreadyPresent) {
            manager.guestRole = guestRole;
            thirdLevel.push(manager);
        }
    });
};

function addGuestManagersTo(organization) {
    const result = {};
    for (const [firstLevel, secondLevelItems] of Object.entries(organization)) {
        for (const [secondLevel, thirdLevelItems] of Object.entries(secondLevelItems)) {
            for (const [thirdLevel, members] of Object.entries(thirdLevelItems)) {
                if (!result[firstLevel]) result[firstLevel] = {};
                if (!result[firstLevel][secondLevel]) result[firstLevel][secondLevel] = {};
                if (!result[firstLevel][secondLevel][thirdLevel]) result[firstLevel][secondLevel][thirdLevel] = [];

                for (const p of members) {
                    const names = Object.values(result[firstLevel][secondLevel][thirdLevel]).map(entry => entry.Name);
                    if (!names.includes(p.Name)) result[firstLevel][secondLevel][thirdLevel].push(p);
                    guestRoleColumns.forEach(role => addGuestManagersByRole(p, role, result[firstLevel][secondLevel][thirdLevel], organization));
                }
                result[firstLevel][secondLevel][thirdLevel].sort((a, b) => {
                    const aIsGuest = guestRoleColumns.includes(a.guestRole);
                    const bIsGuest = guestRoleColumns.includes(b.guestRole);
                    if (aIsGuest && !bIsGuest) return 1;
                    if (!aIsGuest && bIsGuest) return -1;
                    return 0;
                });
            }
        }
    }
    return result;
}

function getLatestUpdateFromCsv(headers, rows) {
    if (headers.includes("Last Update")) {
        const dateIndex = headers.indexOf("Last Update");
        const dates = rows.slice(1)
            .map(row => row[dateIndex]?.trim())
            .filter(Boolean)
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()));

        if (dates.length > 0) {
            const lastUpdateEl = document.getElementById('side-last-update');
            if (lastUpdateEl) {
                lastUpdateEl.textContent = `Last Update: ${getFormattedDate(new Date(Math.max(...dates.map(d => d.getTime()))).toISOString())}`;
            }
        }
    }
}

function getContentBBox() {
    const bg = backgroundLayer?.node()?.getBBox();
    const cards = cardLayer?.node()?.getBBox();

    if (!bg && !cards) return null;
    const boxes = [bg, cards].filter(Boolean);
    const x1 = Math.min(...boxes.map(b => b.x));
    const y1 = Math.min(...boxes.map(b => b.y));
    const x2 = Math.max(...boxes.map(b => b.x + b.width));
    const y2 = Math.max(...boxes.map(b => b.y + b.height));
    return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};

}


function placeCompanyLogoUnderDiagram(url = './assets/company-logo.png', maxWidth = 240, textMargin = 40) {
    if (!viewport || !logoLayer) return;

    const bbox = getContentBBox();
    if (!bbox) {
        console.warn('Visual outcome not found');
        return;
    }

    logoLayer.selectAll('*').remove();

    const img = new Image();
    img.onload = () => {
        const aspect = img.height / img.width || 0.35;
        const width = maxWidth;
        const height = Math.round(width * aspect);

        const x = bbox.x + (bbox.width - width) / 2;
        const y = bbox.y + bbox.height + Math.max(300, bbox.height * 0.12);
        logoLayer.append('image')
            .attr('href', url)
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('pointer-events', 'none');

        logoLayer.append('foreignObject')
            .attr('x', x)
            .attr('y', y + height + textMargin)
            .attr('width', width)
            .attr('height', 100)
            .append('xhtml:div')
            .style('font-size', '10px')
            .style('font-family', '"Montserrat"', '"Sans 3", Arial, sans-serif')
            .style('text-align', 'center')
            .style('color', '#333')
            .html('<p>Author: Francesco Nicolosi</p>' +
                '<p>Personal Blog: <a href="https://www.gamerdad.cloud" target="_blank">www.gamerdad.cloud</a></p>' +
                '<p><img src="https://img.shields.io/badge/license-NonCommercial-blue.svg"></p>');

        let notZoommingToShowSearchResults = !getQueryParam("search");
        if (notZoommingToShowSearchResults) {
            fitToContent(0.9);
        }

    };
    img.onerror = () => {
        console.warn('Logo not found:', url);
    };
    img.src = url;
}


let isDraggable = false;

function applyDraggableToggleState() {
    const groups = d3.selectAll('.draggable');
    const handles = d3.selectAll('.resize-handles');
    if (isDraggable) {
        groups.call(drag);
        handles.style('display', null).style('pointer-events', 'all');
    } else {
        groups.on('.drag', null);
        handles.style('display', 'none')
            .style('pointer-events', 'none');
    }
}

document.getElementById('act-reset-layout')?.addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    window.location.reload();
});

document.getElementById('toggle-draggable')?.addEventListener('change', (e) => {
    isDraggable = e.target.checked;
    applyDraggableToggleState();
});

function extractData(csvText) {
    if (!csvText) {
        alert('Missing CSV File!');
        return;
    }
    colorKeyMappings = new Map();
    const rows = parseCSV(csvText);
    if (rows.length < 2) return;

    const headers = rows[0].map(h => h.trim());
    people = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = (row[i] || '').trim());
        return obj;
    }).filter(p => p.Status && p.Status.toLowerCase() !== 'inactive');

    let lastUpdateISO = '';
    if (headers.includes('Last Update')) {
        const idx = headers.indexOf('Last Update');
        const dates = rows.slice(1)
            .map(r => r[idx]?.trim())
            .filter(Boolean)
            .map(d => new Date(d))
            .filter(d => !isNaN(d));
        if (dates.length) {
            const maxTs = Math.max(...dates.map(d => d.getTime()));
            lastUpdateISO = new Date(maxTs).toISOString().slice(0, 10); // yyyy-mm-dd
        }
    }
    const peopleCount = people.length;
    const datasetVersion = `people:${peopleCount}|lu:${lastUpdateISO || 'n/a'}`;
    LS_KEY = `dsm-layout-v1::${datasetVersion}`;


    getLatestUpdateFromCsv(headers, rows);

    const organization = buildOrganization(people);
    const organizationWithManagers = addGuestManagersTo(organization);

    const filteredStreams = getAllowedStreamsSet();

    const allStreamNames = Object.keys(organizationWithManagers || {})
        .filter(s => s && !s.includes(firstLevelNA));

    const visibleStreamNames = (filteredStreams && filteredStreams.size > 0)
        ? allStreamNames.filter(s => filteredStreams.has(s) || filteredStreams.has(normalizeKey(s)))
        : allStreamNames;


    const visiblePeopleForLegend = getVisiblePeopleForLegend(people, filteredStreams, firstOrgLevel);

    initColorScale(ROLE_FIELD_WITH_MAPPING, visiblePeopleForLegend);
    updateLegend(colorScale, colorBy, d3);
    setColorMode(ROLE_FIELD_WITH_MAPPING);

    const inARow = 6;
    const dateValues = ["In team since"];
    const fieldsToShow = [
        "Role", "Company", "Location", "Room Link",
        ...dateValues
    ];

    const nFields = fieldsToShow.length + 0.5;
    const rowHeight = 11;
    const memberWidth = 160, cardPad = 10, cardBaseHeight = nFields * 4 * rowHeight;
    const thirdLevelBoxWidth = inARow * memberWidth + 100, thirdLevelBoxPadX = 24;
    const secondLevelBoxPadX = 60;
    const firstLevelBoxPadY = 100;

    const largestThirdLevelSize = Math.max(
        ...Object.entries(organizationWithManagers)
            .filter(([streamName]) => streamName !== firstLevelNA)
            .flatMap(([, stream]) =>
                Object.entries(stream)
                    .filter(([themeName]) => themeName !== secondLevelNA)
                    .flatMap(([, theme]) =>
                        Object.values(theme).map(team =>
                            new Set(team.map(m => m.Name?.trim()).filter(Boolean)).size
                        )
                    )
            )
    );

    const rowCount = Math.ceil(largestThirdLevelSize / inARow);
    const thirdLevelBoxHeight = rowCount * cardBaseHeight * 1.2 + 80;
    const secondLevelBoxHeight = thirdLevelBoxHeight * 1.2 + 100;

    let streamY = 40;
    let streamX = 40;

    Object.entries(organizationWithManagers).forEach(([firstLevel, secondLevelItems]) => {
        if (firstLevel.includes(firstLevelNA)) return;
        const streamTeamSizes = Object.entries(secondLevelItems)
            .filter(([themeName]) => !themeName.includes(secondLevelNA))
            .flatMap(([, themeObj]) =>
                Object.values(themeObj).map(members =>
                    new Set(members.map(m => (m.Name || '').trim()).filter(Boolean)).size
                )
            );

        const streamLargestThirdLevelSize = Math.max(1, ...(streamTeamSizes.length ? streamTeamSizes : [1]));
        const streamRowCount = Math.ceil(streamLargestThirdLevelSize / inARow);

        const streamThirdLevelBoxHeight = streamRowCount * cardBaseHeight * 1.2 + 80;
        const streamSecondLevelBoxHeight = streamThirdLevelBoxHeight * 1.2 + 100;

        if (filteredStreams) {
            const firstLevelNormalized = normalizeKey(firstLevel);
            const isAllowed =
                filteredStreams.has(firstLevel) || filteredStreams.has(firstLevelNormalized);
            if (!isAllowed) return;
        }

        const firstLevelMembers =
            Object.values(organization[firstLevel] || {})
                .flatMap(themeObj => Object.values(themeObj))
                .flat();

        const firstLevelDescription = aggregateInfoByHeader(firstLevelMembers, headers, "Team Stream Description")?.items?.join("") ?? '';

        const firstLevelBoxWidth = computeStreamBoxWidthWrapped(
            secondLevelItems,
            secondLevelBoxPadX,
            secondLevelNA,
            thirdLevelBoxPadX,
            thirdLevelBoxWidth,
        );


        let secondLevelX = 60;

        const firstLevelGroup = streamLayer.append('g')
            .attr('class', 'draggable')
            .attr('transform', `translate(${streamX},${streamY})`)
            .attr('data-key', `stream::${normalizeKey(firstLevel)}`);

        restoreGroupPosition(firstLevelGroup);

        const numThemesInStream = Object.entries(secondLevelItems)
            .filter(([themeKey]) => !themeKey.includes(secondLevelNA)).length;

        const themeRows = Math.ceil(numThemesInStream / THEMES_PER_ROW);
        const firstLevelBoxHeight = themeRows * (streamSecondLevelBoxHeight + secondLevelRowPadY) + 140;

        const streamRect = firstLevelGroup.append('rect')
            .attr('class', 'stream-box')
            .attr('width', firstLevelBoxWidth)
            .attr('height', firstLevelBoxHeight)
            .attr('rx', 40)
            .attr('ry', 40);

        makeResizable(firstLevelGroup, streamRect, {
            minWidth: 600,
            minHeight: 300,
            onResize: () => {
                console.log('resizing')
            }
        });

        const titleText = firstLevelGroup.append('text')
            .attr('x', 50)
            .attr('y', 70)
            .attr('text-anchor', 'start')
            .attr('class', 'stream-title');

        titleText.append('tspan')
            .attr('class', 'stream-title')
            .text(firstLevel);

        titleText.append('tspan')
            .attr('dx', 10)
            .text('');

        if (firstLevelDescription !== "") {
            titleText.append('tspan')
                .attr('class', 'stream-icon stream-icon--desc')
                .text(' ℹ️')
                .on('click', (e) => {
                    e?.stopPropagation?.();
                    openDrawer({name: firstLevel, description: firstLevelDescription});
                });

            titleText.append('tspan')
                .attr('dx', 10)
                .text('');
        }

        if (visibleStreamNames.length > 1) {
            titleText.append('tspan')
                .attr('class', 'stream-icon stream-icon--hide')
                .text(' 🚫')
                .on('click', (e) => {
                    e?.stopPropagation?.();

                    const others = visibleStreamNames.filter(
                        s => normalizeKey(s) !== normalizeKey(firstLevel)
                    );

                    const url = new URL(window.location.href);
                    if (others.length > 0) {
                        url.searchParams.set('stream', others.join(','));
                    } else {
                        url.searchParams.delete('stream');
                    }
                    window.location.href = url.toString();
                });
        }


        if (firstLevelDescription !== "") {
            firstLevelGroup.select('rect.stream-box')
                .style('cursor', 'pointer')
                .on('click', () => openDrawer({
                    name: firstLevel,
                    description: firstLevelDescription
                }));

            firstLevelGroup.select('text.stream-title')
                .style('cursor', 'pointer')
                .on('click', () => openDrawer({
                    name: firstLevel,
                    description: firstLevelDescription
                }));
        }


        let visibleIdx = 0;

        Object.entries(secondLevelItems).forEach(([secondLevel, thirdLevelItems]) => {
            if (secondLevel.includes(secondLevelNA)) return;

            const themeRow = Math.floor(visibleIdx / THEMES_PER_ROW);
            const themeCol = visibleIdx % THEMES_PER_ROW;

            const originalThemeMembers = Object.values(organization[firstLevel]?.[secondLevel] || {})
                .flat()
            const secondLevelDescription = aggregateInfoByHeader(originalThemeMembers, headers, 'Team Theme Description')?.items?.join("") ?? '';


            if (themeCol === 0) {
                secondLevelX = 60;
            }

            const themeWidth = Object.keys(thirdLevelItems).length * thirdLevelBoxWidth + SECOND_LEVEL_LABEL_EXTRA;
            const secondLevelY = streamY + 100 + themeRow * (streamSecondLevelBoxHeight + secondLevelRowPadY);

            const secondLevelGroup = themeLayer.append('g')
                .attr('class', 'draggable')
                .attr('transform', `translate(${streamX + secondLevelX},${secondLevelY})`)
                .attr('data-key', `theme::${normalizeKey(firstLevel)}::${normalizeKey(secondLevel)}`);


            restoreGroupPosition(secondLevelGroup);

            const secondLevelRect = secondLevelGroup.append('rect')
                .attr('class', 'theme-box')
                .attr('width', themeWidth)
                .attr('height', streamSecondLevelBoxHeight)
                .attr('rx', 30)
                .attr('ry', 30);

            makeResizable(secondLevelGroup, secondLevelRect, {minWidth: 400, minHeight: 250});

            secondLevelGroup.append('text')
                .attr('x', themeWidth / 2)
                .attr('y', 85)
                .attr('text-anchor', 'middle')
                .attr('class', 'theme-title')
                .text(truncateString(secondLevel));

            if (secondLevelDescription !== "") {
                secondLevelGroup.select('text.theme-title')
                    .append('tspan')
                    .attr('class', 'theme-icon')
                    .attr('dx', 10)
                    .text(' ℹ️')
                    .on('click', (e) => {
                        e.stopPropagation();
                        openDrawer({name: secondLevel, description: secondLevelDescription});
                    });
            }

            if (secondLevelDescription !== "") {
                secondLevelGroup.select('rect.theme-box')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({name: secondLevel, description: secondLevelDescription}));

                secondLevelGroup.select('text.theme-title')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({name: secondLevel, description: secondLevelDescription}));
            }

            Object.entries(thirdLevelItems).forEach(([thirdLevel, members], teamIdx) => {

                const originalMembers = (organization[firstLevel]?.[secondLevel]?.[thirdLevel]) || [];

                const services = aggregateInfoByHeader(originalMembers, headers, 'Team Managed Services', true);
                const description = aggregateInfoByHeader(originalMembers, headers, 'Team Description')?.items?.join("") ?? '';
                const channels = aggregateInfoByHeader(originalMembers, headers, 'Team Channels', true)?.items;
                const email = aggregateInfoByHeader(originalMembers, headers, 'Team Email')?.items?.join("") ?? '';

                const teamLocalX = teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50;
                const teamLocalY = 130;

                const thirdLevelGroup = teamLayer.append('g')
                    .attr('class', 'draggable')
                    .attr('transform', `translate(${streamX + secondLevelX + teamLocalX},${secondLevelY + teamLocalY})`)
                    .attr('data-key', `team::${normalizeKey(firstLevel)}::${normalizeKey(secondLevel)}::${normalizeKey(thirdLevel)}`);

                restoreGroupPosition(thirdLevelGroup);

                const thirdLevelRect = thirdLevelGroup.append('rect')
                    .attr('class', 'team-box')
                    .attr('width', thirdLevelBoxWidth)
                    .attr('height', streamThirdLevelBoxHeight)
                    .attr('rx', 20)
                    .attr('ry', 20);

                makeResizable(thirdLevelGroup, thirdLevelRect, {minWidth: 360, minHeight: 220});

                const serviceCount = services?.items?.length || 0;
                const titleText = `${thirdLevel} - ⚙️ (${serviceCount})`;

                thirdLevelGroup.append('text')
                    .attr('x', thirdLevelBoxWidth / 2)
                    .attr('y', 70)
                    .attr('text-anchor', 'middle')
                    .attr('data-services', services?.items?.filter(Boolean).join(', ') || '')
                    .attr('class', 'team-title')
                    .text(truncateString(titleText));

                thirdLevelGroup.select('rect.team-box')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({name: thirdLevel, description, services, channels, email}));

                thirdLevelGroup.select('text.team-title')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({name: thirdLevel, description, services, channels, email}));


                members.forEach((member, mIdx) => {
                    const col = mIdx % inARow;
                    const row = Math.floor(mIdx / inARow);
                    const cardX = 40 + secondLevelX + teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50 + 20 + col * (memberWidth + cardPad);
                    const cardY = secondLevelY + 70 + 45 + row * (cardBaseHeight + 10) + 130;

                    const group = cardLayer.append('g')
                        .attr('data-role', (member[ROLE_FIELD_WITH_MAPPING] || '').toString().trim())
                        .attr('data-company', (member[COMPANY_FIELD] || '').toString().trim())
                        .attr('data-location', (member[LOCATION_FIELD] || '').toString().trim())
                        .attr('class', 'draggable')
                        .attr('transform', `translate(${cardX},${cardY})`)
                        .attr('data-key', `card::${normalizeKey(firstLevel)}::${normalizeKey(secondLevel)}::${normalizeKey(thirdLevel)}::${normalizeKey(member['Name'] || member['User'] || mIdx)}`);


                    const colorKey =
                        colorBy === ROLE_FIELD_WITH_MAPPING ? group.attr('data-role') :
                            colorBy === COMPANY_FIELD ? group.attr('data-company') :
                                group.attr('data-location');

                    colorKeyMappings.set(
                        colorBy,
                        (colorKeyMappings.get(colorBy) ?? new Set()).add(colorKey)
                    );

                    restoreGroupPosition(group);

                    const memberRect = group.append('rect')
                        .attr('class', 'profile-box')
                        .attr('width', memberWidth)
                        .attr('height', cardBaseHeight)
                        .attr('rx', 14)
                        .attr('ry', 14)
                        .attr('fill', getCardFill(group) ? getCardFill(group) : NEUTRAL_COLOR);

                    if (member.guestRole) {
                        memberRect.attr('stroke', '#333')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4 2');
                    }

                    function getPhotoCandidates(email) {
                        const baseName = (email.split('@')[0] || '').replace('-ext', '').replace('.', '-');

                        const fileName = `./assets/photos/${baseName}`;

                        return [
                            // `${fileName}.webp`,
                            // `${fileName}.avif`,
                            `${fileName}.jpg`,
                            `${fileName}.png`,
                            `${fileName}.jpeg`,
                        ];
                    }

                    function resolvePhoto(email, fallback = './assets/user-icon.png', timeoutMs = 4000) {
                        const candidates = getPhotoCandidates(email);

                        const tryWithTimeout = (url) => new Promise((resolve, reject) => {
                            const img = new Image();
                            const timer = setTimeout(() => {
                                img.onload = img.onerror = null;
                                reject(new Error('timeout'));
                            }, timeoutMs);

                            img.onload = () => {
                                clearTimeout(timer);
                                resolve(url);
                            };
                            img.onerror = () => {
                                clearTimeout(timer);
                                reject(new Error('error'));
                            };

                            // optional: cache-busting
                            // img.src = `${url}?t=${Date.now()}`;
                            img.src = url;
                        });

                        return candidates
                            .reduce(
                                (chain, url) => chain.catch(() => tryWithTimeout(url)),
                                Promise.reject()
                            )
                            .catch(() => fallback);
                    }

                    resolvePhoto(member[emailField]).then(photoPath => {
                        group.append('foreignObject')
                            .attr('x', (memberWidth - 60) / 2)
                            .attr('y', 8)
                            .attr('width', 60)
                            .attr('height', 60)
                            .append('xhtml:img')
                            .attr('class', 'profile-photo')
                            .attr('src', photoPath)
                            .attr('alt', 'Profile photo');
                    });

                    group.append('foreignObject')
                        .attr('x', 0)
                        .attr('y', 72)
                        .attr('width', memberWidth)
                        .attr('height', 24)
                        .append('xhtml:div')
                        .attr('class', 'profile-name')
                        .html(member['Name']);

                    const infoDiv = group.append('foreignObject')
                        .attr('x', 8)
                        .attr('y', 98)
                        .attr('width', memberWidth - 16)
                        .attr('height', cardBaseHeight - 102)
                        .append('xhtml:div')
                        .attr('class', 'info');

                    const email = member[emailField];

                    const photoSize = 60;
                    const photoX = (memberWidth - photoSize) / 2;

                    const photoY = 8;

                    const spacingX = 17;
                    const isMobile = window.matchMedia('(max-width: 480px)').matches;
                    const leftSpacingX = isMobile ? 1 : 3;
                    const fabSize = isMobile ? 28 : 24;
                    const gap = isMobile ? 3 : 8;

                    const fabsHeight = (fabSize * 2) + gap;

                    const rightX = Math.round(photoX + photoSize + spacingX);

                    const leftX  = Math.round(photoX - spacingX - fabSize - leftSpacingX);

                    const fabsY = Math.round(photoY + Math.round((photoSize - fabsHeight) / 2) - 4);

                    const isWebKit = /AppleWebKit/i.test(navigator.userAgent)
                        && /Safari/i.test(navigator.userAgent)
                        && !/(Chrome|Chromium|Edg)/i.test(navigator.userAgent);

                    const useSvgFabs = isWebKit
                        || /iPad|iPhone|iPod/i.test(navigator.userAgent)
                        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

                    const r  = fabSize / 2;
                    const cx = Math.round(rightX + fabSize / 2);
                    const cy = Math.round(fabsY + fabSize / 2);
                    const dy = fabSize + gap;

                    const lc = {
                        cx: Math.round(leftX + fabSize / 2),
                        cy: Math.round(fabsY + fabSize / 2),
                        r:  r
                    };

                    const reportClickHandler = (event) => {
                        event?.preventDefault?.();
                        event?.stopPropagation?.();
                        openPersonReportCompose(
                            peopleDBUpdateRecipients,
                            portfolioDBUpdateRecipients,
                            member,
                            { firstLevel, secondLevel, thirdLevel }
                        ).then(() => console.log('report a change started'));
                    };

                    if (useSvgFabs) {
                        const reportG = group.append('g')
                            .attr('class', 'contact-fabs-svg contact-fabs--left')
                            .attr('transform', `translate(${lc.cx},${lc.cy})`);

                        const reportA = reportG.append('a')
                            .attr('href', '#')
                            .attr('target', '_blank')
                            .attr('rel', 'noopener noreferrer')
                            .attr('class', 'contact-fab report');

                        const reportBtn = reportA.append('g').attr('transform', 'translate(0,0)');
                        reportBtn.append('circle')
                            .attr('r', lc.r)
                            .attr('class', 'fab-circle');
                        reportBtn.append('text')
                            .attr('class', 'fab-emoji')
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'central')
                            .text('📝');

                        reportA
                            .on('pointerdown', (e) => e.stopPropagation())
                            .on('touchstart', (e) => e.stopPropagation())
                            .on('click', reportClickHandler);

                        if (member[emailField]) {
                            const fabsG = group.append('g')
                                .attr('class', 'contact-fabs-svg contact-fabs--right')
                                .attr('transform', `translate(${cx},${cy})`);

                            const chatA = fabsG.append('a')
                                .attr('href', `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`)
                                .attr('target', '_blank')
                                .attr('rel', 'noopener noreferrer')
                                .attr('class', 'contact-fab chat');

                            const chatG = chatA.append('g').attr('transform', 'translate(0,0)');
                            chatG.append('circle').attr('r', r).attr('class', 'fab-circle');
                            chatG.append('text')
                                .attr('class', 'fab-emoji')
                                .attr('text-anchor', 'middle')
                                .attr('dominant-baseline', 'central')
                                .text('💬');

                            const mailA = fabsG.append('a')
                                .attr('href', createOutlookUrl([email]))
                                .attr('target', '_blank')
                                .attr('rel', 'noopener noreferrer')
                                .attr('class', 'contact-fab mail');

                            const mailG = mailA.append('g').attr('transform', `translate(0, ${dy})`);
                            mailG.append('circle').attr('r', r).attr('class', 'fab-circle');
                            mailG.append('text')
                                .attr('class', 'fab-emoji')
                                .attr('text-anchor', 'middle')
                                .attr('dominant-baseline', 'central')
                                .text('✉️');

                            fabsG.selectAll('a.contact-fab')
                                .on('pointerdown', (event) => event.stopPropagation())
                                .on('touchstart', (event) => event.stopPropagation());
                        }
                    } else {
                        const fabsLeft = group.append('foreignObject')
                            .attr('x', leftX)
                            .attr('y', fabsY)
                            .attr('width', fabSize)
                            .attr('height', fabSize)
                            .attr('pointer-events', 'all')
                            .style('overflow', 'visible')
                            .append('xhtml:div')
                            .attr('class', 'contact-fabs contact-fabs--left');

                        fabsLeft.append('a')
                            .attr('class', 'contact-fab report')
                            .attr('href', '#')
                            .attr('data-tooltip', 'Report change')
                            .attr('aria-label', 'Report change')
                            .html(`<span class="icon" aria-hidden="true">📝</span>`)
                            .on('click', reportClickHandler);

                        if (member[emailField]) {
                            const fabs = group.append('foreignObject')
                                .attr('x', rightX)
                                .attr('y', fabsY)
                                .attr('width', fabSize)
                                .attr('height', fabsHeight)
                                .attr('pointer-events', 'all')
                                .style('overflow', 'visible')
                                .append('xhtml:div')
                                .attr('class', 'contact-fabs contact-fabs--right');

                            fabs.append('a')
                                .attr('class', 'contact-fab chat')
                                .attr('href', `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`)
                                .attr('target', '_blank')
                                .attr('rel', 'noopener noreferrer')
                                .attr('data-tooltip', 'Chat')
                                .attr('aria-label', 'Chat')
                                .html(`<span class="icon" aria-hidden="true">💬</span>`);

                            fabs.append('a')
                                .attr('class', 'contact-fab mail')
                                .attr('href', createOutlookUrl([email]))
                                .attr('target', '_blank')
                                .attr('rel', 'noopener noreferrer')
                                .attr('data-tooltip', 'Send email')
                                .attr('aria-label', 'Send email')
                                .html(`<span class="icon" aria-hidden="true">✉️</span>`);
                        }
                    }
                    Object.entries(member).forEach(([key, value]) => {
                        if (fieldsToShow.includes(key) && value) {
                            let finalValue = value;

                            if (dateValues.includes(key)) {
                                const parsed = new Date(value);
                                if (!isNaN(parsed)) {
                                    finalValue = formatMonthYear(parsed);
                                }
                            }

                            infoDiv.append('div')
                                .attr('class', key.toLowerCase() + '-field')
                                .html(`<strong>${key}:</strong> ${finalValue}`);
                        }
                    });
                });
            });

            secondLevelX += themeWidth + secondLevelBoxPadX;
            visibleIdx++
        });

        streamY += firstLevelBoxHeight + firstLevelBoxPadY;
    });

    requestAnimationFrame(() => {
        placeCompanyLogoUnderDiagram('./assets/company-logo.png', 200, 50);
    });

    fitToContent(0.9);

    applyDraggableToggleState();
}

document.getElementById('fileInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        resetVisualization();
        extractData(evt.target.result);
    };
    reader.readAsText(file, 'UTF-8');
});

(function setupGlobalTooltip() {
    let tipEl = null;
    let showTimer = null;
    let hideTimer = null;
    let currentAnchor = null;

    const SHOW_DELAY = 90;
    const HIDE_DELAY = 140;

    const isMouseLike = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function ensureTip() {
        if (!tipEl) {
            tipEl = document.createElement('div');
            tipEl.className = 'solitaire-tooltip';
            document.body.appendChild(tipEl);
        }
        tipEl.style.zIndex = String(2147483647);
        return tipEl;
    }

    function isVisible() {
        return !!(tipEl && tipEl.classList.contains('show'));
    }

    function positionTip(anchor, placement = 'right') {
        const el = ensureTip();
        const rect = anchor.getBoundingClientRect();

        let x = rect.right + 8;
        let y = rect.top + rect.height / 2;
        el.style.transform = 'translate(0, -50%)';

        if (placement === 'top') {
            x = rect.left + rect.width / 2;
            y = rect.top - 8;
            el.style.transform = 'translate(-50%, -8px)';
        } else if (placement === 'bottom') {
            x = rect.left + rect.width / 2;
            y = rect.bottom + 8;
            el.style.transform = 'translate(-50%, 8px)';
        } else if (placement === 'left') {
            x = rect.left - 8;
            y = rect.top + rect.height / 2;
            el.style.transform = 'translate(-100%, -50%)';
        }

        el.style.left = `${Math.round(x)}px`;
        el.style.top = `${Math.round(y)}px`;
    }

    function showTip(text, anchor, placement = 'right') {
        const el = ensureTip();
        el.textContent = text || '';
        el.classList.add('show');
        positionTip(anchor, placement);
    }

    function hideTipNow() {
        if (tipEl) tipEl.classList.remove('show');
    }

    function getFabAnchor(target) {
        return target?.closest?.('.contact-fab') || null;
    }

    if (isMouseLike) {
        document.addEventListener('mouseover', (e) => {
            const a = getFabAnchor(e.target);
            if (!a) return;

            const text = a.getAttribute('data-tooltip') || a.getAttribute('aria-label') || '';
            if (!text) return;

            clearTimeout(hideTimer);
            hideTimer = null;

            if (isVisible() && currentAnchor !== a) {
                currentAnchor = a;
                showTip(text, a, 'right');
                return;
            }

            currentAnchor = a;
            clearTimeout(showTimer);
            showTimer = setTimeout(() => showTip(text, a, 'right'), SHOW_DELAY);
        }, true);

        document.addEventListener('mouseout', (e) => {
            const a = getFabAnchor(e.target);
            if (!a) return;

            clearTimeout(showTimer);

            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                hideTipNow();
                currentAnchor = null;
            }, HIDE_DELAY);
        }, true);

        window.addEventListener('scroll', () => {
            if (isVisible()) hideTipNow();
        }, {passive: true});
        window.addEventListener('resize', () => {
            if (isVisible()) hideTipNow();
        });
        window.addEventListener('dsm-canvas-zoom', () => {
            if (isVisible()) hideTipNow();
        });
    } else {
        document.addEventListener('pointerdown', hideTipNow, {passive: true});
    }
})();


document.getElementById('drawer-search-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        if (query) {
            searchByQuery(query);
        } else {
            clearSearch();
        }
        e.preventDefault();
    }
});

function searchByQuery(query) {
    if (!query) return;

    const searchInput = document.getElementById('drawer-search-input');
    if (!searchInput.value) {
        searchInput.value = query;
    }

    const nodes = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title, .stream-title, .role-field, .company-field, .location-field, [data-services]'));

    const matches = nodes.filter(n => {
        const textMatch = n.textContent ? n.textContent.toLowerCase().includes(query) || n.textContent.toLowerCase().includes(truncateString(query)) : false;
        const attrMatch = n.getAttribute('data-services')?.toLowerCase().includes(query);
        return textMatch || attrMatch;
    });

    if (matches.length === 0) {
        clearSearchDimming();
        showToast(`No result found for ${query}`);
        return;
    }

    if (matches.length === 0) {
        showToast(`No result found for ${query}`);
        return;
    }

    if (query === lastSearch) {
        currentIndex = (currentIndex + 1) % matches.length;
    } else {
        lastSearch = query;
        currentIndex = 0;
    }

    const target = matches[currentIndex];
    clearFieldHighlights();
    closeDrawer();

    zoomToElement(target, 1, 600);
    applySearchDimmingForMatches(matches);
    showToast(`Found ${matches.length} result(s). Showing ${currentIndex + 1}/${matches.length}.`);
    setSearchQuery(query);

    const FIELD_CLASSES = ['role-field', 'company-field', 'location-field'];
    if (target.classList) {
        const hitClass = FIELD_CLASSES.find(c => target.classList.contains(c));
        if (hitClass) {
            target.classList.add('field-hit-highlight');
        } else {
            const group = target.closest('g[data-key^="card::"]');
            if (group) {
                const qn = (query || '').trim().toLowerCase();
                FIELD_CLASSES.forEach(cls => {
                    const el = group.querySelector('.' + cls);
                    if (!el) return;
                    const tn = (el.textContent || '').toLowerCase();
                    if (qn && tn.includes(qn)) {
                        el.classList.add('field-hit-highlight');
                    }
                });
            }
        }
    }

    try {
        const group = target.closest('g');
        const teamTitleEl = group ? group.querySelector('text.team-title') : null;
        if (!teamTitleEl) return;

        const rawServices = (teamTitleEl.getAttribute('data-services') || '')
            .split(',').map(s => s.trim()).filter(Boolean);
        if (rawServices.length === 0) return;

        const norm = v => (v || '').toString().trim().toLowerCase();
        const q = norm(query);
        const normalized = rawServices.map(s => ({raw: s, norm: norm(s)}));
        const hit = normalized.find(svc => svc.norm.includes(q));
        if (!hit) return;

        const teamName =
            teamTitleEl.getAttribute('data-team-name') || getNameFromTitleEl(teamTitleEl);
        const email = teamTitleEl.getAttribute('data-team-email') || '';
        const channels = (() => {
            try {
                return JSON.parse(teamTitleEl.getAttribute('data-team-channels') || '[]');
            } catch {
                return [];
            }
        })();
        const description = teamTitleEl.getAttribute('data-team-description') || '';

        openDrawer({
            name: teamName,
            description,
            services: {items: rawServices},
            channels,
            email,
            highlightService: hit.raw,
            highlightQuery: query
        });

    } catch (e) {

        console.warn('Drawer open/highlight skipped:', e);

    }

}