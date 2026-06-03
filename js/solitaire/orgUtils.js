import { normalizeWs, normalizeKey, getQueryParam } from '../shared/utils.js';
import { firstLevelNA, secondLevelNA, emailField } from './constants.js';

export function getAllowedStreamsSet() {
    const streamFilterParam = getQueryParam('stream');
    if (!streamFilterParam) return null;
    const items = streamFilterParam.split(',').map(s => s.trim()).filter(Boolean);
    const set = new Set();
    items.forEach(x => { set.add(x); set.add(normalizeKey(x)); });
    return set;
}

export function buildCompositeKey(person, emailFieldParam = emailField) {
    const name = normalizeWs(person?.Name);
    const email = normalizeWs(person?.[emailFieldParam]);
    return (email || name) ? `${name}::${email}` : '';
}

export function collectMembersFromOrganization(filteredOrg) {
    const out = [];
    for (const themes of Object.values(filteredOrg)) {
        for (const teams of Object.values(themes)) {
            for (const members of Object.values(teams)) {
                out.push(...members);
            }
        }
    }
    return out;
}

export function filterOrganizationByStreams(org, allowed) {
    if (!allowed || allowed.size === 0) return org;
    const out = {};
    for (const [stream, themes] of Object.entries(org || {})) {
        const ok = allowed.has(stream) || allowed.has(normalizeKey(stream));
        if (ok) out[stream] = themes;
    }
    return out;
}

export function getVisiblePeopleForLegend(people, allowedStreams, firstOrgLevel) {
    if (!allowedStreams || allowedStreams.size === 0) return people;
    return people.filter(p => {
        const raw = (p[firstOrgLevel] || '').toString().trim();
        if (!raw) return false;
        const items = raw.split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (items.length === 0) return false;
        return items.some(item => allowedStreams.has(item) || allowedStreams.has(normalizeKey(item)));
    });
}

export function countTeamsForMemberInOrg(member, org, emailFieldParam = emailField) {
    const targetKey = buildCompositeKey(member, emailFieldParam);
    if (!targetKey) return 0;
    let count = 0;
    for (const [streamName, themes] of Object.entries(org || {})) {
        if (streamName.toLowerCase().includes(firstLevelNA.toLowerCase())) continue;
        for (const [themeName, teams] of Object.entries(themes || {})) {
            if (themeName.toLowerCase().includes(secondLevelNA.toLowerCase())) continue;
            for (const members of Object.values(teams || {})) {
                const found = (members || []).some(
                    m => buildCompositeKey(m, emailFieldParam) === targetKey
                );
                if (found) count++;
            }
        }
    }
    return count;
}

export function getNameFromTitleEl(teamTitleEl) {
    const raw = teamTitleEl?.textContent || '';
    return raw.replace(/\s*-\s*⚙️.*$/, '').trim();
}

export function isOnlyContributorsRow(member) {
    const n = (member?.Name ?? '').toString().trim();
    return /^OnlyContributors#\d+$/i.test(n);
}

export function hasTeamDrawerContent({ description, services, channels, email }) {
    return Boolean(
        (description && description.trim()) ||
        (services?.items && services.items.length > 0) ||
        (channels && channels.length > 0) ||
        (email && email.trim())
    );
}
