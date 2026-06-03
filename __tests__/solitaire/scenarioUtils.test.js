import { buildExpandedLayoutMapFromDom } from '../../js/solitaire/scenarioUtils.js';

describe('buildExpandedLayoutMapFromDom', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('returns empty map when no matching elements', () => {
        document.body.innerHTML = '<svg></svg>';
        expect(buildExpandedLayoutMapFromDom()).toEqual({});
    });

    test('extracts key and translate coordinates', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="stream::alpha" transform="translate(100, 200)"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(map['stream::alpha']).toEqual({ x: 100, y: 200 });
    });

    test('rounds float coordinates', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="team::a::b::c" transform="translate(10.7, 20.3)"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(map['team::a::b::c']).toEqual({ x: 11, y: 20 });
    });

    test('defaults to x=0, y=0 when no transform', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="stream::beta"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(map['stream::beta']).toEqual({ x: 0, y: 0 });
    });

    test('extracts width and height from child rect', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="theme::a::b" transform="translate(0, 0)">
                    <rect width="300" height="150"></rect>
                </g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(map['theme::a::b'].width).toBe(300);
        expect(map['theme::a::b'].height).toBe(150);
    });

    test('omits width/height when rect not present', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="stream::x" transform="translate(0,0)"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(map['stream::x'].width).toBeUndefined();
        expect(map['stream::x'].height).toBeUndefined();
    });

    test('skips elements without data-key', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" transform="translate(10, 20)"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(Object.keys(map)).toHaveLength(0);
    });

    test('handles multiple elements', () => {
        document.body.innerHTML = `
            <svg>
                <g class="draggable" data-key="stream::a" transform="translate(10, 20)"></g>
                <g class="draggable" data-key="stream::b" transform="translate(30, 40)"></g>
            </svg>
        `;
        const map = buildExpandedLayoutMapFromDom();
        expect(Object.keys(map)).toHaveLength(2);
        expect(map['stream::a']).toEqual({ x: 10, y: 20 });
        expect(map['stream::b']).toEqual({ x: 30, y: 40 });
    });
});
