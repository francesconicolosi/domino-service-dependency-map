import * as d3 from 'd3';

import {
    getQueryParam,
    setSearchQuery,
    closeSideDrawer,
    initCommonActions,
    getFormattedDate,
    createFormattedLongTextElementsFrom, getCellValue, refreshDrawerColumnIcons, splitValues, isUrl
} from './utils.js';


let nodes = [];
let links = [];
let sortKey = null;
let sortDir = 'asc';

const uniqueIds = ["id", "Name"];

function parseSortParam(param) {
    if (!param) return null;
    const [rawLabel, rawDir] = param.split(':');
    const key = normalizeColumnToken(decodeURIComponent(rawLabel || ''));
    if (!key) return null;
    const dir = (rawDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    return { key, dir };
}

function syncSortParamInUrl() {
    const url = new URL(window.location.href);
    const isListVisible = document.getElementById('list-view')?.style.display === 'block';
    if (!isListVisible || !sortKey) {
        url.searchParams.delete('sort');
    } else {
        // Etichetta della chiave come in header (ID per 'id', altrimenti la chiave stessa)
        url.searchParams.set('sort', `${encodeURIComponent(labelForKey(sortKey))}:${sortDir}`);
    }
    window.history.replaceState({}, '', url.toString());
}

function getComparableValue(n, key) {
    if (key === 'id') return (n.id ?? '').toString().toLowerCase();

    const raw = n?.[key] ?? '';
    if (key === 'Decommission Date') {
        const t = Date.parse(raw);
        return isNaN(t) ? Number.NEGATIVE_INFINITY : t; // numerico per confronti
    }
    return String(raw).toLowerCase();
}

function getSortIndicator(key) {
    if (key !== sortKey) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
}


const LABEL_FOR_KEY = {
    id: 'ID'
};

const descriptionFields = ['Contingency and Recovery Planning', 'Description'];

function normalizeColumnToken(token) {
    if (!token) return null;
    const t = token.trim();
    if (!t) return null;

    if (/^(id|ID|Service Name)$/i.test(t)) return 'id';

    return t;
}

function labelForKey(key) {
    if (key === 'id') return LABEL_FOR_KEY.id;
    return key;
}

function serializeColumnsToParam(keys) {
    const tokens = keys.map(k => (k === 'id' ? LABEL_FOR_KEY.id : k));
    return tokens.join(',');
}

function parseListViewParam(param) {
    if (!param) return null;
    return param
        .split(',')
        .map(s => normalizeColumnToken(decodeURIComponent(s)))
        .filter(Boolean);
}

const DEFAULT_COLUMN_KEYS = [
    'id',
    'Description',
    'Type',
    'Depends on',
    'Status',
    'Decommission Date'
];

let currentColumnKeys = [...DEFAULT_COLUMN_KEYS];

function syncListViewParamInUrl() {
    const url = new URL(window.location.href);
    if (!currentColumnKeys.length) {
        url.searchParams.delete('listView');
    } else {
        url.searchParams.set('listView', serializeColumnsToParam(currentColumnKeys));
    }
    window.history.replaceState({}, '', url.toString());
}

function toggleColumn(key) {
    const idx = currentColumnKeys.indexOf(key);
    if (idx >= 0) {
        if (currentColumnKeys.length === 1) return; // evita di rimanere senza colonne
        currentColumnKeys.splice(idx, 1);
    } else {
        currentColumnKeys.push(key);
    }
    syncListViewParamInUrl();

    if (document.getElementById('list-view')?.style.display === 'block') {
        renderListFromSearch();
    }
    refreshDrawerColumnIcons();
}


let hideStoppedServices = !(document.getElementById('toggle-decommissioned').checked);
let searchTerm = "";
let activeServiceNodes;
let activeServiceNodeIds;
let linkGraph;
let nodeGraph;
let labels;
let currentSearchedNodes = new Set();
let currentNodes = [];
let simulation;
let g;
let zoom;
let zoomIdentity;
let svg;
let clickedNode;
let hasLoaded = false;
const width = document.getElementById('map').clientWidth;
const height = document.getElementById('map').clientHeight;

const searchableAttributesOnPeopleDb = ["Product Theme", "Owner"];
const defaultSearchKey = "id";

const serviceInfoEnhancers = [
    function generateIssueTrackingTool(node) {
        if (!node.id) return null;


        const rawId = (node?.id ?? '').toLowerCase().trim();
        const noSpaces = rawId.replace(/\s+/g, '');
        const noPunct = noSpaces.replace(/[^\w]/g, '');
        const keepHyphen = noSpaces.replace(/[^\w-]/g, '');
        const hyphenToUnderscore = keepHyphen
            .replace(/-/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        const values = Array.from(new Set([noPunct, keepHyphen, hyphenToUnderscore].filter(Boolean)));
        const inList = values.map(v => `"${v}"`).join(', ');

        const jql = `
  (
    project = "ShareProject" AND statusCategory in (EMPTY, "To Do", "In Progress")
    OR
    project = GDT AND statusCategory in (EMPTY, "To Do", "In Progress")
    AND labels in (bug-from-incident, from_l1_portal) AND issuetype = Bug
  )
  AND "Theme[Checkboxes]" in (Theme1, Theme2)
  AND cf[14139] in (${inList})
  ORDER BY created ASC
`.replace(/\s+/g, ' ').trim();

        const jiraUrl = `https://sharetool.sharecompany.net/issues/?jql=${encodeURIComponent(jql)}`;

        return {
            key: "Jira Issues",
            value: jiraUrl,
        }
    }
];


function centerAndZoomOnNode(node) {
    const scale = 1;
    const x = -node.x * scale + width / 2;
    const y = -node.y * scale + height / 2;


    const transform = zoomIdentity
        .translate(x, y)
        .scale(scale)
        .translate(-0, -0);

    svg.transition().duration(750).call(
        zoom.transform,
        transform
    );
}

function resetVisualization() {
    d3.select('#map').selectAll('*').remove();
    d3.select('#tooltip').style('opacity', 0);
    d3.select('#legend').selectAll('*').remove();
    d3.select('#serviceDetails').innerHTML = '';
    nodes = [];
    links = [];
    linkGraph = null;
    nodeGraph = null;
    labels = [];
    hideStoppedServices = true;
    searchTerm = "";
    activeServiceNodes = [];
    activeServiceNodeIds = [];
}

function fitGraphToViewport(paddingRatio = 0.90) {
    if (!svg || !g) return;
    const bbox = g.node()?.getBBox();
    if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) {
        // reset zoom se bbox non valido
        svg.call(zoom.transform, d3.zoomIdentity);
        return;
    }
    const w = width;
    const h = height;
    const scale = Math.min(w / bbox.width, h / bbox.height) * paddingRatio;

    const tx = w / 2 - (bbox.x + bbox.width / 2) * scale;
    const ty = h / 2 - (bbox.y + bbox.height / 2) * scale;

    const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
    svg.transition().duration(400).call(zoom.transform, t);
}

function handleQuery(q, showDrawer = true) {
    clickedNode = null;
    searchTerm = q;
    const searchInput = document.getElementById('drawer-search-input');
    if (searchInput) searchInput.value = q;
    setSearchQuery(q);
    updateVisualization(nodeGraph, linkGraph, labels, showDrawer);
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function initSideDrawerEvents() {
    initCommonActions();

    document.getElementById('act-clear')?.addEventListener('click', () => {
        clickedNode = null;
        searchTerm = '';
        const searchInput = document.getElementById('drawer-search-input');
        if (searchInput) searchInput.value = '';
        setSearchQuery('');
        updateVisualization(nodeGraph, linkGraph, labels);
        fitGraphToViewport(0.9);
        closeSideDrawer();
    });

    document.getElementById('toggle-decommissioned')?.addEventListener('change', (e) => {
        clickedNode = null;
        hideStoppedServices = !(e.target.checked);
        updateVisualization(nodeGraph, linkGraph, labels);
        //closeSideDrawer();
    });

    document.getElementById('act-fit')?.addEventListener('click', () => {
        fitGraphToViewport(0.9);
        closeSideDrawer();
    });

    document.getElementById('drawer-search-go')?.addEventListener('click', () => {
        const q = e.target.value ? e.target.value.trim() : "";
        handleQuery(q, false);
        //closeSideDrawer();
    });

    document.getElementById('drawer-search-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = e.target.value?.trim();
            if (q) {
                handleQuery(q, false);
            }
            e.preventDefault();
            //closeSideDrawer();
        }
    });
}

