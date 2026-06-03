import { SECOND_LEVEL_LABEL_EXTRA, MAX_TEAMS_PER_ROW, secondLevelNA } from './constants.js';

export function countRowsByTeamCapacity(secondLevelItems, capacityPerRow) {
    let rows = 1;
    let used = 0;
    for (const [themeName, themeObj] of Object.entries(secondLevelItems)) {
        if (themeName.includes(secondLevelNA)) continue;
        const nTeams = Object.keys(themeObj || {}).length || 0;
        if (used > 0 && (used + nTeams) > capacityPerRow) {
            rows++;
            used = 0;
        }
        used += nTeams;
    }
    return rows;
}

function computeThemeWidth(numTeams, thirdLevelBoxWidth, thirdLevelBoxPadX) {
    const n = Number(numTeams) || 0;
    if (n <= 0) return SECOND_LEVEL_LABEL_EXTRA;
    return n * thirdLevelBoxWidth + (n - 1) * thirdLevelBoxPadX + SECOND_LEVEL_LABEL_EXTRA;
}

export function computeStreamBoxWidthByCapacity(
    secondLevelItems,
    secondLevelBoxPadX,
    secondLevelNAParam,
    thirdLevelBoxPadX,
    thirdLevelBoxWidth,
    labelExtra = SECOND_LEVEL_LABEL_EXTRA,
    leftPad = 60,
    rightPad = 60
) {
    let used = 0;
    let rowWidth = leftPad;
    let maxWidth = 0;
    for (const [themeName, themeObj] of Object.entries(secondLevelItems)) {
        if (themeName.includes(secondLevelNAParam)) continue;
        const nTeams = Object.keys(themeObj || {}).length || 0;
        const themeInnerGaps = Math.max(0, nTeams - 1) * thirdLevelBoxPadX;
        const themeWidth = (nTeams * thirdLevelBoxWidth) + themeInnerGaps + labelExtra;
        if (used > 0 && (used + nTeams) > MAX_TEAMS_PER_ROW) {
            maxWidth = Math.max(maxWidth, rowWidth + rightPad);
            rowWidth = leftPad;
            used = 0;
        }
        if (used > 0) rowWidth += secondLevelBoxPadX;
        rowWidth += themeWidth;
        used += nTeams;
    }
    maxWidth = Math.max(maxWidth, rowWidth + rightPad);
    return maxWidth;
}

export function computeStreamBoxWidthWrapped(
    secondLevelItems,
    secondLevelBoxPadX,
    secondLevelNAParam,
    thirdLevelBoxPadX,
    thirdLevelBoxWidth,
    themesPerRow = 4,
    minWidth = 600,
    firstLevelPad = 80
) {
    const themeEntries = Object.entries(secondLevelItems)
        .filter(([themeKey]) => !themeKey.includes(secondLevelNAParam));
    const teamsPerThemeInStream = themeEntries.map(([, thirdLevelItems]) =>
        Object.keys(thirdLevelItems).length
    );
    const themeWidths = teamsPerThemeInStream.map(n =>
        computeThemeWidth(n, thirdLevelBoxWidth, thirdLevelBoxPadX)
    );
    if (!themeWidths || themeWidths.length === 0) return minWidth;
    let maxRowWidth = 0;
    for (let i = 0; i < themeWidths.length; i += themesPerRow) {
        const row = themeWidths.slice(i, i + themesPerRow);
        const rowSum = row.reduce((acc, w) => acc + (Number(w) || 0), 0);
        const pads = (row.length - 1) * secondLevelBoxPadX;
        const rowWidth = rowSum + pads + firstLevelPad;
        if (rowWidth > maxRowWidth) maxRowWidth = rowWidth;
    }
    return Math.max(maxRowWidth, minWidth);
}
