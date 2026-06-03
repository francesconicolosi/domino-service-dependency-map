import { ContextMenu } from '../../js/solitaire/ContextMenu.js';

function makeApp() {
    return {
        interaction: {
            mode: 'free-pan',
            setMode: jest.fn(),
        },
        scenario: { handleAction: jest.fn() },
        showToast: jest.fn(),
    };
}

describe('ContextMenu constructor', () => {
    test('initializes with null menuEl and marqueeEl', () => {
        const cm = new ContextMenu(makeApp());
        expect(cm.menuEl).toBeNull();
        expect(cm.marqueeEl).toBeNull();
    });
});

describe('ContextMenu.ensureMarquee', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('creates marquee element on first call', () => {
        const cm = new ContextMenu(makeApp());
        const el = cm.ensureMarquee();
        expect(el).toBeTruthy();
        expect(el.tagName).toBeTruthy();
        expect(cm.marqueeEl).toBe(el);
    });

    test('returns same element on subsequent calls', () => {
        const cm = new ContextMenu(makeApp());
        const el1 = cm.ensureMarquee();
        const el2 = cm.ensureMarquee();
        expect(el1).toBe(el2);
    });
});

describe('ContextMenu.hideMarquee', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('does not throw when marqueeEl is null', () => {
        const cm = new ContextMenu(makeApp());
        expect(() => cm.hideMarquee()).not.toThrow();
    });

    test('hides the marquee element', () => {
        const cm = new ContextMenu(makeApp());
        cm.ensureMarquee();
        cm.hideMarquee();
        const style = cm.marqueeEl.style;
        expect(style.display === 'none' || style.width === '0' || cm.marqueeEl.hidden).toBeTruthy();
    });
});

describe('ContextMenu.ensureMenu', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('creates menu element and appends to body', () => {
        const cm = new ContextMenu(makeApp());
        const menu = cm.ensureMenu();
        expect(menu).toBeTruthy();
        expect(cm.menuEl).toBe(menu);
    });

    test('returns same menu element on subsequent calls', () => {
        const cm = new ContextMenu(makeApp());
        const menu1 = cm.ensureMenu();
        const menu2 = cm.ensureMenu();
        expect(menu1).toBe(menu2);
    });

    test('menu contains mode buttons', () => {
        const cm = new ContextMenu(makeApp());
        cm.ensureMenu();
        const btns = cm.menuEl.querySelectorAll('button');
        expect(btns.length).toBeGreaterThan(0);
    });
});

describe('ContextMenu.show / hide', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('show positions the menu and makes it visible', () => {
        const cm = new ContextMenu(makeApp());
        cm.show(100, 200);
        const menu = cm.menuEl;
        expect(menu).toBeTruthy();
        const visible = menu.style.display !== 'none' && !menu.hidden;
        expect(visible).toBe(true);
    });

    test('hide makes the menu invisible', () => {
        const cm = new ContextMenu(makeApp());
        cm.show(100, 200);
        cm.hide();
        const menu = cm.menuEl;
        const hidden = menu.style.display === 'none' || menu.hidden || !menu.style.display || menu.style.visibility === 'hidden';
        expect(hidden).toBe(true);
    });

    test('pressing Escape removes visible class from the menu', () => {
        const cm = new ContextMenu(makeApp());
        cm.show(10, 10);
        expect(cm.menuEl.classList.contains('visible')).toBe(true);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        window.dispatchEvent(event);
        expect(cm.menuEl.classList.contains('visible')).toBe(false);
    });
});

// ─── ContextMenu ensureMenu click handlers ────────────────────────────────────

describe('ContextMenu menu click handlers', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('clicking mode button calls interaction.setMode and hides menu', () => {
        const app = makeApp();
        const cm = new ContextMenu(app);
        cm.show(10, 10);
        const dragBtn = cm.menuEl.querySelector('button[data-mode="drag"]');
        expect(dragBtn).toBeTruthy();
        dragBtn.click();
        expect(app.interaction.setMode).toHaveBeenCalledWith('drag');
    });

    test('clicking action button calls scenario.handleAction', () => {
        const app = makeApp();
        app.scenario.handleAction = jest.fn(() => Promise.resolve());
        const cm = new ContextMenu(app);
        cm.show(10, 10);
        const saveBtn = cm.menuEl.querySelector('button[data-action="save"]');
        expect(saveBtn).toBeTruthy();
        saveBtn.click();
        expect(app.scenario.handleAction).toHaveBeenCalledWith('save');
    });

    test('clicking non-button inside menu does nothing', () => {
        const app = makeApp();
        const cm = new ContextMenu(app);
        cm.show(10, 10);
        // Click on the menu element itself (no button target)
        const e = new MouseEvent('click', { bubbles: true });
        cm.menuEl.dispatchEvent(e);
        expect(app.interaction.setMode).not.toHaveBeenCalled();
    });

    test('contextmenu event on menu does not propagate', () => {
        const cm = new ContextMenu(makeApp());
        cm.ensureMenu();
        const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        expect(() => cm.menuEl.dispatchEvent(e)).not.toThrow();
    });

    test('pointerdown outside menu hides it', () => {
        const cm = new ContextMenu(makeApp());
        cm.show(10, 10);
        expect(cm.menuEl.classList.contains('visible')).toBe(true);
        document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(cm.menuEl.classList.contains('visible')).toBe(false);
    });

    test('pointerdown inside menu does not hide it', () => {
        const cm = new ContextMenu(makeApp());
        cm.show(10, 10);
        const btn = cm.menuEl.querySelector('button');
        btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(cm.menuEl.classList.contains('visible')).toBe(true);
    });
});
