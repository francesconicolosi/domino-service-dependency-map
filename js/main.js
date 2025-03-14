import * as d3 from 'd3';

document.getElementById('csvFileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvData = e.target.result;
        const data = d3.csvParse(csvData);
        processData(data);
    };
    reader.readAsText(file);
});

function processData(data) {
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const nodes = data.map(d => {
        const node = { id: d['Service Name'], color: colorScale(d['Type']) };
        for (const key in d) {
            if (key !== 'Service Name' && key !== 'Depends on' && key !== 'Used by') {
                node[key] = d[key];
            }
        }
        return node;
    });
    const nodeIds = new Set(nodes.map(d => d.id));
    const links = data.flatMap(d => [
        ...d['Depends on'].split('\n').map(dep => nodeIds.has(dep) ? { source: d['Service Name'], target: dep } : null),
        ...d['Used by'].split('\n').map(used => nodeIds.has(used) ? { source: used, target: d['Service Name'] } : null)
    ]).filter(link => link !== null);
    createMap(nodes, links);
    createLegend(colorScale);
}



function createMap(nodes, links) {
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

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('marker-end', 'url(#arrow)');

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', 20)
        .attr('fill', d => d.color) // Correzione qui
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        .on('click', function(event, d) {
            // Mostra il riquadro delle informazioni
            document.getElementById('serviceInfo').style.display = 'block';

            // Pulisci il contenuto precedente
            const serviceDetails = document.getElementById('serviceDetails');
            serviceDetails.innerHTML = '';

            // Aggiungi tutte le proprietà del nodo, escludendo i campi specificati
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
    const labels = svg.append('g')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('dy', -2)
        .attr('text-anchor', 'middle')
        .text(d => d.id);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const offsetX = (dx / dist) * 5; // Riduci l'offset per avvicinare la punta della freccia
                return d.target.x - offsetX;
            })
            .attr('y2', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const offsetY = (dy / dist) * 5; // Riduci l'offset per avvicinare la punta della freccia
                return d.target.y - offsetY;
            });
        node
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

    function mouseover(event, d) {
        const tooltip = d3.select('#tooltip');
        tooltip.transition().duration(200).style('opacity', .9);
        tooltip.html(d.description)
            .style('left', (event.pageX + 5) + 'px')
            .style('top', (event.pageY - 28) + 'px');
    }

    function mouseout(event, d) {
        const tooltip = d3.select('#tooltip');
        tooltip.transition().duration(500).style('opacity', 0);
    }

    document.getElementById('searchInput').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            const searchTerm = event.target.value.toLowerCase();
            const relatedNodes = new Set();
            const relatedLinks = links.filter(link => {
                if (link.source.id.toLowerCase().includes(searchTerm) || link.target.id.toLowerCase().includes(searchTerm)) {
                    relatedNodes.add(link.source.id);
                    relatedNodes.add(link.target.id);
                    return true;
                }
                return false;
            });
            node.style('display', d => relatedNodes.has(d.id) ? 'block' : 'none');
            link.style('display', d => relatedLinks.includes(d) ? 'block' : 'none');
            labels.style('display', d => relatedNodes.has(d.id) ? 'block' : 'none');
        }

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