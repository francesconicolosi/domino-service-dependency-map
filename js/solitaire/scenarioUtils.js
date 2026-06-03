export function buildExpandedLayoutMapFromDom() {
    const map = {};
    document.querySelectorAll('g.draggable[data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (!key) return;
        let x = 0, y = 0;
        const t = el.getAttribute('transform') || '';
        const m = t.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (m) { x = Math.round(parseFloat(m[1]) || 0); y = Math.round(parseFloat(m[2]) || 0); }
        const entry = { x, y };
        const rect = el.querySelector('rect');
        if (rect) {
            const w = Number(rect.getAttribute('width'));
            const h = Number(rect.getAttribute('height'));
            if (Number.isFinite(w)) entry.width = Math.round(w);
            if (Number.isFinite(h)) entry.height = Math.round(h);
        }
        map[key] = entry;
    });
    return map;
}
