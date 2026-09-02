// type: 'changelog' (default) shows "What's new: [title]" with 🚀 and an expandable item list.
// type: 'announcement' shows "📢 [title]" with no expand button — for plain one-liner notices.
// items is optional; omit it (or leave empty) for a title-only announcement.
export const ANNOUNCEMENTS = [
    {
        id: '2026-08-31',
        type: 'changelog',
        title: 'Post-it notes, search & Excel export',
        items: [
            'Post-it notes — multiple notes with editable titles and real-time URL links',
            'Custom autocomplete dropdown with compound & multi-field queries (Domino)',
            'Per-clause chip editing and full keyboard navigation in search bars',
            'Domino list view: Excel export with visible-columns / all-columns choice',
        ],
    },
];
