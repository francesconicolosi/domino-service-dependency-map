import * as d3 from 'd3';

let searchActive = false;

export function clearFieldHighlights() {
    document
        .querySelectorAll('.field-hit-highlight, .role-hit-highlight')
        .forEach(el => el.classList.remove('field-hit-highlight', 'role-hit-highlight'));
}

export function clearSearchDimming() {
    d3.selectAll('.dimmed').classed('dimmed', false);
    d3.selectAll('.highlighted').classed('highlighted', false);
    searchActive = false;
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

export function applyStreamVisibility({ hiddenStreams, isolatedStream }) {
    d3.selectAll('g[data-key^="stream::"]').each(function () {
        const g = d3.select(this);
        const key = g.attr('data-key');
        const isHidden = hiddenStreams.has(key);
        const isIsolated = isolatedStream && key !== isolatedStream;
        g.style('display', (isHidden || isIsolated) ? 'none' : null);
    });
}

function resolveScopeFromTarget(targetEl) {
    const el = targetEl instanceof Element ? targetEl : targetEl?.node?.();
    if (!el) return null;
    const cardG = el.closest('g[data-key^="card::"]');
    if (cardG) {
        const key = cardG.getAttribute('data-key');
        const parts = key.split('::');
        const s = parts[1], t = parts[2], team = parts[3];
        return { mode: 'member', streamKey: `stream::${s}`, themeKey: `theme::${s}::${t}`, teamKey: `team::${s}::${t}::${team}`, cardKey: key };
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
        streams: new Set(),
        themes:  new Set(),
        teams:   new Set(),
        cards:   new Set()
    };

    const scopes = matchElements.map(el => resolveScopeFromTarget(el)).filter(Boolean);
    scopes.forEach(s => {
        switch (s.mode) {
            case 'stream': hit.streams.add(s.streamKey); break;
            case 'theme':  hit.themes.add(s.themeKey);   break;
            case 'team':   hit.teams.add(s.teamKey);     break;
            case 'member': hit.cards.add(s.cardKey);     break;
        }
    });

    d3.selectAll('#streamLayer > g, #themeLayer > g, #teamLayer > g, #cardLayer > g')
        .classed('dimmed', true).classed('highlighted', false);

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
        const parts = themeKey.split('::');
        const stream = `stream::${parts[1]}`;
        const suffix = parts.slice(1).join('::');
        undimByKey(stream); markByKey(stream);
        undimByKey(themeKey); markByKey(themeKey);
        undimSel(d3.selectAll(`g[data-key^="team::${suffix}::"]`));
        undimSel(d3.selectAll(`g[data-key^="card::${suffix}::"]`));
    });

    hit.teams.forEach(teamKey => {
        const parts  = teamKey.split('::');
        const stream = `stream::${parts[1]}`;
        const theme  = `theme::${parts[1]}::${parts[2]}`;
        const suffix = parts.slice(1).join('::');
        undimByKey(stream); markByKey(stream);
        undimByKey(theme);  markByKey(theme);
        undimByKey(teamKey); markByKey(teamKey);
        undimSel(d3.selectAll(`g[data-key^="card::${suffix}::"]`));
    });

    hit.cards.forEach(cardKey => {
        const parts  = cardKey.split('::');
        const stream = `stream::${parts[1]}`;
        const theme  = `theme::${parts[1]}::${parts[2]}`;
        const team   = `team::${parts[1]}::${parts[2]}::${parts[3]}`;
        undimByKey(stream); markByKey(stream);
        undimByKey(theme);  markByKey(theme);
        undimByKey(team);   markByKey(team);
        undimByKey(cardKey); markByKey(cardKey);
    });
}
