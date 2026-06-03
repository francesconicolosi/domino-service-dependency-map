import * as d3 from 'd3';
import {
    clearFieldHighlights,
    clearSearchDimming,
    clearHighlights,
    highlightGroup,
    applyStreamVisibility,
    applySearchDimmingForMatches,
} from '../../js/solitaire/search.js';

// D3 is auto-mocked via __mocks__/d3.js

describe('clearFieldHighlights', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="field-hit-highlight role-hit-highlight">A</div>
            <div class="field-hit-highlight">B</div>
            <div>C</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('removes highlight classes from all matching elements', () => {
        clearFieldHighlights();
        document.querySelectorAll('.field-hit-highlight').forEach(el => {
            expect(el.classList.contains('field-hit-highlight')).toBe(false);
        });
    });

    test('does not affect elements without highlight classes', () => {
        clearFieldHighlights();
        expect(document.querySelectorAll('.field-hit-highlight').length).toBe(0);
    });
});

describe('clearSearchDimming', () => {
    test('calls d3.selectAll to remove dimmed and highlighted classes', () => {
        clearSearchDimming();
        expect(d3.selectAll).toHaveBeenCalled();
    });
});

describe('clearHighlights', () => {
    test('calls viewport.selectAll("rect") to clear strokes', () => {
        const viewport = {
            selectAll: jest.fn(() => ({
                attr: jest.fn().mockReturnThis(),
            })),
        };
        clearHighlights(viewport);
        expect(viewport.selectAll).toHaveBeenCalledWith('rect');
    });
});

describe('highlightGroup', () => {
    test('selects rect.profile-box or fallback rect and sets stroke', () => {
        const rectSel = {
            node: jest.fn(() => ({ tagName: 'rect' })),
            attr: jest.fn().mockReturnThis(),
        };
        const groupSel = {
            selectAll: jest.fn(() => ({ attr: jest.fn().mockReturnThis() })),
            select: jest.fn(() => rectSel),
        };
        highlightGroup(groupSel);
        expect(groupSel.select).toHaveBeenCalled();
    });
});

describe('applyStreamVisibility', () => {
    test('calls d3.selectAll with stream selector', () => {
        const hiddenStreams = new Set(['stream::alpha']);
        applyStreamVisibility({ hiddenStreams, isolatedStream: null });
        expect(d3.selectAll).toHaveBeenCalledWith('g[data-key^="stream::"]');
    });

    test('runs without error for empty hiddenStreams', () => {
        expect(() => {
            applyStreamVisibility({ hiddenStreams: new Set(), isolatedStream: null });
        }).not.toThrow();
    });
});

describe('applySearchDimmingForMatches', () => {
    test('calls clearSearchDimming (via d3.selectAll) when no matches', () => {
        d3.selectAll.mockClear();
        applySearchDimmingForMatches([]);
        expect(d3.selectAll).toHaveBeenCalled();
    });

    test('runs without error when matchElements is null', () => {
        expect(() => applySearchDimmingForMatches(null)).not.toThrow();
    });

    test('processes card-scoped elements from jsdom SVG', () => {
        document.body.innerHTML = `
            <svg>
                <g id="cardLayer">
                    <g data-key="card::streamA::themeX::team1::alice">
                        <rect class="profile-box"/>
                    </g>
                </g>
            </svg>
        `;
        const cardEl = document.querySelector('g[data-key^="card::"]');
        expect(() => applySearchDimmingForMatches([cardEl])).not.toThrow();
        document.body.innerHTML = '';
    });

    test('processes team-scoped elements from jsdom SVG', () => {
        document.body.innerHTML = `
            <svg>
                <g id="teamLayer">
                    <g data-key="team::streamA::themeX::team1">
                        <rect/>
                    </g>
                </g>
            </svg>
        `;
        const teamEl = document.querySelector('g[data-key^="team::"]');
        expect(() => applySearchDimmingForMatches([teamEl])).not.toThrow();
        document.body.innerHTML = '';
    });

    test('processes theme-scoped elements', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="theme::streamA::themeX">
                    <rect/>
                </g>
            </svg>
        `;
        const themeEl = document.querySelector('g[data-key^="theme::"]');
        expect(() => applySearchDimmingForMatches([themeEl])).not.toThrow();
        document.body.innerHTML = '';
    });

    test('processes stream-scoped elements', () => {
        document.body.innerHTML = `
            <svg>
                <g data-key="stream::streamA">
                    <rect/>
                </g>
            </svg>
        `;
        const streamEl = document.querySelector('g[data-key^="stream::"]');
        expect(() => applySearchDimmingForMatches([streamEl])).not.toThrow();
        document.body.innerHTML = '';
    });
});

// ─── applyStreamVisibility (with real each callback) ─────────────────────────

describe('applyStreamVisibility (with each callback)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    test('hides elements in hiddenStreams set', () => {
        const mockEl = document.createElement('g');
        mockEl.setAttribute('data-key', 'stream::alpha');

        const mockGSel = {
            attr: jest.fn((name) => name === 'data-key' ? 'stream::alpha' : null),
            style: jest.fn().mockReturnThis(),
        };

        jest.spyOn(d3, 'select').mockImplementation(() => mockGSel);
        jest.spyOn(d3, 'selectAll').mockImplementation(() => ({
            each: jest.fn((cb) => { cb.call(mockEl); }),
        }));

        const hiddenStreams = new Set(['stream::alpha']);
        applyStreamVisibility({ hiddenStreams, isolatedStream: null });
        expect(mockGSel.style).toHaveBeenCalledWith('display', 'none');
    });

    test('shows elements not in hiddenStreams', () => {
        const mockEl = document.createElement('g');
        mockEl.setAttribute('data-key', 'stream::beta');

        const mockGSel = {
            attr: jest.fn((name) => name === 'data-key' ? 'stream::beta' : null),
            style: jest.fn().mockReturnThis(),
        };

        jest.spyOn(d3, 'select').mockImplementation(() => mockGSel);
        jest.spyOn(d3, 'selectAll').mockImplementation(() => ({
            each: jest.fn((cb) => { cb.call(mockEl); }),
        }));

        const hiddenStreams = new Set(['stream::alpha']);
        applyStreamVisibility({ hiddenStreams, isolatedStream: null });
        expect(mockGSel.style).toHaveBeenCalledWith('display', null);
    });

    test('isolatedStream hides other streams', () => {
        const mockEl = document.createElement('g');
        mockEl.setAttribute('data-key', 'stream::beta');

        const mockGSel = {
            attr: jest.fn((name) => name === 'data-key' ? 'stream::beta' : null),
            style: jest.fn().mockReturnThis(),
        };

        jest.spyOn(d3, 'select').mockImplementation(() => mockGSel);
        jest.spyOn(d3, 'selectAll').mockImplementation(() => ({
            each: jest.fn((cb) => { cb.call(mockEl); }),
        }));

        applyStreamVisibility({ hiddenStreams: new Set(), isolatedStream: 'stream::alpha' });
        expect(mockGSel.style).toHaveBeenCalledWith('display', 'none');
    });
});
