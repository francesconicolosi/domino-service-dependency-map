import { parseSectionMeta } from '../../js/shared/utils.js';

describe('parseSectionMeta', () => {
    test('returns clean=raw, roi=null, topPriority=null when no § present', () => {
        const r = parseSectionMeta('Apple pay missing on checkout');
        expect(r).toEqual({ clean: 'Apple pay missing on checkout', roi: null, topPriority: null });
    });

    test('strips §[RoiWW] and returns roi="WW"', () => {
        const r = parseSectionMeta('Some incident§[RoiWW]');
        expect(r.clean).toBe('Some incident');
        expect(r.roi).toBe('WW');
        expect(r.topPriority).toBeNull();
    });

    test('strips §[RoiKR] and returns roi="KR"', () => {
        const r = parseSectionMeta('Triggered: alert§[RoiKR]');
        expect(r.clean).toBe('Triggered: alert');
        expect(r.roi).toBe('KR');
    });

    test('parses §[TopPriority P2/Critical,RoiUSCA]', () => {
        const r = parseSectionMeta('Invalid estimated delivery date§[TopPriority P2/Critical,RoiUSCA]');
        expect(r.clean).toBe('Invalid estimated delivery date');
        expect(r.roi).toBe('USCA');
        expect(r.topPriority).toBe('P2/Critical');
    });

    test('token order does not matter (Roi before TopPriority)', () => {
        const r = parseSectionMeta('Title§[RoiEMEA,TopPriority P1/Blocker]');
        expect(r.roi).toBe('EMEA');
        expect(r.topPriority).toBe('P1/Blocker');
    });

    test('returns empty clean string for null input', () => {
        const r = parseSectionMeta(null);
        expect(r).toEqual({ clean: '', roi: null, topPriority: null });
    });

    test('returns empty clean string for empty string input', () => {
        const r = parseSectionMeta('');
        expect(r).toEqual({ clean: '', roi: null, topPriority: null });
    });

    test('trims whitespace before §', () => {
        const r = parseSectionMeta('Title  §[RoiUS]');
        expect(r.clean).toBe('Title');
        expect(r.roi).toBe('US');
    });
});
