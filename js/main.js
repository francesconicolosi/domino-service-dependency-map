import * as d3 from 'd3';

let nodes = [];
let links = [];
let hideStoppedServices = false;
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

function getDecommButtonLabel() {
    return hideStoppedServices ? 'Show Decommissioned Services' : 'Hide Decommissioned Services';
}

function centerAndZoomOnNode(node) {
    const scale = 1;
    const x = -node.x * scale + width / 2;
    const y = -node.y * scale + height / 2;


    const transform = zoomIdentity
        .translate(x,y)
        .scale(scale)
        .translate(-0,-0);

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
    hideStoppedServices = false;
    searchTerm = "";
    activeServiceNodes = [];
    activeServiceNodeIds = [];
    document.getElementById('hideStoppedServices').textContent = getDecommButtonLabel();
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function updateQueryString(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

function hideActions() {
    document.getElementById('label-file').classList.add('hidden');
    document.getElementById('hideStoppedServices').classList.add('hidden');
    document.getElementById('csvFileInput').classList.add('hidden');
    document.querySelector('a[href="./100_sample_services.csv"]').classList.add('hidden');
    document.querySelector('h1').classList.add('hidden');
    document.querySelector('h3').classList.add('hidden');
    document.querySelector('footer').classList.add('hidden');
}

document.getElementById('csvFileInput').addEventListener('change', function(event) {
    resetVisualization();
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        const data = d3.csvParse(csvData);
        processData(data);
        hideActions();
        updateVisualization(nodeGraph, linkGraph, labels);
    };
    reader.readAsText(file);
});

window.addEventListener('load', function() {
    let searchParam = null;
    const searchInput = document.getElementById('searchInput');
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/100_sample_services.csv')
        .then(response => {
            searchParam = getQueryParam('search')
            toggleSearchButton(searchParam);
            if (searchParam) {
                searchTerm = searchParam;
                searchInput.value = searchParam;
            }
            return response.text();
        })
        .then(csvData => {
            const data = d3.csvParse(csvData);
            processData(data);
            hideActions();
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

document.getElementById('toggle-cta').addEventListener('click', function() {
    const elements = [
        document.getElementById('label-file'),
        document.getElementById('hideStoppedServices'),
        document.querySelector('a[href="./100_sample_services.csv"]'),
        document.querySelector('h1'),
        document.querySelector('h3'),
        document.querySelector('footer')
    ];
    elements.forEach(element => element.classList.toggle('hidden'));
});

function processData(data) {
    const requiredColumns = ['Service Name', 'Description', 'Type', 'Depends on', 'Status', 'Decommission Date'];
    const missingColumns = requiredColumns.filter(col => !data.columns.includes(col));

    if (missingColumns.length > 0) {
        alert(`Missing mandatory columns: ${missingColumns.join(', ')}`);
        return;
    }

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    nodes = data.map(d => {
        const node = { id: d['Service Name'], color: colorScale(d['Type']) };
        for (const key in d) {
            node[key] = d[key];
        }
        return node;
    });
    const nodeIds = new Set(nodes.map(d => d.id));
    links = data.flatMap(d => [
        ...d['Depends on'].split('\n').map(dep => nodeIds.has(dep) ? { source: d['Service Name'], target: dep } : null)
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

function updateVisualization(node, link, labels) {
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
        }

        if (isSearchResultValueOnly(d)) {
            relatedNodes.add(d.id);
        }
    });

    node.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
    link.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.source.id) && activeServiceNodeIds.has(d.target.id)) || relatedLinks.includes(d) ? 'block' : 'none');
    labels.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
    labels.style('text-decoration', d => searchedNodes.has(d.id) ? 'underline' : 'none');
    if (!clickedNode && nodeToZoom) {
        centerAndZoomOnNode(nodeToZoom);
        showNodeDetails(nodeToZoom);
    }
}

function zoomed({transform}) {
    g.attr("transform", transform);
}


function showNodeDetails(node) {
    document.getElementById('serviceInfo').style.display = 'block';
    const serviceDetails = document.getElementById('serviceDetails');
    serviceDetails.innerHTML = '';
    const excludedFields = ['index', 'x', 'y', 'vy', 'vx', 'fx', 'fy', 'color'];

    for (const [key, value] of Object.entries(node)) {
        if (!excludedFields.includes(key) && value !== "") {
            const p = document.createElement('p');
            if (typeof value === 'string' && value.includes('http')) {
                const displayValue = value.length > 20 ? value.substring(0, 40) + '...' : value;
                p.innerHTML = `<strong><b>${key}:</b></strong> <i><a href="${value}" target="_blank">${displayValue}</a></i>`;
            } else {
                const separator = value.includes("\n") ? "\n" : value.includes(",") ? "," : "";
                p.innerHTML = `<strong><b>${key}:</b></strong> <i>${key !== "Description" && value !== "" ? separator !== "" && value.includes(separator) ? value.split(separator).map(v => `${v} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(v)} href="#"}>⌞ ⌝</a>  `) :
                    `${value} <a class="fade-link search-trigger" data-key=${encodeURIComponent(key)} data-value=${encodeURIComponent(value)} href="#">⌞ ⌝</a>` : value}</i>`;
            }
            serviceDetails.appendChild(p);
        }
    }
}

function toggleSearchButton(searchInput) {
    if (searchInput) {
        document.getElementById("clearSearch").classList.remove('hidden');
    } else {
        document.getElementById("clearSearch").classList.add('hidden');
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
        .on('click', function(event, d) {
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



    document.getElementById('searchInput').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            clickedNode = null;
            searchTerm = event.target.value;
            event.stopImmediatePropagation();
            toggleSearchButton(searchTerm);
            updateQueryString('search', searchTerm);
            updateVisualization(nodeGraph, linkGraph, labels);
        }
    });


    document.getElementById('clearSearch').addEventListener('click', function () {
        searchTerm = '';
        const searchInput = document.getElementById('searchInput');
        searchInput.value = searchTerm;
        toggleSearchButton(searchTerm);
        updateQueryString('search', searchTerm);
        updateVisualization(nodeGraph, linkGraph, labels);
    });



    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('search-trigger')) {
            clickedNode = null;
            e.preventDefault();
            const key = decodeURIComponent(e.target.getAttribute('data-key'));
            const isAccurateSearch = key === "Depends on" || key === "Used by" || key === "id";
            const mappedKey = isAccurateSearch ? "id": key;
            const value = isAccurateSearch ? `"${decodeURIComponent(e.target.getAttribute('data-value'))}"` : `${decodeURIComponent(e.target.getAttribute('data-value'))}`;
            const combinedSearchTerm = `${mappedKey}:${value}`;
            searchTerm = combinedSearchTerm;
            const searchInput = document.getElementById('searchInput');
            searchInput.value = combinedSearchTerm;
            toggleSearchButton(combinedSearchTerm);
            updateQueryString('search', combinedSearchTerm);
            updateVisualization(nodeGraph, linkGraph, labels);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('hideStoppedServices').addEventListener('click', function(event) {
        event.stopImmediatePropagation();
        clickedNode = null;
        hideStoppedServices = !hideStoppedServices;
        document.getElementById('hideStoppedServices').textContent = getDecommButtonLabel();
        updateVisualization(nodeGraph, linkGraph, labels);
    });

}

function createLegend(colorScale) {
    const types = colorScale.domain();
    const legend = d3.select('#legend');
    types.forEach(type => {
        const color = colorScale(type);
        const legendItem = legend.append('div').attr('class', 'legend-item');
        legendItem.append('div').attr('class', 'legend-color').style('background-color', color);
        legendItem.append('span').text(type);
    });
}
