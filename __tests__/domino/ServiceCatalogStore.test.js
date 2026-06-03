import { ServiceCatalogStore } from '../../js/domino/ServiceCatalogStore.js';

// D3 is auto-mocked via __mocks__/d3.js

function makeData(overrides = []) {
    const base = [
        { 'Service Name': 'SvcA', Description: 'Desc A', Type: 'Application', 'Depends on': '', Status: 'Active', 'Decommission Date': '' },
        { 'Service Name': 'SvcB', Description: 'Desc B', Type: 'Library',     'Depends on': 'SvcA', Status: 'Active', 'Decommission Date': '' },
        { 'Service Name': 'SvcC', Description: 'Desc C', Type: 'Application', 'Depends on': '', Status: 'Stopped', 'Decommission Date': '' },
    ];
    const rows = [...base, ...overrides];
    rows.columns = ['Service Name', 'Description', 'Type', 'Depends on', 'Status', 'Decommission Date'];
    return rows;
}

describe('ServiceCatalogStore constructor', () => {
    test('initializes with empty state', () => {
        const store = new ServiceCatalogStore();
        expect(store.nodes).toEqual([]);
        expect(store.links).toEqual([]);
        expect(store.activeServiceNodes).toEqual([]);
        expect(store.hasLoaded).toBe(false);
    });
});

describe('ServiceCatalogStore.reset', () => {
    test('clears all state', () => {
        const store = new ServiceCatalogStore();
        store.nodes = [{ id: 'a' }];
        store.links = [{ source: 'a', target: 'b' }];
        store.hasLoaded = true;
        store.reset();
        expect(store.nodes).toEqual([]);
        expect(store.links).toEqual([]);
        expect(store.hasLoaded).toBe(false);
    });
});

describe('ServiceCatalogStore.processData', () => {
    let store;

    beforeEach(() => {
        global.alert = jest.fn();
        document.body.innerHTML = '<span id="side-last-update"></span>';
        store = new ServiceCatalogStore();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns null and alerts when required columns are missing', () => {
        const data = [{ 'Service Name': 'X' }];
        data.columns = ['Service Name'];
        const result = store.processData(data);
        expect(result).toBeNull();
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Missing mandatory columns'));
    });

    test('creates nodes from data', () => {
        store.processData(makeData());
        expect(store.nodes).toHaveLength(3);
        const ids = store.nodes.map(n => n.id);
        expect(ids).toContain('SvcA');
        expect(ids).toContain('SvcB');
        expect(ids).toContain('SvcC');
    });

    test('creates links from "Depends on" column', () => {
        store.processData(makeData());
        expect(store.links).toHaveLength(1);
        expect(store.links[0]).toMatchObject({ source: 'SvcB', target: 'SvcA' });
    });

    test('ignores dependencies targeting non-existent nodes', () => {
        const data = makeData([
            { 'Service Name': 'SvcX', Description: '', Type: 'App', 'Depends on': 'NonExistent', Status: 'Active', 'Decommission Date': '' },
        ]);
        store.processData(data);
        const links = store.links.filter(l => l.source === 'SvcX');
        expect(links).toHaveLength(0);
    });

    test('active nodes exclude Stopped and Decommissioned services', () => {
        store.processData(makeData());
        const activeIds = store.activeServiceNodes.map(n => n.id);
        expect(activeIds).toContain('SvcA');
        expect(activeIds).toContain('SvcB');
        expect(activeIds).not.toContain('SvcC');
    });

    test('adds "Used by" column when not present', () => {
        const data = makeData();
        store.processData(data);
        expect(data.columns).toContain('Used by');
    });

    test('"Used by" is populated correctly (SvcA is used by SvcB)', () => {
        store.processData(makeData());
        const svcA = store.nodes.find(n => n.id === 'SvcA');
        expect(svcA['Used by']).toContain('SvcB');
    });

    test('does not overwrite existing "Used by" column', () => {
        const data = makeData();
        data.columns = [...data.columns, 'Used by'];
        store.processData(data);
        // Columns length should not increase
        const usedByCount = data.columns.filter(c => c === 'Used by').length;
        expect(usedByCount).toBe(1);
    });

    test('node has id and color properties', () => {
        store.processData(makeData());
        store.nodes.forEach(n => {
            expect(n.id).toBeTruthy();
            expect(n.color).toBeDefined();
        });
    });

    test('updates last-update label when Updated column is present', () => {
        const data = makeData();
        data[0]['Updated'] = '2024-06-15T00:00:00Z';
        data.columns = [...data.columns, 'Updated'];
        store.processData(data);
        const el = document.getElementById('side-last-update');
        expect(el.textContent).toContain('Last Update:');
    });

    test('returns the color scale', () => {
        const colorScale = store.processData(makeData());
        expect(colorScale).toBeDefined();
    });
});
