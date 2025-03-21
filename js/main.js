import * as d3 from 'd3';

let nodes = [];
let links = [];
let hideStoppedServices = false;
let searchTerm = "";
let activeServiceNodes;
let activeServiceNodeIds;
let linkEntity;
let nodeEntity;
let labels;

function getDecommButtonLabel() {
    return hideStoppedServices ? 'Show Decommissioned Services' : 'Hide Decommissioned Services';
}

function resetVisualization() {
    d3.select('#map').selectAll('*').remove();
    d3.select('#tooltip').style('opacity', 0);
    d3.select('#legend').selectAll('*').remove();
    d3.select('#serviceDetails').innerHTML = '';
    nodes = [];
    links = [];
    linkEntity = null;
    nodeEntity = null;
    labels = [];
    hideStoppedServices = false;
    searchTerm = "";
    activeServiceNodes = [];
    activeServiceNodeIds = [];
    document.getElementById('hideStoppedServices').textContent = getDecommButtonLabel();
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
    };
    reader.readAsText(file);

});

document.getElementById('toggle-cta').addEventListener('click', function() {
    const elements = [
        document.getElementById('label-file'),
        document.getElementById('hideStoppedServices'),
        document.querySelector('a[href="./100_sample_services.csv"]'),
        document.querySelector('h1'),
        document.querySelector('h3')
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
            if (key !== 'Service Name' && key !== 'Depends on' && key !== 'Used by') {
                node[key] = d[key];
            }
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

function isSearchResultWithKeyValue(d) {

    let searchTermWholeWord = searchTerm.includes('"');
    let searchTermToConsider = searchTermWholeWord ? searchTerm.replaceAll('"', '') : searchTerm;

    return searchTermToConsider.includes(':')
        && searchTermToConsider.split(':').length === 2
        && Object.keys(d).includes(searchTermToConsider.split(':')[0])
        && (searchTermWholeWord ?
            d[searchTermToConsider.split(':')[0]].toLowerCase() === searchTermToConsider.split(':')[1].toLowerCase()
            : d[searchTermToConsider.split(':')[0]].toLowerCase().includes(searchTermToConsider.split(':')[1].toLowerCase()));
}

function isSearchResultValueOnly(d) {
    return searchTerm !== ""
        && Object.values(d).some(value => typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()));
}

function updateVisualization(node, link, labels) {
    const filteredLinks = links.filter(link => activeServiceNodeIds.has(link.source.id) && activeServiceNodeIds.has(link.target.id));

    const relatedNodes = new Set();
    const relatedLinks = links.filter(link => {
        let isLinkStatusOk = !hideStoppedServices || (filteredLinks.includes(link));
        let isSearchedLink = searchTerm === "" ||
            isSearchResultValueOnly(link.source) || isSearchResultValueOnly(link.target) || isSearchResultWithKeyValue(link.source) || isSearchResultWithKeyValue(link.target);
        if (isLinkStatusOk && isSearchedLink) {
            relatedNodes.add(link.source.id);
            relatedNodes.add(link.target.id);
            return true;
        }
        return false;
    });

    node.each(d => {

        if (isSearchResultWithKeyValue(d)
            ||
            isSearchResultValueOnly(d)) {
            relatedNodes.add(d.id);
        }
    });

    node.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
    link.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.source.id) && activeServiceNodeIds.has(d.target.id)) || relatedLinks.includes(d) ? 'block' : 'none');
    labels.style('display', d => (searchTerm === "" && !hideStoppedServices) || (searchTerm === "" && hideStoppedServices && activeServiceNodeIds.has(d.id)) || relatedNodes.has(d.id) && (!hideStoppedServices || activeServiceNodeIds.has(d.id)) ? 'block' : 'none');
}

function createMap() {
    const width = document.getElementById('map').clientWidth;
    const height = document.getElementById('map').clientHeight;
    const svg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().on('zoom', function (event) {
            svg.attr('transform', event.transform);
        }))
        .append('g');

    const arrowMarker = svg.append('defs').append('marker')
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

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    linkEntity = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('marker-end', 'url(#arrow)');

    nodeEntity = svg.append('g')
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
            document.getElementById('serviceInfo').style.display = 'block';
            const serviceDetails = document.getElementById('serviceDetails');
            serviceDetails.innerHTML = '';
            const excludedFields = ['index', 'x', 'y', 'vy', 'vx', 'fx', 'fy', 'color'];
            for (const [key, value] of Object.entries(d)) {
                if (!excludedFields.includes(key)) {
                    const p = document.createElement('p');
                    if (typeof value === 'string' && value.includes('http')) {
                        const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
                        p.innerHTML = `<strong><b>${key}:</b></strong> <i><a href="${value}" target="_blank">${displayValue}</a></i>`;
                    } else {
                        p.innerHTML = `<strong><b>${key}:</b></strong> <i>${value}</i>`;
                    }
                    serviceDetails.appendChild(p);
                }
            }
        });
    labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('dy', -2)
        .attr('text-anchor', 'middle')
        .text(d => d.id);

    simulation.on('tick', () => {
        linkEntity
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
        nodeEntity
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        labels
            .attr('x', d => d.x)
            .attr('y', d => d.y - 30);
    });

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
            searchTerm = event.target.value;
            event.stopImmediatePropagation();
            updateVisualization(nodeEntity, linkEntity, labels);
        }
    });
    document.getElementById('hideStoppedServices').addEventListener('click', function(event) {
        event.stopImmediatePropagation();
        hideStoppedServices = !hideStoppedServices;
        document.getElementById('hideStoppedServices').textContent = getDecommButtonLabel();
        updateVisualization(nodeEntity, linkEntity, labels);
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
