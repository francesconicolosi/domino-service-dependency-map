import * as d3 from 'd3';
import { getQueryParam, setSearchQuery } from '../shared/utils.js';

export class GraphRenderer {
    constructor(app) {
        this.app = app;
        this.simulation = null;
        this.g = null;
        this.zoom = null;
        this.zoomIdentity = null;
        this.svg = null;
        this.linkGraph = null;
        this.nodeGraph = null;
        this.labels = null;
        this.clickedNode = null;
        this.width = 0;
        this.height = 0;
    }

    initDOM() {
        const mapEl = document.getElementById('map');
        if (mapEl) {
            this.width = mapEl.clientWidth;
            this.height = mapEl.clientHeight;
        }
        window.addEventListener('resize', () => {
            const el = document.getElementById('map');
            if (!el || !this.svg) return;
            const w = el.clientWidth;
            const h = el.clientHeight;
            this.svg.attr('width', w).attr('height', h);
            this.svg.select('#map-clip rect').attr('width', w).attr('height', h);
        });
    }

    resetVisualization() {
        d3.select('#map').selectAll('*').remove();
        d3.select('#tooltip').style('opacity', 0);
        this.app.legend?.reset();
        d3.select('#serviceDetails').innerHTML = '';
        this.linkGraph = null;
        this.nodeGraph = null;
        this.labels = null;
        this.clickedNode = null;
    }