window.addEventListener('DOMContentLoaded', initSideDrawerEvents);

document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
document.getElementById('overlay').addEventListener('click', closeDrawer);

function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
}


document.getElementById('fileInput').addEventListener('change', function (event) {
    resetVisualization();
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const csvData = e.target.result;
        const data = d3.csvParse(csvData);
        processData(data);
        updateVisualization(nodeGraph, linkGraph, labels);
    };
    reader.readAsText(file);
});

function activateInitialListViewIfNeeded() {
    const listViewParam = getQueryParam('listView');
    const sortParam = getQueryParam('sort');
    const parsedSort = parseSortParam(sortParam);
    if (parsedSort && (!currentColumnKeys.length || currentColumnKeys.includes(parsedSort.key))) {
        sortKey = parsedSort.key;
        sortDir = parsedSort.dir;
    }
    if (listViewParam) {
        toListView();
    }
}

window.addEventListener('load', function () {
    let searchParam = null;
    const searchInput = document.getElementById('drawer-search-input');

    const listViewParam = getQueryParam('listView');
    const parsedCols = parseListViewParam(listViewParam);
    if (parsedCols && parsedCols.length) {
        currentColumnKeys = parsedCols;
    } else {
        currentColumnKeys = [...DEFAULT_COLUMN_KEYS];
    }

    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample_services.csv')
        .then(response => {
            searchParam = getQueryParam('search')
            if (searchParam) {
                searchTerm = searchParam;
                if (searchInput) searchInput.value = searchParam;
            }
            return response.text();
        })
        .then(csvData => {
            const data = d3.csvParse(csvData);
            processData(data);
            const afterInit = () => {
                const showDrawer =  typeof searchParam === 'string' && uniqueIds.includes(searchParam.split(':')[0]);
                updateVisualization(nodeGraph, linkGraph, labels, showDrawer);
                if (listViewParam) {
                    toListView();
                    syncListViewParamInUrl();
                    syncSortParamInUrl();
                }
            };
            if (searchParam) {
                simulation.on('end', () => {
                    if (!hasLoaded) {
                        hasLoaded = true;
                        afterInit();
                    }
                });
            } else {
                afterInit();
            }
        })
        .catch(error => console.error('Error loading the CSV file:', error));
});

