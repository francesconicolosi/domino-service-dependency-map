import {
    closeSideDrawer,
    isMobileDevice,
    buildFallbackMailToLink,
    openOutlookWebCompose,
    createModal,
} from '../shared/utils.js';

function splitFirstLast(fullName = '') {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function buildPersonReportBody(member = {}, ctx) {
    const { firstLevel, secondLevel, thirdLevel } = ctx || {};
    const name = (member['Name'] || '').trim();
    const { firstName, lastName } = splitFirstLast(name);
    const company = member['Company'] || member['Company Name'] || '';
    const role = member['Role'] || member['Role Name'] || member['Role Title'] || '';
    const startDate = member['In team since'] || '';
    const location = member['Location'] || '';
    const room = member['Room Link'] || member['Room'] || '';
    const lineManager = member['Line Manager'] || member['Manager'] || '';
    const team = thirdLevel || member['Team member of'] || [firstLevel, secondLevel, thirdLevel].filter(Boolean).join(' / ');
    return [
        'Hello,',
        '',
        'I would like to report the need for an update to the People Database:',
        '',
        `FIRST NAME: ${firstName}`,
        `LAST NAME: ${lastName}`,
        `COMPANY NAME: ${company} (unchanged – remove if updated)`,
        `TEAM: ${team} (unchanged – remove if updated)`,
        `ROLE: ${role} (unchanged – remove if updated)`,
        `START DATE (for new Joiners or movers): ${startDate} (unchanged – remove if updated)`,
        `END DATE (for leavers): (unchanged – remove if updated)`,
        `LOCATION: ${location} (unchanged – remove if updated)`,
        `ROOM: ${room} (unchanged – remove if updated)`,
        `LINE MANAGER: ${lineManager} (unchanged – remove if updated)`,
        `PHOTO: `,
        '',
        'Regards,'
    ].join('\n');
}

export function askModal() {
    return createModal({
        title: 'Include Portfolio Team?',
        html: `Notify also the Portfolio Team about changes to Team, Start Date, or End Date? If not included, only Service Management will be informed and will handle the update.`,
        buttons: [
            { id: 'cancel', label: 'Cancel' },
            { id: 'skip', label: "Don't include" },
            { id: 'include', label: 'Include', primary: true }
        ]
    }).then(answer => {
        if (answer === 'include') return true;
        if (answer === 'skip') return false;
        return null;
    });
}

export function askHideStreamModal(streamName) {
    return createModal({
        title: `Hide stream "${streamName}"?`,
        html: `
      This stream will be temporarily hidden.<br><br>
      The URL in your browser bar will update and can be reused as a permalink
      to load this filtered view.<br><br>
      To restore the full view, click the ❌ next to the search bar.
    `,
        buttons: [
            { id: 'cancel', label: 'Cancel' },
            { id: 'confirm', label: 'Hide stream', primary: true }
        ]
    }).then(answer => answer === 'confirm');
}

export async function openPersonReportCompose(peopleDBUpdateRecipients, portfolioDBUpdateRecipients, member, ctx) {
    const to = [...(Array.isArray(peopleDBUpdateRecipients) ? peopleDBUpdateRecipients : [])];
    const decision = await askModal();
    if (decision === null) {
        closeSideDrawer();
        return;
    }
    if (decision === true) {
        to.push(...portfolioDBUpdateRecipients);
    }
    const subject = `Request for People Database Update - ${member?.Name ?? ''}`;
    const body = buildPersonReportBody(member, ctx);
    try {
        if (isMobileDevice()) {
            buildFallbackMailToLink(to, subject, body);
        } else {
            openOutlookWebCompose({ to, cc: [], bcc: [], subject, body });
        }
    } catch (e) {
        console.warn('openPersonReportCompose error:', e);
        buildFallbackMailToLink(to, subject, body);
    }
}