    createMap() {
        const { store, search, listView, drawer } = this.app;
        const { nodes, links } = store;

        this.zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', ({ transform }) => { this.g.attr('transform', transform); });

        this.svg = d3.select('#map').append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .call(this.zoom);

        const defs = this.svg.append('defs');
        defs.append('clipPath')
            .attr('id', 'map-clip')
            .append('rect')
            .attr('x', 0).attr('y', 0)
            .attr('width', this.width).attr('height', this.height);

        const viewport = this.svg.append('g').attr('clip-path', 'url(#map-clip)');
        this.g = viewport.append('g');

        this.g.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15).attr('refY', 0)
            .attr('markerWidth', 10).attr('markerHeight', 10)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', this._arrowColor());

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(200))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2));

        if (getQueryParam('search')) this.simulation.alphaDecay(0.07);

        this.linkGraph = this.g.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('marker-end', 'url(#arrow)');

        this.nodeGraph = this.g.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', 20)
            .attr('fill', d => d.color)
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => {
                    if (!event.active) this.simulation.alphaTarget(0);
                    d.fx = d.x; d.fy = d.y;
                }))
            .on('mouseover', (event, d) => {
                const tooltip = d3.select('#tooltip');
                tooltip.transition().duration(200).style('opacity', .9);
                tooltip.html(d['Description'] || 'No description available')
                    .style('left', (event.pageX + 5) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                d3.select('#tooltip').transition().duration(500).style('opacity', 0);
            })
            .on('click', (event, d) => {
                this.clickedNode = d;
                drawer.showNodeDetails(d);
            });

        this.labels = this.g.append('g')
            .selectAll('text')
            .data(nodes)
            .enter().append('text')
            .attr('dy', -2)
            .attr('text-anchor', 'middle')
            .text(d => d.id);

        this.simulation.on('tick', () => {
            this.linkGraph
                .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return d.target.x - (dx / dist) * 5;
                })
                .attr('y2', d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    return d.target.y - (dy / dist) * 5;
                });
            this.nodeGraph.attr('cx', d => d.x).attr('cy', d => d.y);
            this.labels.attr('x', d => d.x).attr('y', d => d.y - 30);
        });

        this.zoomIdentity = d3.zoomIdentity;

        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('.search-trigger');
            const addBtn = e.target.closest('.search-add');
            const remBtn = e.target.closest('.search-remove');

            if (trigger) {
                this.clickedNode = null;
                e.preventDefault();
                const key = decodeURIComponent(trigger.getAttribute('data-key'));
                const isAccurateSearch = key === 'Depends on' || key === 'Used by' || key === 'id';
                const mappedKey = isAccurateSearch ? 'id' : key;
                const value = isAccurateSearch
                    ? `"${decodeURIComponent(trigger.getAttribute('data-value'))}"`
                    : `${decodeURIComponent(trigger.getAttribute('data-value'))}`;
                search.updateSearchAndRefresh(`${mappedKey}:${value}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (addBtn || remBtn) {
                e.preventDefault();
                e.stopPropagation();
                const btn = addBtn || remBtn;
                const key = decodeURIComponent(btn.getAttribute('data-key'));
                const value = decodeURIComponent(btn.getAttribute('data-value'));
                const active = search.parseActiveKeyValueSearch(search.searchTerm);
                if (!active || active.key !== key) return;
                const values = [...active.values];
                const needle = search.normalizeForCompare(value);
                const idx = values.findIndex(v => search.normalizeForCompare(v) === needle);
                if (addBtn) { if (idx === -1) values.push(value); }
                else { if (idx !== -1) values.splice(idx, 1); }
                search.updateSearchAndRefresh(search.buildKeyValueSearch(active.key, values, active.quoted));
            }
        });
    }

    centerAndZoomOnNode(node) {
        const scale = 1;
        const x = -node.x * scale + this.width / 2;
        const y = -node.y * scale + this.height / 2;
        const transform = this.zoomIdentity.translate(x, y).scale(scale).translate(-0, -0);
        this.svg.transition().duration(750).call(this.zoom.transform, transform);
    }

    fitGraphToViewport(paddingRatio = 0.90) {
        if (!this.svg || !this.g) return;
        const bbox = this.g.node()?.getBBox();
        if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) {
            this.svg.call(this.zoom.transform, d3.zoomIdentity);
            return;
        }
        const scale = Math.min(this.width / bbox.width, this.height / bbox.height) * paddingRatio;
        const tx = this.width / 2 - (bbox.x + bbox.width / 2) * scale;
        const ty = this.height / 2 - (bbox.y + bbox.height / 2) * scale;
        this.svg.transition().duration(400).call(this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    updateVisualization(showDrawer = true) {
        const { store, search, listView, drawer } = this.app;
        search.prepareSearchTerm();

        const { nodes, links, activeServiceNodeIds } = store;
        const filteredLinks = links.filter(l =>
            activeServiceNodeIds.has(l.source.id) && activeServiceNodeIds.has(l.target.id)
        );

        const relatedNodes = new Set();
        const searchedNodes = new Set();

        const relatedLinks = links.filter(l => {
            const isLinkStatusOk = !search.hideStoppedServices || filteredLinks.includes(l);
            let isSearchedLink = search.searchTerm === '';
            if (search.isSearchResultValueOnly(l.source) || search.isSearchResultWithKeyValue(l.source)) {
                isSearchedLink = true;
                searchedNodes.add(l.source.id);
            }
            if (search.isSearchResultValueOnly(l.target) || search.isSearchResultWithKeyValue(l.target)) {
                isSearchedLink = true;
                searchedNodes.add(l.target.id);
            }
            if (isLinkStatusOk && isSearchedLink) {
                relatedNodes.add(l.source.id);
                relatedNodes.add(l.target.id);
                return true;
            }
            return false;
        });

        let nodeToZoom;
        const relaxed = document.getElementById('relaxed-search');
        this.nodeGraph.each(d => {
            const byKey = search.isSearchResultWithKeyValue(d);
            const byValue = relaxed?.checked && search.isSearchResultValueOnly(d);
            if (byKey || byValue) {
                nodeToZoom = nodeToZoom || d;
                relatedNodes.add(d.id);
                searchedNodes.add(d.id);
            }
        });

        const visible = (d) =>
            (search.searchTerm === '' && !search.hideStoppedServices) ||
            (search.searchTerm === '' && search.hideStoppedServices && activeServiceNodeIds.has(d.id)) ||
            (relatedNodes.has(d.id) && (!search.hideStoppedServices || activeServiceNodeIds.has(d.id)));

        this.nodeGraph.style('display', d => visible(d) ? 'block' : 'none');
        this.linkGraph.style('display', d =>
            (search.searchTerm === '' && !search.hideStoppedServices) ||
            (search.searchTerm === '' && search.hideStoppedServices && activeServiceNodeIds.has(d.source.id) && activeServiceNodeIds.has(d.target.id)) ||
            relatedLinks.includes(d)
                ? 'block' : 'none'
        );
        this.labels.style('display', d => visible(d) ? 'block' : 'none');
        this.labels.style('text-decoration', d => searchedNodes.has(d.id) ? 'underline' : 'none');

        search.currentNodes = nodes;
        search.currentSearchedNodes = searchedNodes;

        if (document.getElementById('list-view')?.style.display === 'block') {
            listView.renderListFromSearch();
        } else if (!this.clickedNode && nodeToZoom && (!search.hideStoppedServices || activeServiceNodeIds.has(nodeToZoom.id))) {
            this.centerAndZoomOnNode(nodeToZoom);
            drawer.showNodeDetails(nodeToZoom, showDrawer);
        }
    }

    _arrowColor() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? '#c8d0e8' : '#999';
    }

    updateGraphTheme() {
        const path = document.querySelector('#arrow path');
        if (path) path.setAttribute('fill', this._arrowColor());
    }
}