function processData(data) {
    const requiredColumns = ['Service Name', 'Description', 'Type', 'Depends on', 'Status', 'Decommission Date'];
    const missingColumns = requiredColumns.filter(col => !data.columns.includes(col));

    if (missingColumns.length > 0) {
        alert(`Missing mandatory columns: ${missingColumns.join(', ')}`);
        return;
    }

    if (data.columns.includes('Last Update')) {
        const validDates = data
            .map(d => new Date(d['Last Update']))
            .filter(date => !isNaN(date.getTime()));

        if (validDates.length > 0) {
            const lastUpdateEl = document.getElementById('side-last-update');
            if (lastUpdateEl) {
                lastUpdateEl.textContent = `Last Update: ${getFormattedDate(new Date(Math.max(...validDates.map(d => d.getTime()))).toISOString())}`;
            }
        }
    }

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    nodes = data.map(d => {
        const node = {id: d['Service Name'], color: colorScale(d['Type'])};
        for (const key in d) {
            node[key] = d[key];
        }
        return node;
    });
    const nodeIds = new Set(nodes.map(d => d.id));
    links = data.flatMap(d => [
        ...d['Depends on'].split('\n').map(dep => nodeIds.has(dep) ? {source: d['Service Name'], target: dep} : null)
    ]).filter(link => link !== null);

    activeServiceNodes = nodes.filter(d => (d.Status !== 'Stopped' && d.Status !== 'Decommissioned' && !d['Decommission Date']));
    activeServiceNodeIds = new Set(activeServiceNodes.map(d => d.id));

    createMap();
    createLegend(colorScale);
}

function getTermToCompare(term) {
    return term.replaceAll('\n', '').replaceAll(' ', '').toLowerCase();
}

