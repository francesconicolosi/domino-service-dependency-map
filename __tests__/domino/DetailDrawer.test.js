import { DetailDrawer } from '../../js/domino/DetailDrawer.js';

function makeApp() {
    return {
        search: {
            searchTerm: '',
            parseActiveKeyValueSearch: jest.fn(() => null),
            normalizeForCompare: jest.fn(v => (v || '').toString().toLowerCase()),
        },
        graph: {
            updateVisualization: jest.fn(),
            fitGraphToViewport: jest.fn(),
            clickedNode: null,
        },
        listView: {
            columnKeys: ['id', 'Status', 'Description'],
            toggleColumn: jest.fn(),
        },
    };
}

function setupDOM() {
    document.body.innerHTML = `
        <div id="drawer" class="open"></div>
        <div id="overlay" class="open"></div>
        <button id="closeDrawer"></button>
        <input id="drawer-search-input"/>
    `;
}

describe('DetailDrawer constructor', () => {
    test('stores app reference', () => {
        const app = makeApp();
        const dd = new DetailDrawer(app);
        expect(dd.app).toBe(app);
    });
});

describe('DetailDrawer.closeDrawer', () => {
    beforeEach(setupDOM);
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('removes open class from drawer', () => {
        const dd = new DetailDrawer(makeApp());
        dd.closeDrawer();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('removes open class from overlay', () => {
        const dd = new DetailDrawer(makeApp());
        dd.closeDrawer();
        expect(document.getElementById('overlay').classList.contains('open')).toBe(false);
    });

    test('does not throw when elements are missing', () => {
        document.body.innerHTML = '';
        const dd = new DetailDrawer(makeApp());
        expect(() => dd.closeDrawer()).not.toThrow();
    });
});

describe('DetailDrawer.getPeopleDbLink', () => {
    const dd = new DetailDrawer(makeApp());

    test('generates an anchor link to solitaire.html', () => {
        const html = dd.getPeopleDbLink('Alice Smith');
        expect(html).toContain('solitaire.html');
        expect(html).toContain('Alice Smith');
        expect(html).toContain('<a ');
    });

    test('URL-encodes the value and lowercases it', () => {
        const html = dd.getPeopleDbLink('Alice Smith');
        expect(html).toContain('alice+smith');
    });
});


describe('DetailDrawer.renderValueCell', () => {
    beforeEach(setupDOM);
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns empty td for non-string value', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Name', null, '');
        expect(td.tagName).toBe('TD');
        expect(td.textContent).toBe('');
    });

    test('formats ISO datetime value', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Created', '2024-06-15T10:30:00Z', '');
        expect(td.textContent.length).toBeGreaterThan(0);
        expect(td.textContent).not.toBe('2024-06-15T10:30:00Z');
    });

    test('renders URL parts as anchor links', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Link', 'https://example.com', '');
        expect(td.innerHTML).toContain('<a ');
    });

    test('renders plain text for simple string', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Status', 'Active', '');
        expect(td.textContent).toContain('Active');
    });
});

describe('DetailDrawer.initDOM', () => {
    beforeEach(setupDOM);
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clicking closeDrawer button closes the drawer', () => {
        const dd = new DetailDrawer(makeApp());
        dd.initDOM();
        document.getElementById('closeDrawer').click();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('clicking overlay closes the drawer', () => {
        const dd = new DetailDrawer(makeApp());
        dd.initDOM();
        document.getElementById('overlay').click();
        expect(document.getElementById('overlay').classList.contains('open')).toBe(false);
    });

    test('Escape key closes open drawer', () => {
        const app = makeApp();
        const dd = new DetailDrawer(app);
        dd.initDOM();
        const drawer = document.getElementById('drawer');
        drawer.classList.add('open');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(drawer.classList.contains('open')).toBe(false);
    });

    test('Escape key clears search when drawer is closed and searchTerm is set', () => {
        const app = makeApp();
        app.search.searchTerm = 'alice';
        const dd = new DetailDrawer(app);
        dd.initDOM();
        document.getElementById('drawer').classList.remove('open');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(app.search.searchTerm).toBe('');
        expect(app.graph.updateVisualization).toHaveBeenCalled();
    });

    test('non-Escape keydown does nothing', () => {
        const app = makeApp();
        const dd = new DetailDrawer(app);
        dd.initDOM();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(app.graph.updateVisualization).not.toHaveBeenCalled();
    });
});


