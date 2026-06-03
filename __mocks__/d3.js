// Manual mock for D3 — applied automatically to all imports of 'd3' in tests.

function makeSelection() {
    const sel = {};
    const chainMethods = [
        'append', 'attr', 'style', 'classed', 'text', 'html', 'on', 'call',
        'each', 'transition', 'duration', 'raise', 'lower', 'remove', 'filter',
        'property', 'dispatch', 'datum',
    ];
    chainMethods.forEach(m => { sel[m] = jest.fn(() => sel); });

    sel.select    = jest.fn(() => makeSelection());
    sel.selectAll = jest.fn(() => makeSelection());
    sel.data      = jest.fn(() => makeSelection());
    sel.enter     = jest.fn(() => makeSelection());
    sel.exit      = jest.fn(() => makeSelection());

    sel.node = jest.fn(() => ({
        getBBox: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
        getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 })),
        getAttribute: jest.fn(() => null),
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        querySelector: jest.fn(() => null),
        contains: jest.fn(() => false),
        addEventListener: jest.fn(),
        clientWidth: 800,
        clientHeight: 600,
    }));
    sel.empty = jest.fn(() => false);
    sel.size  = jest.fn(() => 1);
    return sel;
}

const makeTransform = () => {
    const t = {
        translate: jest.fn(() => makeTransform()),
        scale: jest.fn(() => makeTransform()),
        invert: jest.fn(v => (Array.isArray(v) ? v : [0, 0])),
        apply: jest.fn(v => (Array.isArray(v) ? v : [0, 0])),
        k: 1, x: 0, y: 0,
    };
    return t;
};

const zoomIdentity = makeTransform();

const makeZoom = () => {
    const zoom = jest.fn();
    zoom.filter = jest.fn(() => zoom);
    zoom.scaleExtent = jest.fn(() => zoom);
    zoom.translateExtent = jest.fn(() => zoom);
    zoom.extent = jest.fn(() => zoom);
    zoom.on = jest.fn(() => zoom);
    zoom.transform = jest.fn(() => zoom);
    zoom.scaleBy = jest.fn(() => zoom);
    return zoom;
};

const makeDrag = () => {
    const drag = jest.fn();
    drag.container = jest.fn(() => drag);
    drag.on = jest.fn(() => drag);
    drag.subject = jest.fn(() => drag);
    return drag;
};

module.exports = {
    select:    jest.fn(() => makeSelection()),
    selectAll: jest.fn(() => makeSelection()),

    zoom: jest.fn(() => makeZoom()),
    drag: jest.fn(() => makeDrag()),

    zoomTransform: jest.fn(() => makeTransform()),
    zoomIdentity,

    scaleOrdinal: jest.fn(() => {
        const scale = jest.fn(() => '#1f77b4');
        scale.domain = jest.fn(() => []);
        scale.range  = jest.fn(() => scale);
        scale.isGuest  = jest.fn(() => false);
        scale.colorOf  = jest.fn(() => '#1f77b4');
        return scale;
    }),

    schemeCategory10: [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    ],
    schemeTableau10: [
        '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
        '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
    ],

    forceSimulation: jest.fn(() => ({
        force: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        alphaDecay: jest.fn().mockReturnThis(),
        alphaTarget: jest.fn().mockReturnThis(),
        restart: jest.fn().mockReturnThis(),
        stop: jest.fn().mockReturnThis(),
        nodes: jest.fn(() => []),
        tick: jest.fn().mockReturnThis(),
    })),
    forceLink: jest.fn(() => ({
        id: jest.fn().mockReturnThis(),
        distance: jest.fn().mockReturnThis(),
        strength: jest.fn().mockReturnThis(),
    })),
    forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
    forceCenter:   jest.fn(() => ({})),

    pointer:  jest.fn(() => [0, 0]),
    csvParse: jest.fn(() => Object.assign([], { columns: [] })),
};