function isSearchResultWithKeyValue(node) {
    if (!searchTerm.includes(":")) return false;
    const isNegation = searchTerm.trim().startsWith("!");
    const term = isNegation ? searchTerm.trim().slice(1) : searchTerm.trim();

    const isAccurateSearch = term.includes('"');
    const termClean = isAccurateSearch ? term.replaceAll('"', '') : term;

    const parts = termClean.split(':');
    if (parts.length !== 2) return false;

    const key = parts[0];
    if (!Object.keys(node).includes(key)) return false;

    const rawValue = parts[1].trim();

    if (isNegation && rawValue === "") {
        return (node[key] ?? "").trim() !== "";
    }

    const expectedValues = rawValue.split(',')
        .map(v => getTermToCompare(v.trim()));

    const nodeData = getTermToCompare(node[key] ?? "");

    const matches = expectedValues.some(value =>
        isAccurateSearch ? nodeData === value : nodeData.includes(value)
    );
    return isNegation ? !matches : matches;
}


function isSearchResultValueOnly(d) {
    if (searchTerm === "" || searchTerm.includes(":")) return false;

    const terms = searchTerm.toLowerCase().split(',').map(term => term.trim());

    return Object.values(d).some(value =>
        typeof value === 'string' &&
        terms.some(term => value.toLowerCase().includes(term))
    );
}

const mapEl      = document.getElementById('map');
const listViewEl = document.getElementById('list-view');
const legendEl   = document.getElementById('legend');
const btnList    = document.getElementById('view-list');
const btnGraph   = document.getElementById('view-graph');

function toListView() {
    mapEl.style.display = 'none';
    if (legendEl) legendEl.style.display = 'none';
    listViewEl.style.display = 'block';

    btnList.style.display  = 'none';
    btnGraph.style.display = 'inline-block';

    syncListViewParamInUrl();
    syncSortParamInUrl();

    renderListFromSearch();
}

function toGraphView() {
    mapEl.style.display = 'block';
    if (legendEl) legendEl.style.display = '';
    listViewEl.style.display = 'none';

    btnGraph.style.display = 'none';
    btnList.style.display  = 'inline-block';

    const url = new URL(window.location.href);
    url.searchParams.delete('listView');
    url.searchParams.delete('sort');
    window.history.replaceState({}, '', url.toString());
}

btnList.addEventListener('click', toListView);
btnGraph.addEventListener('click', toGraphView);