// ─── DetailDrawer.renderValueCell (extended) ──────────────────────────────────

describe('DetailDrawer.renderValueCell (extended)', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('renders Description (descriptionFields) via long-text formatter', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Description', 'A long description text', '');
        expect(td.tagName).toBe('TD');
        // createFormattedLongTextElementsFrom appends children
        expect(td.childNodes.length).toBeGreaterThan(0);
    });

    test('renders SEARCHABLE_ATTRS as people-db link (single value)', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Owner', 'Alice Smith', '');
        expect(td.innerHTML).toContain('solitaire.html');
        expect(td.innerHTML).toContain('Alice Smith');
    });

    test('renders SEARCHABLE_ATTRS as list (multiple values)', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Owner', 'Alice Smith||Bob Jones', '');
        expect(td.querySelector('ul')).toBeTruthy();
        expect(td.querySelectorAll('li')).toHaveLength(2);
    });

    test('renders single value with search-trigger anchor', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Status', 'Active', '');
        expect(td.innerHTML).toContain('search-trigger');
    });

    test('renders multi-value non-URL as list with search triggers', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderValueCell('Status', 'Active||Inactive', '');
        expect(td.querySelector('ul')).toBeTruthy();
        expect(td.querySelectorAll('li')).toHaveLength(2);
    });

    test('adds search-add button when active search key matches', () => {
        const app = makeApp();
        app.search.searchTerm = 'Status:Active';
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({
            key: 'Status',
            values: ['Active'],
            quoted: false,
        }));
        const dd = new DetailDrawer(app);
        const td = dd.renderValueCell('Status', 'Active', 'Status:Active');
        expect(td.innerHTML).toContain('search-remove');
    });

    test('adds search-remove button for value not in active search', () => {
        const app = makeApp();
        app.search.searchTerm = 'Status:Active';
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({
            key: 'Status',
            values: ['Active'],
            quoted: false,
        }));
        const dd = new DetailDrawer(app);
        const td = dd.renderValueCell('Status', 'Inactive', 'Status:Active');
        expect(td.innerHTML).toContain('search-add');
    });

    test('adds toggle buttons in multi-value list when active search key matches', () => {
        const app = makeApp();
        app.search.parseActiveKeyValueSearch = jest.fn(() => ({
            key: 'Status',
            values: ['Active'],
            quoted: false,
        }));
        const dd = new DetailDrawer(app);
        const td = dd.renderValueCell('Status', 'Active||Inactive', 'Status:Active');
        expect(td.innerHTML).toContain('search-toggle');
    });
});

// ─── DetailDrawer.renderKeyCell ───────────────────────────────────────────────

describe('DetailDrawer.renderKeyCell', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="list-view" style="display:none"></div><div id="drawerContent"></div>';
        window.currentColumnKeys = ['id', 'Status'];
    });
    afterEach(() => { document.body.innerHTML = ''; });

    test('renders key label in a td', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderKeyCell('Status');
        expect(td.tagName).toBe('TD');
        expect(td.textContent).toContain('Status');
    });

    test('renders "Service Name" key using "id" col key', () => {
        const dd = new DetailDrawer(makeApp());
        const td = dd.renderKeyCell('Service Name');
        expect(td.tagName).toBe('TD');
    });
});

// ─── DetailDrawer.showNodeDetails ────────────────────────────────────────────

