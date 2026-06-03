import {
    buildPersonReportBody,
    askModal,
    askHideStreamModal,
} from '../../js/solitaire/personReport.js';
import { BRAND } from '../../brand-specific/brand.js';

describe('buildPersonReportBody', () => {
    test('includes first and last name', () => {
        const body = buildPersonReportBody({ Name: 'Alice Smith' }, {});
        expect(body).toContain('FIRST NAME: Alice');
        expect(body).toContain('LAST NAME: Smith');
    });

    test('handles single-word name', () => {
        const body = buildPersonReportBody({ Name: 'Alice' }, {});
        expect(body).toContain('FIRST NAME: Alice');
        expect(body).toContain('LAST NAME: ');
    });

    test('handles empty name', () => {
        const body = buildPersonReportBody({ Name: '' }, {});
        expect(body).toContain('FIRST NAME: ');
    });

    test('includes company, role, and location', () => {
        const member = {
            Name: 'Bob Jones',
            Company: BRAND.name,
            Role: 'Engineer',
            Location: 'Florence',
        };
        const body = buildPersonReportBody(member, {});
        expect(body).toContain(`COMPANY NAME: ${BRAND.name}`);
        expect(body).toContain('ROLE: Engineer');
        expect(body).toContain('LOCATION: Florence');
    });

    test('uses ctx.thirdLevel for TEAM field', () => {
        const body = buildPersonReportBody({ Name: 'Alice' }, { thirdLevel: 'Platform Team' });
        expect(body).toContain('TEAM: Platform Team');
    });

    test('falls back to member["Team member of"] when ctx is empty', () => {
        const body = buildPersonReportBody({ Name: 'Alice', 'Team member of': 'Core Team' }, {});
        expect(body).toContain('TEAM: Core Team');
    });

    test('includes standard template lines', () => {
        const body = buildPersonReportBody({ Name: 'Test' }, {});
        expect(body).toContain('Hello,');
        expect(body).toContain('Regards,');
        expect(body).toContain('PHOTO: ');
    });

    test('includes start date and line manager placeholders', () => {
        const member = {
            Name: 'Alice',
            'In team since': '2023-01-01',
            'Line Manager': 'Bob',
        };
        const body = buildPersonReportBody(member, {});
        expect(body).toContain('START DATE');
        expect(body).toContain('LINE MANAGER: Bob');
    });

    test('falls back to alternative field names for role and company', () => {
        const member = {
            Name: 'Eve',
            'Role Name': 'Analyst',
            'Company Name': 'Accenture',
        };
        const body = buildPersonReportBody(member, {});
        expect(body).toContain('ROLE: Analyst');
        expect(body).toContain('COMPANY NAME: Accenture');
    });

    test('works with undefined member', () => {
        expect(() => buildPersonReportBody(undefined, {})).not.toThrow();
    });
});

describe('askModal', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('adds modal overlay to DOM', () => {
        const promise = askModal();
        expect(document.querySelector('.simple-modal__overlay')).toBeTruthy();
        // Cancel the modal by clicking overlay
        document.querySelector('.simple-modal__overlay').click();
        return promise;
    });

    test('resolves with true when Include is clicked', async () => {
        const promise = askModal();
        const includeBtn = document.querySelector('[data-action="include"]');
        includeBtn.click();
        const result = await promise;
        expect(result).toBe(true);
    });

    test('resolves with false when "Don\'t include" is clicked', async () => {
        const promise = askModal();
        const skipBtn = document.querySelector('[data-action="skip"]');
        skipBtn.click();
        const result = await promise;
        expect(result).toBe(false);
    });

    test('resolves with null when Cancel is clicked', async () => {
        const promise = askModal();
        const cancelBtn = document.querySelector('[data-action="cancel"]');
        cancelBtn.click();
        const result = await promise;
        expect(result).toBeNull();
    });

    test('resolves with null when overlay (backdrop) is clicked', async () => {
        const promise = askModal();
        const overlay = document.querySelector('.simple-modal__overlay');
        overlay.click();
        const result = await promise;
        expect(result).toBeNull();
    });
});

describe('askHideStreamModal', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('adds modal overlay to DOM', () => {
        const promise = askHideStreamModal('Alpha');
        expect(document.querySelector('.simple-modal__overlay')).toBeTruthy();
        document.querySelector('.simple-modal__overlay').click();
        return promise;
    });

    test('resolves with true when Hide stream is confirmed', async () => {
        const promise = askHideStreamModal('Alpha');
        document.querySelector('[data-action="confirm"]').click();
        expect(await promise).toBe(true);
    });

    test('resolves with false when Cancel is clicked', async () => {
        const promise = askHideStreamModal('Alpha');
        document.querySelector('[data-action="cancel"]').click();
        expect(await promise).toBe(false);
    });
});
