import * as d3 from 'd3';

import {
    getQueryParam,
    setSearchQuery,
    closeSideDrawer,
    initCommonActions,
    getFormattedDate,
    createFormattedLongTextElementsFrom
} from './utils.js';


let nodes = [];
let links = [];
let hideStoppedServices = !(document.getElementById('toggle-decommissioned').checked);
let searchTerm = "";
let activeServiceNodes;
let activeServiceNodeIds;
let linkGraph;
let nodeGraph;
let labels;
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

window.addEventListener('load', function () {
    let searchParam = null;
    const searchInput = document.getElementById('drawer-search-input');
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample_services.csv')
        .then(response => {
            searchParam = getQueryParam('search')
            if (searchParam) {
                searchTerm = searchParam;
                searchInput.value = searchParam;
            }
            return response.text();
        })
        .then(csvData => {
            const data = d3.csvParse(csvData);
            processData(data);
            if (searchParam) {
                simulation.on('end', () => {
                    if (!hasLoaded) {
                        hasLoaded = true;
                        updateVisualization(nodeGraph, linkGraph, labels);
                    }
                });
            } else {
                updateVisualization(nodeGraph, linkGraph, labels);
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
    let isAccurateSearch = searchTerm.includes('"');
    let searchTermToConsider = isAccurateSearch ? searchTerm.replaceAll('"', '') : searchTerm;

    let parts = searchTermToConsider.split(':');
    let hasValidFormat = parts.length === 2 && Object.keys(node).includes(parts[0]);

    if (!hasValidFormat) return false;

    let key = parts[0];
    let values = parts[1].split(',').map(v => getTermToCompare(v.trim()));
    let nodeData = getTermToCompare(node[key]);

    return values.some(value =>
        isAccurateSearch ? nodeData === value : nodeData.includes(value)
    );
}


function isSearchResultValueOnly(d) {
    if (searchTerm === "" || searchTerm.includes(":")) return false;

    const terms = searchTerm.toLowerCase().split(',').map(term => term.trim());

    return Object.values(d).some(value =>
        typeof value === 'string' &&
        terms.some(term => value.toLowerCase().includes(term))
    );
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
    if (!clickedNode && nodeToZoom && (!hideStoppedServices || activeServiceNodeIds.has(nodeToZoom.id))) {
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
    const descriptionFields = ['Contingency and Recovery Planning', 'Description'];
    const table = document.createElement('table');

    for (const [key, value] of Object.entries(node)) {
        if (!excludedFields.includes(key) && typeof value === 'string' && value) {
            const row = document.createElement('tr');
            const tdKey = document.createElement('td');
            const tdValue = document.createElement('td');

            const separator = value.includes("\n,") ? "\n," : value.includes("\n") ? "\n" : value.includes(",") ? "," : "";
            if (value.startsWith('http') && !value.includes(' ')) {
                tdValue.innerHTML = `<i>
                    ${separator !== ""
                    ? `<ul>${[...new Set(value.split(separator).map(v => v.trim()).filter(Boolean))].map(v => `<li>${getLink(v)}</li>`).join("")}</ul>`
                    : getLink(value)
                }</i>`;
            } else if (value && searchableAttributesOnPeopleDb.includes(key)) {
                tdValue.innerHTML = `
                  <i>
                    ${separator !== ""
                    ? `<ul>${[...new Set(value.split(separator).map(v => v.trim()).filter(Boolean))].map(v => `<li>${getPeopleDbLink(v)}</li>`).join("")}</ul>`
                    : getPeopleDbLink(value)
                }</i>`;

            } else if (!descriptionFields.includes(key) && value !== "") {
                if (separator !== "" && value.includes(separator)) {
                    tdValue.innerHTML = `
                    <i>${value.split(separator).map(v => `${v} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(v)} href="#"}>⌞ ⌝</a>  `)}</i>`;
                } else {
                    tdValue.innerHTML = `<i>${value} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(value)} href="#">⌞ ⌝</a></i>`;
                }
            } else {
                createFormattedLongTextElementsFrom(value).forEach(element => tdValue.appendChild(element));
            }

            tdKey.textContent = key;

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

    drawerContent.appendChild(table);

    if (openDrawer) {
        drawer.classList.add('open');
        overlay.classList.add('open');
    }
}


function createMap() {

    zoom = d3.zoom()
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
