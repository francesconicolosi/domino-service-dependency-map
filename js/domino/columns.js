import { getFormattedDate } from '../shared/utils.js';

export const descriptionFields = ['Contingency and recovery planning', 'Description'];

export const LABEL_FOR_KEY = {
    id: 'ID'
};

export function labelForKey(key) {
    if (key === 'id') return LABEL_FOR_KEY.id;
    return key;
}

export function isListViewVisible() {
    const el = document.getElementById('list-view');
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

export function refreshDrawerColumnIcons() {
    const drawerContent = document.getElementById('drawerContent');
    if (!drawerContent) return;
    const isListVisible = isListViewVisible();
    const buttons = drawerContent.querySelectorAll('button.col-op');
    buttons.forEach(btn => {
        const col = decodeURIComponent(btn.getAttribute('data-col'));
        const selected = window.currentColumnKeys.includes(col);
        btn.textContent = selected ? '−' : '+';
        btn.setAttribute('aria-label', selected
            ? `Remove "${labelForKey(col)}" from list view`
            : `Add "${labelForKey(col)}" to list view`
        );
        btn.style.display = isListVisible ? '' : 'none';
    });
}

export function getCellValue(node, key) {
    if (key === 'id') return node?.id ?? '';
    const raw = node?.[key] ?? '';
    if (key === 'Depends on' && typeof raw === 'string') {
        return raw.split('\n').map(s => s.trim()).filter(Boolean).join(', ');
    }
    if (key === 'Decommission Date' && raw) {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? raw : getFormattedDate(d.toISOString());
    }
    return raw;
}
