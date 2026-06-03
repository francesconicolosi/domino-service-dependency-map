import { computeJiraIssuesValue } from '../../js/domino/jira.js';
import { BRAND } from '../../brand-specific/brand.js';

describe('computeJiraIssuesValue', () => {
    test('returns empty string when node has no id', () => {
        expect(computeJiraIssuesValue({})).toBe('');
        expect(computeJiraIssuesValue(null)).toBe('');
        expect(computeJiraIssuesValue(undefined)).toBe('');
    });

    test('returns a Jira URL for a node with an id', () => {
        const result = computeJiraIssuesValue({ id: 'My Service' });
        expect(result).toContain(BRAND.jira.siteUrl);
        expect(result).toContain('jql=');
    });

    test('URL-encodes the JQL', () => {
        const result = computeJiraIssuesValue({ id: 'My Service' });
        expect(result).not.toContain(' ');
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        expect(decoded).toContain('cf[14139]');
    });

    test('lowercases and strips special chars for id variants', () => {
        const result = computeJiraIssuesValue({ id: 'My-Service' });
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        expect(decoded).toContain('"myservice"');
    });

    test('includes hyphenated variant in JQL', () => {
        const result = computeJiraIssuesValue({ id: 'my-service' });
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        expect(decoded).toContain('"my-service"');
    });

    test('includes underscore variant in JQL', () => {
        const result = computeJiraIssuesValue({ id: 'my-service' });
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        expect(decoded).toContain('"my_service"');
    });

    test('deduplicates variants when id has no special chars', () => {
        const result = computeJiraIssuesValue({ id: 'myservice' });
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        // all variants are the same; should appear only once in the in(...) list
        const matches = decoded.match(/"myservice"/g);
        expect(matches).toHaveLength(1);
    });

    test('handles id with leading/trailing whitespace', () => {
        const result = computeJiraIssuesValue({ id: '  svc  ' });
        expect(result).toContain('jql=');
        const decoded = decodeURIComponent(result.split('jql=')[1]);
        expect(decoded).toContain('"svc"');
    });
});
