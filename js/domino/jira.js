import { BRAND } from '../../brand-specific/brand.js';

export function computeJiraIssuesValue(node) {
    if (!node?.id) return '';
    const rawId = (node.id ?? '').toLowerCase().trim();
    const noSpaces = rawId.replace(/\s+/g, '');
    const noPunct = noSpaces.replace(/[^\w]/g, '');
    const keepHyphen = noSpaces.replace(/[^\w-]/g, '');
    const hyphenToUnderscore = keepHyphen
        .replace(/-/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    const values = Array.from(new Set([noPunct, keepHyphen, hyphenToUnderscore].filter(Boolean)));
    const inList = values.map(v => `"${v}"`).join(', ');

    const jql = `
   (
     project = "${BRAND.jira.managedServicesProject}" AND statusCategory in (EMPTY, "To Do", "In Progress")
     OR
     project = GDT AND statusCategory in (EMPTY, "To Do", "In Progress")
     AND labels in (bug-from-incident, from_l1_portal) AND issuetype = Bug
   )
   AND "Theme[Checkboxes]" in (App, "Brand & Content", Krypto, Content, Cross, Omni, "Product Discovery", Purchase, Loyalty, "IT 4 IT")
   AND cf[14139] in (${inList})
   ORDER BY created ASC
 `.replace(/\s+/g, ' ').trim();
    return `${BRAND.jira.siteUrl}/issues/?jql=${encodeURIComponent(jql)}`;
}