function renderListFromSearch() {
    if (!currentNodes) {
        listViewEl.innerHTML = `<p class="empty-state">No data available.</p>`;
        return;
    }

    let results = currentNodes.filter(n => currentSearchedNodes?.has?.(n.id));

    const isListVisible = listViewEl.style.display === 'block';
    const noSearch = (searchTerm === "" || !searchTerm);
    if (isListVisible && noSearch && results.length === 0) {
        results = [...currentNodes];
    }

    listViewEl.innerHTML = '';

    if (sortKey) {
        results = results.slice().sort((a, b) => {
            const va = getComparableValue(a, sortKey);
            const vb = getComparableValue(b, sortKey);
            let cmp = 0;
            if (sortKey === 'Decommission Date' && typeof va === 'number' && typeof vb === 'number') {
                cmp = (va === vb ? 0 : (va < vb ? -1 : 1));
            } else {
                cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }

    if (!results.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No results after your filtered search.';
        listViewEl.appendChild(empty);
        return;
    }

    //if (!currentColumnKeys.length) {
    //    listViewEl.innerHTML = `<p class="empty-state">Nessuna colonna selezionata. Usa il drawer per aggiungerne (+).</p>`;
    //    return;
    //}

    const table = document.createElement('table');
    table.className = 'result-table';
    table.style.setProperty('--cols', String(currentColumnKeys.length));

    // --- HEADER con pulsanti "−" per ogni colonna visibile ---
    const thead = document.createElement('thead');

// Event delegation: intercetta click sui pulsanti - in header
    thead.addEventListener('click', (e) => {
        const btn = e.target.closest('.col-op');
        if (btn) {
            e.preventDefault(); e.stopPropagation();
            const col = decodeURIComponent(btn.getAttribute('data-col'));
            toggleColumn(col);
            return;
        }
        const title = e.target.closest('.th-title');
        if (title) {
            const th = title.closest('th');
            const col = th?.getAttribute('data-col');
            if (!col) return;
            if (sortKey === col) {
                sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
            } else {
                sortKey = col;
                sortDir = 'asc';
            }
            syncSortParamInUrl();         // ⬅️ aggiorna sempre l’URL al click
            renderListFromSearch();       // ricalcola
        }
    });

    const trh = document.createElement('tr');

    currentColumnKeys.forEach(key => {
        const th = document.createElement('th');
        th.setAttribute('data-col', key);

        const cellWrap = document.createElement('div');
        cellWrap.className = 'th-cell';

        const title = document.createElement('button');  // focusable
        title.className = 'th-title fade-link';
        title.type = 'button';
        title.textContent = `${labelForKey(key)}${getSortIndicator(key)}`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'col-op fade-link';
        removeBtn.type = 'button';
        removeBtn.textContent = '−';
        removeBtn.setAttribute('data-col', encodeURIComponent(key));
        removeBtn.setAttribute('aria-label', `Remove "${labelForKey(key)}" from list view`);

        cellWrap.appendChild(title);
        cellWrap.appendChild(removeBtn);
        th.appendChild(cellWrap);
        trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    results.forEach(n => {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'button');
        tr.tabIndex = 0;

        const openDetails = () => {
            clickedNode = n;
            if (window.d3 && window.labels) {
                labels.classed('highlight', d => d.id === n.id);
            }
            showNodeDetails(n, true);
        };

        tr.addEventListener('click', openDetails);
        tr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetails();
            }
        });

        currentColumnKeys.forEach(key => {
            const td = document.createElement('td');
            const raw = (key === 'id') ? (n.id ?? '') : (n[key] ?? '');

            if (typeof raw === 'string' && raw) {
                const parts = splitValues(raw);

                if (parts.some(p => isUrl(p))) {
                    if (parts.length > 1) {
                        const ul = document.createElement('ul');
                        parts.forEach(p => {
                            const li = document.createElement('li');
                            li.innerHTML = isUrl(p) ? getLink(p) : p;   // getLink = stesso tronco del drawer
                            ul.appendChild(li);
                        });
                        td.appendChild(ul);
                    } else {
                        td.innerHTML = getLink(parts[0]);
                    }
                } else if (descriptionFields.includes(key)) {
                    td.innerHTML = "";
                    createFormattedLongTextElementsFrom(raw)
                        .forEach(el => td.appendChild(el));
                } else {
                    const uniqueParts = splitValues(raw);
                    td.textContent = uniqueParts.join(', ');
                }
            } else {
                td.textContent = getCellValue(n, key);
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    listViewEl.appendChild(table);
}

function focusNodeOnGraph(nodeId) {
    if (window.d3 && window.labels) {
        labels.classed('highlight', d => d.id === nodeId);
        // centerOnNode(nodeId);
    }
}


function updateVisualization(node, link, labels, showDrawer = true) {
    let relaxedSearchEnabled = document.getElementById('relaxed-search').checked;
    if (searchTerm !== "" && !searchTerm.includes(":") && !searchTerm.includes(",") && !relaxedSearchEnabled) {
        searchTerm = `${defaultSearchKey}:"${searchTerm}"`;
        const searchInput = document.getElementById('drawer-search-input');
        if (searchInput) searchInput.value = searchTerm;
        setSearchQuery(searchTerm);
    }

    const filteredLinks = links.filter(link => activeServiceNodeIds.has(link.source.id) && activeServiceNodeIds.has(link.target.id));
    const relatedNodes = new Set();
    const searchedNodes = new Set();
    const relatedLinks = links.filter(link => {
        let isLinkStatusOk = !hideStoppedServices || (filteredLinks.includes(link));
        let isSearchedLink = searchTerm === "";
        if (isSearchResultValueOnly(link.source) || isSearchResultWithKeyValue(link.source)) {
            isSearchedLink = isSearchedLink || true;
            searchedNodes.add(link.source.id);
        }

        if (isSearchResultValueOnly(link.target) || isSearchResultWithKeyValue(link.target)) {
            isSearchedLink = isSearchedLink || true;
            searchedNodes.add(link.target.id);
        }

        if (isLinkStatusOk && isSearchedLink) {
            relatedNodes.add(link.source.id);
            relatedNodes.add(link.target.id);
            return true;
        }
        return false;
    });

    let nodeToZoom;

    node.each(d => {
        if (isSearchResultWithKeyValue(d)) {
            nodeToZoom = d;
            relatedNodes.add(d.id);
        } else if (relaxedSearchEnabled && isSearchResultValueOnly(d)) {
            relatedNodes.add(d.id);
        }
    });

    node.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
    link.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.source.id) && activeServiceNodeIds.has(d.target.id)) || relatedLinks.includes(d) ? 'block' : 'none');
    labels.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
    labels.style('text-decoration', d => searchedNodes.has(d.id) ? 'underline' : 'none');
    currentNodes = nodes;
    currentSearchedNodes = searchedNodes;


    if (document.getElementById('list-view')?.style.display === 'block') {
        renderListFromSearch();
    } else if (!clickedNode && nodeToZoom && (!hideStoppedServices || activeServiceNodeIds.has(nodeToZoom.id))) {
        centerAndZoomOnNode(nodeToZoom);
        showNodeDetails(nodeToZoom, showDrawer);
    }
}

function zoomed({transform}) {
    g.attr("transform", transform);
}

function getPeopleDbLink(value) {
    return `<a href="solitaire.html?search=${encodeURIComponent(value.toLowerCase()).replace(/%20/g, '+')}" target = "_blank" >${value}</a>`;
}


function getLink(value) {
    let cleanValue = value.replace(/^https?:\/\//, '');
    cleanValue = cleanValue.split(/[?#]/)[0];
    const segments = cleanValue.split('/').filter(Boolean);
    const segment = segments.length > 0
        ? segments[segments.length - 1] || segments[segments.length - 2] || ''
        : '';
    const fixedLength = 55;
    const formattedValue = segment.length > fixedLength
        ? '...' + segment.slice(-fixedLength)
        : segment;
    return `<a href="${value}" target="_blank">${formattedValue}</a>`;
}

function showNodeDetails(node, openDrawer = true) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('overlay');
    const drawerContent = document.getElementById('drawerContent');

    const drawerHeaderTitle = drawer.querySelector('.drawer-header h2');
    drawerHeaderTitle.textContent = node['Service Name'] || 'Service Information';

    drawerContent.innerHTML = '';

    const excludedFields = ['index', 'x', 'y', 'vy', 'vx', 'fx', 'fy', 'color', 'Service Name'];
    const table = document.createElement('table');

    for (const [key, value] of Object.entries(node)) {
        if (!excludedFields.includes(key) && typeof value === 'string' && value) {
            const row = document.createElement('tr');
            const tdKey = document.createElement('td');
            const tdValue = document.createElement('td');

            if (!descriptionFields.includes(key) && value !== "") {
                const parts = splitValues(value);

                if (parts.some(p => isUrl(p))) {
                    tdValue.innerHTML = '';
                    if (parts.length > 1) {
                        const ul = document.createElement('ul');
                        parts.forEach(p => {
                            const li = document.createElement('li');
                            li.innerHTML = isUrl(p) ? getLink(p) : p;
                            ul.appendChild(li);
                        });
                        tdValue.appendChild(ul);
                    } else {
                        tdValue.innerHTML = getLink(parts[0]);
                    }

                } else if (value && searchableAttributesOnPeopleDb.includes(key)) {
                    tdValue.innerHTML = `
          <i>
            ${parts.length > 1
                        ? `<ul>${parts.map(v => `<li>${getPeopleDbLink(v)}</li>`).join("")}</ul>`
                        : getPeopleDbLink(parts[0])
                    }
          </i>`;

                } else {
                    tdValue.innerHTML = '';
                    if (parts.length > 1) {
                        const ul = document.createElement('ul');
                        parts.forEach(v => {
                            const li = document.createElement('li');
                            li.innerHTML = `<i>${v} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(v)} href="#"}>⌞ ⌝</a></i>`;
                            ul.appendChild(li);
                        });
                        tdValue.appendChild(ul);
                    } else {
                        const v = parts[0];
                        tdValue.innerHTML = `<i>${v} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(v)} href="#">⌞ ⌝</a></i>`;
                    }
                }
            } else {
                createFormattedLongTextElementsFrom(value).forEach(element => tdValue.appendChild(element));
            }

            const colKey = (key === 'Service Name') ? 'id' : key;

            tdKey.innerHTML = '';
            const keyLabel = document.createElement('span');
            keyLabel.textContent = key;

            const isListVisible = document.getElementById('list-view')?.style.display === 'block';
            if (isListVisible) {
                const isSelected = currentColumnKeys.includes(colKey);
                const opBtn = document.createElement('button');
                opBtn.className = 'col-op fade-link';
                opBtn.type = 'button';
                opBtn.setAttribute('data-col', encodeURIComponent(colKey));
                opBtn.setAttribute('aria-label', isSelected ? `Rimuovi "${labelForKey(colKey)}" dalla vista elenco`
                    : `Aggiungi "${labelForKey(colKey)}" alla vista elenco`);
                opBtn.textContent = isSelected ? '−' : '+';
                tdKey.appendChild(keyLabel);
                tdKey.appendChild(opBtn);
            } else {
                tdKey.appendChild(keyLabel);
            }


            row.appendChild(tdKey);
            row.appendChild(tdValue);
            table.appendChild(row);
        }
    }

    serviceInfoEnhancers.forEach(fn => {
        const result = fn(node);
        if (result && result.key && result.value) {
            const row = document.createElement('tr');
            const tdKey = document.createElement('td');
            const tdValue = document.createElement('td');

            tdKey.textContent = result.key;
            if (result.value.startsWith('http') && !result.value.includes(' ')) {
                tdValue.innerHTML = `<a href="${result.value}" target="_blank">${getLink(result.value)}</a>`;
            } else {
                tdValue.innerHTML = `${result.value}`;
            }

            row.appendChild(tdKey);
            row.appendChild(tdValue);
            table.appendChild(row);
        }
    });
    table.addEventListener('click', (e) => {
        const btn = e.target.closest('.col-op');
        if (!btn) return;
        const col = decodeURIComponent(btn.getAttribute('data-col'));
        toggleColumn(col);
    });

    drawerContent.appendChild(table);

    if (openDrawer) {
        drawer.classList.add('open');
        overlay.classList.add('open');
    }
}


function createMap() {

    zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", zoomed);

    svg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(zoom);
    g = svg
        .append('g');

    g.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 10)
        .attr('markerHeight', 10)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');

    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    if (getQueryParam('search'))
        simulation.alphaDecay(0.07);

    linkGraph = g.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('marker-end', 'url(#arrow)');

    nodeGraph = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', 20)
        .attr('fill', d => d.color)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', function (event, d) {
            const tooltip = d3.select('#tooltip');
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(d['Description'] || 'No description available')
                .style('left', (event.pageX + 5) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', mouseout)
        .on('click', function (event, d) {
            clickedNode = d;
            showNodeDetails(d);
        });
    labels = g.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('dy', -2)
        .attr('text-anchor', 'middle')
        .text(d => d.id);

    simulation.on('tick', () => {
        linkGraph
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (dx / dist) * 5;
                return d.target.x - offsetX;
            })
            .attr('y2', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const offsetY = (dy / dist) * 5;
                return d.target.y - offsetY;
            });
        nodeGraph
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y - 30);
    });

    zoomIdentity = d3.zoomIdentity;

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
    }

    function mouseout() {
        const tooltip = d3.select('#tooltip');
        tooltip.transition().duration(500).style('opacity', 0);
    }

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('search-trigger')) {
            clickedNode = null;
            e.preventDefault();
            const key = decodeURIComponent(e.target.getAttribute('data-key'));
            const isAccurateSearch = key === "Depends on" || key === "Used by" || key === "id";
            const mappedKey = isAccurateSearch ? "id" : key;
            const value = isAccurateSearch ? `"${decodeURIComponent(e.target.getAttribute('data-value'))}"` : `${decodeURIComponent(e.target.getAttribute('data-value'))}`;
            const combinedSearchTerm = `${mappedKey}:${value}`;
            searchTerm = combinedSearchTerm;
            const searchInput = document.getElementById('drawer-search-input');
            searchInput.value = combinedSearchTerm;
            setSearchQuery(combinedSearchTerm);
            updateVisualization(nodeGraph, linkGraph, labels);
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    });
}

function createLegend(colorScale) {
    const types = colorScale.domain();
    const legend = d3.select('#legend');
    types.forEach(type => {
        const color = colorScale(type);
        const legendItem = legend.append('div').attr('class', 'legend-item');
        legendItem.append('div').attr('class', 'legend-swatch').style('background-color', color);
        legendItem.append('span').text(type);
    });
}
