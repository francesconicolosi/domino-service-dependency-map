import {
    descriptionFields,
    LABEL_FOR_KEY,
    labelForKey,
    getCellValue,
} from '../../js/domino/columns.js';

// ─── descriptionFields ────────────────────────────────────────────────────────

describe('descriptionFields', () => {
    test('is an array of strings', () => {
        expect(Array.isArray(descriptionFields)).toBe(true);
        descriptionFields.forEach(f => expect(typeof f).toBe('string'));
    });

    test('contains expected field names', () => {
        expect(descriptionFields).toContain('Description');
    });
});

// ─── LABEL_FOR_KEY ────────────────────────────────────────────────────────────

describe('LABEL_FOR_KEY', () => {
    test('maps "id" to "ID"', () => {
        expect(LABEL_FOR_KEY.id).toBe('ID');
    });
});

// ─── labelForKey ──────────────────────────────────────────────────────────────

describe('labelForKey', () => {
    test('returns "ID" for key "id"', () => {
        expect(labelForKey('id')).toBe('ID');
    });

    test('returns the key unchanged for unmapped keys', () => {
        expect(labelForKey('Name')).toBe('Name');
        expect(labelForKey('Status')).toBe('Status');
    });
});

// ─── getCellValue ─────────────────────────────────────────────────────────────

describe('getCellValue', () => {
    test('returns node.id for key "id"', () => {
        expect(getCellValue({ id: 'SVC-001' }, 'id')).toBe('SVC-001');
    });

    test('returns empty string when node.id is missing', () => {
        expect(getCellValue({}, 'id')).toBe('');
    });

    test('returns raw value for normal key', () => {
        expect(getCellValue({ Name: 'My Service' }, 'Name')).toBe('My Service');
    });

    test('returns empty string when key is missing from node', () => {
        expect(getCellValue({}, 'Name')).toBe('');
    });

    test('"Depends on" key joins multi-line values with comma', () => {
        const node = { 'Depends on': 'ServiceA\nServiceB\nServiceC' };
        expect(getCellValue(node, 'Depends on')).toBe('ServiceA, ServiceB, ServiceC');
    });

    test('"Depends on" key filters blank lines', () => {
        const node = { 'Depends on': 'ServiceA\n\nServiceB' };
        expect(getCellValue(node, 'Depends on')).toBe('ServiceA, ServiceB');
    });

    test('"Decommission Date" with valid ISO date returns formatted string', () => {
        const node = { 'Decommission Date': '2024-06-15T00:00:00.000Z' };
        const result = getCellValue(node, 'Decommission Date');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toMatch(/2024/);
    });

    test('"Decommission Date" with invalid date returns raw value', () => {
        const node = { 'Decommission Date': 'not-a-date' };
        expect(getCellValue(node, 'Decommission Date')).toBe('not-a-date');
    });

    test('"Decommission Date" with empty value returns empty string', () => {
        const node = { 'Decommission Date': '' };
        expect(getCellValue(node, 'Decommission Date')).toBe('');
    });

    test('handles null/undefined node gracefully', () => {
        expect(getCellValue(null, 'id')).toBe('');
        expect(getCellValue(undefined, 'Name')).toBe('');
    });
});