describe('DetailDrawer.showNodeDetails', () => {
    function setupDrawerDOM() {
        document.body.innerHTML = `
            <div id="drawer">
                <div class="drawer-header"><h2></h2></div>
            </div>
            <div id="overlay"></div>
            <div id="drawerContent"></div>
            <div id="list-view" style="display:none"></div>
        `;
        window.currentColumnKeys = ['id', 'Status'];
    }

    beforeEach(setupDrawerDOM);
    afterEach(() => {
        document.body.innerHTML = '';
        window.currentColumnKeys = [];
    });

    test('sets drawer title to Service Name', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'My Service', Status: 'Active' });
        expect(document.querySelector('.drawer-header h2').textContent).toBe('My Service');
    });

    test('opens drawer and overlay when openDrawer is true', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', Status: 'Active' }, true);
        expect(document.getElementById('drawer').classList.contains('open')).toBe(true);
        expect(document.getElementById('overlay').classList.contains('open')).toBe(true);
    });

    test('does not open drawer when openDrawer is false', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', Status: 'Active' }, false);
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('renders a table in drawerContent', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', Status: 'Active', Description: 'A service' });
        expect(document.getElementById('drawerContent').querySelector('table')).toBeTruthy();
    });

    test('excludes internal fields like x, y, color', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', x: 10, y: 20, color: '#aaa', Status: 'Active' });
        const rows = document.querySelectorAll('#drawerContent tr');
        const rowTexts = Array.from(rows).map(r => r.textContent);
        expect(rowTexts.some(t => t.includes('x'))).toBe(false);
        expect(rowTexts.some(t => t.includes('color'))).toBe(false);
    });

    test('handles node with Key field', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Key': 'KEY-123', 'Service Name': 'SvcA', Status: 'Active' });
        const table = document.getElementById('drawerContent').querySelector('table');
        expect(table).toBeTruthy();
    });

    test('handles node where Key equals id (excludes id row)', () => {
        const dd = new DetailDrawer(makeApp());
        const node = { id: 'svcA', 'Key': 'svcA', 'Service Name': 'SvcA', Status: 'Active' };
        dd.showNodeDetails(node);
        const table = document.getElementById('drawerContent').querySelector('table');
        expect(table).toBeTruthy();
    });

    test('renders datetime values', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', 'Decommission Date': '2024-06-15T10:30:00Z' });
        expect(document.getElementById('drawerContent').querySelector('table')).toBeTruthy();
    });

    test('renders URL values', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', 'Link': 'https://example.com' });
        expect(document.getElementById('drawerContent').innerHTML).toContain('<a ');
    });

    test('renders SEARCHABLE_ATTRS values as people-db links', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'SvcA', Owner: 'Alice Smith' });
        expect(document.getElementById('drawerContent').innerHTML).toContain('solitaire.html');
    });

    test('col-op button click calls listView.toggleColumn', () => {
        const app = makeApp();
        const dd = new DetailDrawer(app);
        const node = { id: 'SvcA', 'Service Name': 'SvcA', Status: 'Active' };
        dd.showNodeDetails(node);
        // Simulate a col-op button click on the table
        const table = document.getElementById('drawerContent').querySelector('table');
        const mockBtn = document.createElement('button');
        mockBtn.className = 'col-op';
        mockBtn.setAttribute('data-col', encodeURIComponent('Status'));
        table.appendChild(mockBtn);
        mockBtn.click();
        expect(app.listView.toggleColumn).toHaveBeenCalledWith('Status');
    });

    test('shows fallback title when Service Name is empty', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcB' });
        expect(document.querySelector('.drawer-header h2').textContent).toBe('Service Information');
    });

    test('uses Service Name as Key when Key is missing', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showNodeDetails({ id: 'SvcA', 'Service Name': 'My Service', Status: 'Active' });
        const table = document.getElementById('drawerContent').querySelector('table');
        expect(table).toBeTruthy();
    });
});

describe('DetailDrawer.showAbout', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="drawer">
                <div class="drawer-header"><h2>Service Information</h2></div>
                <div id="drawerContent"></div>
            </div>
            <div id="overlay"></div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('sets drawer title to About Domino', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showAbout();
        expect(document.querySelector('.drawer-header h2').textContent).toContain('Domino');
    });

    test('sets drawerContent with Domino description', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showAbout();
        const content = document.getElementById('drawerContent').innerHTML;
        expect(content).toContain('dependency');
        expect(content).toContain('CMDB');
    });

    test('adds open class to drawer and overlay', () => {
        const dd = new DetailDrawer(makeApp());
        dd.showAbout();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(true);
        expect(document.getElementById('overlay').classList.contains('open')).toBe(true);
    });

    test('does not throw when drawer elements are missing', () => {
        document.body.innerHTML = '';
        const dd = new DetailDrawer(makeApp());
        expect(() => dd.showAbout()).not.toThrow();
    });
});
