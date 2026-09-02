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

export function filterOrganizationByQuickFilter(org, constraints, rawOrg = null) {
    if (!constraints) return org;
    const {
        visibleStreams, visibleThemes, visibleTeams, visiblePeople,
        hiddenStreams,  hiddenThemes,  hiddenTeams,  hiddenPeople,
        // legacy aliases — support old keys so callers using {streams,...} still work
        streams, themes, teams,
        communityFilter,
    } = constraints;

    const vsStreams  = visibleStreams  ?? streams  ?? null;
    const vsThemes   = visibleThemes   ?? themes   ?? null;
    const vsTeams    = visibleTeams    ?? teams    ?? null;
    const vsPeople   = visiblePeople   ?? null;
    const hdStreams   = hiddenStreams   ?? null;
    const hdThemes   = hiddenThemes    ?? null;
    const hdTeams    = hiddenTeams     ?? null;
    const hdPeople   = hiddenPeople    ?? null;

    if (!vsStreams && !vsThemes && !vsTeams && !vsPeople &&
        !hdStreams && !hdThemes && !hdTeams && !hdPeople &&
        !communityFilter) return org;

    // Case-insensitive + normalizeKey matching
    const inSet = (set, value) =>
        set.has(value) || set.has(value.toLowerCase()) || set.has(normalizeKey(value));

    const passVisible = (set, value) => !set || inSet(set, value);
    const passHidden  = (set, value) => !set || !inSet(set, value);

    const result = {};
    for (const [stream, themeMap] of Object.entries(org || {})) {
        if (!passVisible(vsStreams, stream)) continue;
        if (!passHidden(hdStreams,  stream)) continue;

        const filteredThemes = {};
        for (const [theme, teamMap] of Object.entries(themeMap || {})) {
            if (!passVisible(vsThemes, theme)) continue;
            if (!passHidden(hdThemes,  theme)) continue;

            const filteredTeams = {};
            for (const [team, members] of Object.entries(teamMap || {})) {
                if (!passVisible(vsTeams, team)) continue;
                if (!passHidden(hdTeams,  team)) continue;

                if (communityFilter) {
                    let isCommunity = (members || []).some(m => !m.guestRole && m['Team Community'] === 'true');
                    if (!isCommunity && rawOrg) {
                        isCommunity = (rawOrg[stream]?.[theme]?.[team] || []).some(m => m['Team Community'] === 'true');
                    }
                    if (communityFilter === 'communities-only' && !isCommunity) continue;
                    if (communityFilter === 'teams-only'       &&  isCommunity) continue;
                }

                // Member-level filtering (only when people constraints are set)
                const filteredMembers = (vsPeople || hdPeople)
                    ? (members || []).filter(m => {
                        const name = (m?.Name ?? '').trim();
                        return passVisible(vsPeople, name) && passHidden(hdPeople, name);
                    })
                    : members;

                if (!filteredMembers || filteredMembers.length === 0) continue;
                filteredTeams[team] = filteredMembers;
            }
            if (Object.keys(filteredTeams).length > 0) {
                filteredThemes[theme] = filteredTeams;
            }
        }
        if (Object.keys(filteredThemes).length > 0) {
            result[stream] = filteredThemes;
        }
    }
    return result;
}

export function filterDismissedTeams(org, referenceDate = new Date()) {
    const result = {};
    for (const [stream, themeMap] of Object.entries(org || {})) {
        const filteredThemes = {};
        for (const [theme, teamMap] of Object.entries(themeMap || {})) {
            const filteredTeams = {};
            for (const [team, members] of Object.entries(teamMap || {})) {
                const dismissedOn = (members || []).find(m => !m.guestRole && m['Team Dismissed On'])?.['Team Dismissed On'];
                if (dismissedOn) {
                    const d = new Date(dismissedOn);
                    if (!isNaN(d) && d < referenceDate) continue;
                }
                filteredTeams[team] = members;
            }
            if (Object.keys(filteredTeams).length > 0) filteredThemes[theme] = filteredTeams;
        }
        if (Object.keys(filteredThemes).length > 0) result[stream] = filteredThemes;
    }
    return result;
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
    const full = teamTitleEl?.getAttribute?.('data-full-name');
    if (full) return full.trim();
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
