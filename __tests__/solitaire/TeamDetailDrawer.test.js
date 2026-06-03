import { TeamDetailDrawer } from '../../js/solitaire/TeamDetailDrawer.js';

function makeApp({ isDraggable = false } = {}) {
    return {
        interaction: { isDraggable },
    };
}

function setupDOM() {
    document.body.innerHTML = `
        <div id="drawer" aria-hidden="true"></div>
        <div id="drawer-overlay"></div>
        <button id="drawer-close"></button>
    `;
}

describe('TeamDetailDrawer constructor', () => {
    test('stores app reference', () => {
        const app = makeApp();
        const tdd = new TeamDetailDrawer(app);
        expect(tdd.app).toBe(app);
    });
});

describe('TeamDetailDrawer.close', () => {
    beforeEach(() => {
        setupDOM();
        document.getElementById('drawer').classList.add('open');
        document.getElementById('drawer-overlay').classList.add('visible');
        document.body.classList.add('drawer-open');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
    });

    test('removes open class from drawer', () => {
        new TeamDetailDrawer(makeApp()).close();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('removes visible class from overlay', () => {
        new TeamDetailDrawer(makeApp()).close();
        expect(document.getElementById('drawer-overlay').classList.contains('visible')).toBe(false);
    });

    test('sets aria-hidden to true', () => {
        new TeamDetailDrawer(makeApp()).close();
        expect(document.getElementById('drawer').getAttribute('aria-hidden')).toBe('true');
    });

    test('removes drawer-open class from body', () => {
        new TeamDetailDrawer(makeApp()).close();
        expect(document.body.classList.contains('drawer-open')).toBe(false);
    });

    test('does not throw when #drawer is missing', () => {
        document.body.innerHTML = '';
        expect(() => new TeamDetailDrawer(makeApp()).close()).not.toThrow();
    });
});

describe('TeamDetailDrawer.open', () => {
    beforeEach(() => {
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
    });

    test('does nothing when isDraggable is true', () => {
        const tdd = new TeamDetailDrawer(makeApp({ isDraggable: true }));
        tdd.open({ name: 'Team A', description: 'desc' });
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('opens the drawer and adds open class', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'Team Alpha', description: 'Our awesome team' });
        expect(document.getElementById('drawer').classList.contains('open')).toBe(true);
    });

    test('sets drawer-open class on body', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'Team Alpha' });
        expect(document.body.classList.contains('drawer-open')).toBe(true);
    });

    test('creates and sets drawer title', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'Platform Team' });
        expect(document.getElementById('drawer-title').textContent).toBe('Platform Team');
    });

    test('adds Overview section when description is provided', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', description: 'We do great things' });
        const overview = document.querySelector('[data-section-id="overview"]');
        expect(overview).toBeTruthy();
        expect(overview.open).toBe(true);
    });

    test('adds Channels section when channels are provided', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', channels: ['https://slack.com/channel/team-alpha'] });
        const channelsSec = document.querySelector('[data-section-id="channels"]');
        expect(channelsSec).toBeTruthy();
        const links = channelsSec.querySelectorAll('a');
        expect(links.length).toBe(1);
    });

    test('adds Mailbox section when email is provided', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', email: 'team@example.com' });
        expect(document.querySelector('[data-section-id="mailbox"]')).toBeTruthy();
    });

    test('adds Services section when elements are provided', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({
            name: 'T',
            elements: { items: ['SvcA', 'SvcB'] },
        });
        const servicesSec = document.querySelector('[data-section-id="services"]');
        expect(servicesSec).toBeTruthy();
        const items = servicesSec.querySelectorAll('li');
        expect(items.length).toBe(2);
    });

    test('highlights service matching highlightService', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({
            name: 'T',
            elements: { items: ['SvcA', 'SvcB'] },
            highlightService: 'SvcA',
        });
        const highlights = document.querySelectorAll('.service-hit-highlight');
        expect(highlights.length).toBeGreaterThan(0);
        expect(highlights[0].textContent).toBe('SvcA');
    });

    test('Services section renders anchor links when elementsBaseUrl is provided', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({
            name: 'T',
            elements: { items: ['SvcA'] },
            elementsBaseUrl: (s) => `domino.html?search=${s}`,
        });
        const anchors = document.querySelectorAll('#drawer-list li a');
        expect(anchors.length).toBe(1);
        expect(anchors[0].href).toContain('SvcA');
    });

    test('does not add section for empty elements array', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', elements: { items: [] } });
        expect(document.querySelector('[data-section-id="services"]')).toBeNull();
    });
});

describe('TeamDetailDrawer.initEvents', () => {
    beforeEach(() => {
        setupDOM();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
    });

    test('clicking overlay closes the drawer', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', description: 'desc' });
        tdd.initEvents();
        const overlay = document.getElementById('drawer-overlay');
        overlay.click();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });

    test('clicking close button closes the drawer', () => {
        const tdd = new TeamDetailDrawer(makeApp());
        tdd.open({ name: 'T', description: 'desc' });
        tdd.initEvents();
        document.getElementById('drawer-close').click();
        expect(document.getElementById('drawer').classList.contains('open')).toBe(false);
    });
});
