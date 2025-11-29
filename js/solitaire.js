import * as d3 from 'd3';

import {
    getQueryParam, setSearchQuery, parseCSV,
    highlightGroup as highlightGroupUtils
} from './utils.js';

let lastSearch = '';
let currentIndex = 0;
let logoLayer;

const SECOND_LEVEL_LABEL_EXTRA = 120;
const FIRST_LEVEL_LEFT_PAD   = 80;
const THIRD_LEVEL_EXTRA = 130;

const firstOrgLevel = 'Team Stream';
const secondOrgLevel = 'Team Theme';
const thirdOrgLevel = 'Team member of';
const firstLevelNA = `No ${firstOrgLevel}`;
const secondLevelNA = `No ${secondOrgLevel}`;
const thirdLevelNA = `No ${thirdOrgLevel}`;

const guestRoleColors = ["#ffe066", "#b2f7ef", "#a0c4ff", "#ffd6e0", "#f1faee"];
const guestRoles = ["Team Product Manager", "Team Delivery Manager", "Team Scrum Master", "Team Architect", "Team Development Manager"];
const emailField = "Company email"; // this will be used to resolve the photo filename

const peopleDBUpdateRecipients = [
    'teams@share.software.net'
].join(',');

const roleColors = Object.fromEntries(
    guestRoles.map((role, i) => [role, guestRoleColors[i % guestRoleColors.length]])
);

let searchParam;

let svg;
let viewport;
let backgroundLayer;
let cardLayer;

let zoom;
let width = 1200;
let height = 800;

let latestUpdateDate = null;

function findHeaderIndex(headers, name) {
    const target = (name || '').trim().toLowerCase();
    return headers.findIndex(h => (h || '').trim().toLowerCase() === target);
}

function truncateString(str, maxLength = 25) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}

function aggregateTeamManagedServices(members, headers, headerName = 'Team Managed Services') {
    const idx = findHeaderIndex(headers, headerName);
    if (idx === -1) {
        return { exists: false, items: [] };
    }
    const headerRealName = headers[idx];
    const set = new Set();

    members.forEach(m => {
        const raw = m[headerRealName];
        if (!raw) return;
        raw
            .split(/\n|,/)
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(v => set.add(v));
    });

    return {
        exists: true,
        items: [...set].sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
    };
}

function openSideDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('side-overlay');
    if (!drawer) return;

    drawer.classList.add('open');
    overlay?.classList.add('visible');
    document.body.classList.add('side-drawer-open');
    drawer.setAttribute('aria-hidden', 'false');

    const lastUpdateEl = document.getElementById('side-last-update');
    if (lastUpdateEl) {
        if (latestUpdateDate instanceof Date) {
            lastUpdateEl.textContent = `Last Update: ${getFormattedDate(latestUpdateDate.toISOString())}`;
        } else {
            lastUpdateEl.textContent = '';
        }
    }

    document.getElementById('act-upload')?.focus();
}

function closeSideDrawer() {
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('side-overlay');
    if (!drawer) return;
    drawer.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.classList.remove('side-drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
}

function initSideDrawerEvents() {
    const overlay = document.getElementById('side-overlay');
    const closeBtn = document.getElementById('side-close');

    overlay?.addEventListener('click', closeSideDrawer);
    closeBtn?.addEventListener('click', closeSideDrawer);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSideDrawer();
    });

    const toggleCta = document.getElementById('toggle-cta');
    toggleCta?.addEventListener('click', (e) => {
        e.preventDefault();
        openSideDrawer();
    });

    document.getElementById('act-upload')?.addEventListener('click', () => {
        document.getElementById('fileInput')?.click();
        closeSideDrawer();
    });

    document.getElementById('act-clear')?.addEventListener('click', () => {
        searchParam = '';
        const searchInput = document.getElementById('drawer-search-input');
        searchInput.value = searchParam;
        setSearchQuery(searchParam);
        closeSideDrawer();
    });

    document.getElementById('act-fit')?.addEventListener('click', () => {
        fitToContent(0.9);
        closeSideDrawer();
    });

    document.getElementById('act-report')?.addEventListener('click', () => {
        const subject = encodeURIComponent('Request for People Database Update');
        const body = encodeURIComponent(
            `Hello Team,

I would like to report the need for an update to the People Database: 
[insert the change here]

Thank you.`
        );

        const mailtoLink = `mailto:${peopleDBUpdateRecipients}?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
        closeSideDrawer();
    });

    document.getElementById('drawer-search-go')?.addEventListener('click', () => {
        const q = document.getElementById('drawer-search-input')?.value?.trim().toLowerCase();
        if (q) searchByQuery(q);
        closeSideDrawer();
    });
}

window.addEventListener('DOMContentLoaded', initSideDrawerEvents);

function openDrawer({ name, description, services }) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const titleEl = document.getElementById('drawer-title');
    const listEl = document.getElementById('drawer-list');
    const descEl = document.getElementById('drawer-description');

    if (!drawer || !titleEl || !listEl || !descEl) return;

    titleEl.textContent = `${name}`;


    descEl.innerHTML = '';

    if (description) {
        const lines = description.split('\n');
        lines.forEach((line, index) => {
            const parts = line.split(/\s+/);
            parts.forEach(part => {
                if (part.startsWith('http')) {
                    const cleanUrl = part.replace(/[.,;:]+$/, '');
                    const a = document.createElement('a');
                    a.href = cleanUrl;
                    a.textContent = "🔗External Link ";
                    a.target = '_blank';
                    a.style.color = '#0078d4';
                    a.style.textDecoration = 'underline';
                    descEl.appendChild(a);
                } else {
                    descEl.appendChild(document.createTextNode(part + ' '));
                }
            });

            if (index < lines.length - 1) {
                descEl.appendChild(document.createElement('br'));
            }
        });
    }


    listEl.innerHTML = '';
    if (services && services.items && services.items.length !== 0) {
        services.items.forEach(s => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `index.html?search=id%3A"${encodeURIComponent(s)}"`;
            a.textContent = s;
            a.target = '_blank';
            li.appendChild(a);
            listEl.appendChild(li);
        });
    }

    drawer.classList.add('open');
    overlay?.classList.add('visible');
    document.body.classList.add('drawer-open');
    drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;
    drawer.classList.remove('open');
    overlay?.classList.remove('visible');
    document.body.classList.remove('drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
}

function initDrawerEvents() {
    const overlay = document.getElementById('drawer-overlay');
    const closeBtn = document.getElementById('drawer-close');
    overlay?.addEventListener('click', closeDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
}

window.addEventListener('DOMContentLoaded', initDrawerEvents);
``

window.addEventListener('load', function () {
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample-people-database.csv')
        .then(response => response.text())
        .then(csvData => {
            resetVisualization();
            extractData(csvData);
            searchParam = getQueryParam('search');
            if (searchParam) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        searchByQuery(searchParam);
                    });
                });
            }
        })
        .catch(error => console.error('Error loading the CSV file:', error));
});
``

function resetVisualization() {
    const svgEl = document.getElementById('canvas');
    if (!svgEl) {
        console.error('canvas not found');
        return;
    }

    width = svgEl.clientWidth || +svgEl.getAttribute('width') || 1200;
    height = svgEl.clientHeight || +svgEl.getAttribute('height') || 800;

    d3.select(svgEl).selectAll('*').remove();

    svg = d3.select(svgEl)
        .attr('width', width)
        .attr('height', height)
        .attr('cursor', 'grab');

    viewport = svg.append('g').attr('id', 'viewport');
    backgroundLayer = viewport.append('g').attr('id', 'backgroundLayer');
    cardLayer = viewport.append('g').attr('id', 'cardLayer');
    logoLayer = viewport.append('g').attr('id', 'logoLayer');

    zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on('start', () => svg.attr('cursor', 'grabbing'))
        .on('end', () => svg.attr('cursor', 'grab'))
        .on('zoom', (event) => {
            viewport.attr('transform', event.transform);
        });

    svg.call(zoom);
}

function fitToContent(paddingRatio = 0.9) {
    if (!viewport) return;

    const bbox = viewport.node().getBBox();
    if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width === 0 || bbox.height === 0) {
        svg.call(zoom.transform, d3.zoomIdentity);
        return;
    }

    const scale = Math.min(width / bbox.width, height / bbox.height) * paddingRatio;
    const x = width / 2 - (bbox.x + bbox.width / 2) * scale;
    const y = height / 2 - (bbox.y + bbox.height / 2) * scale;

    const t = d3.zoomIdentity.translate(x, y).scale(scale);
    svg.call(zoom.transform, t);
}

function zoomToElement(element, desiredScale = 1.5, duration = 500) {
    if (!element || !svg) return;

    const svgNode = svg.node();
    const t = d3.zoomTransform(svgNode);

    const elRect = element.getBoundingClientRect();
    const svgRect = svgNode.getBoundingClientRect();
    const centerScreenX = elRect.left + elRect.width / 2 - svgRect.left;
    const centerScreenY = elRect.top + elRect.height / 2 - svgRect.top;

    const [cx, cy] = t.invert([centerScreenX, centerScreenY]);

    const k = desiredScale;
    const offsetY = 380;
    const tx = width / 2 - cx * k;
    const ty = height / 2 - cy * k - offsetY;

    const targetTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
    svg.transition().duration(duration).call(zoom.transform, targetTransform);

    const group = element.closest('g');
    if (group) highlightGroupUtils(d3.select(group));
}

const cleanName = name => name.replace(/[\s\t\r\n]+/g, ' ').trim();

const findPersonByName = (targetName, result) =>
    Object.values(result).flatMap(stream =>
        Object.values(stream).flatMap(theme =>
            Object.values(theme).flatMap(team => team)
        )
    ).find(person =>
        person.Name && person.Name.trim().toLowerCase() === targetName.trim().toLowerCase()
    ) || null;

function buildOrganization(people) {
    const organization = {};
    for (const person of people) {
        let firstLevelItems = (person[firstOrgLevel] || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (firstLevelItems.length === 0) firstLevelItems = [firstLevelNA];

        let secondLevelItems = (person[secondOrgLevel] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (secondLevelItems.length === 0) secondLevelItems = [secondLevelNA];

        let thirdLevelItems = (person[thirdOrgLevel] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (thirdLevelItems.length === 0) thirdLevelItems = [thirdLevelNA];

        for (const firstLevelItem of firstLevelItems) {
            if (!organization[firstLevelItem]) organization[firstLevelItem] = {};
            for (const theme of secondLevelItems) {
                if (!organization[firstLevelItem][theme]) organization[firstLevelItem][theme] = {};
                for (const team of thirdLevelItems) {
                    if (!organization[firstLevelItem][theme][team]) organization[firstLevelItem][theme][team] = [];
                    person.Name = person.Name ? cleanName(person.Name) : person.User;
                    const names = Object.values(organization[firstLevelItem][theme][team]).map(p => p.Name);
                    const users = Object.values(organization[firstLevelItem][theme][team]).map(p => p.User);
                    if (!(names.includes(person.Name) || users.includes(person.User))) {
                        organization[firstLevelItem][theme][team].push(person);
                    }
                }
            }
        }
    }
    return organization;
}

const addGuestManagersByRole = (person, guestRole, thirdLevel, organization) => {
    if (!person[guestRole]) return;
    const guestNames = [...new Set(
        person[guestRole].split(/\n|,/).map(m => m.trim()).filter(Boolean)
    )];

    guestNames.forEach(name => {
        const manager = findPersonByName(name, organization);
        if (!manager) {
            return;
        }
        const alreadyPresent = thirdLevel.some(member => cleanName(member.Name) === cleanName(name));
        if (!alreadyPresent) {
            manager.guestRole = guestRole;
            thirdLevel.push(manager);
        }
    });
};

function addGuestManagersTo(organization) {
    const result = {};
    for (const [firstLevel, secondLevelItems] of Object.entries(organization)) {
        for (const [secondLevel, thirdLevelItems] of Object.entries(secondLevelItems)) {
            for (const [thirdLevel, members] of Object.entries(thirdLevelItems)) {
                if (!result[firstLevel]) result[firstLevel] = {};
                if (!result[firstLevel][secondLevel]) result[firstLevel][secondLevel] = {};
                if (!result[firstLevel][secondLevel][thirdLevel]) result[firstLevel][secondLevel][thirdLevel] = [];

                for (const p of members) {
                    const names = Object.values(result[firstLevel][secondLevel][thirdLevel]).map(entry => entry.Name);
                    if (!names.includes(p.Name)) result[firstLevel][secondLevel][thirdLevel].push(p);
                    guestRoles.forEach(role => addGuestManagersByRole(p, role, result[firstLevel][secondLevel][thirdLevel], organization));
                }
                result[firstLevel][secondLevel][thirdLevel].sort((a, b) => {
                    const aIsGuest = guestRoles.includes(a.guestRole);
                    const bIsGuest = guestRoles.includes(b.guestRole);
                    if (aIsGuest && !bIsGuest) return 1;
                    if (!aIsGuest && bIsGuest) return -1;
                    return 0;
                });
            }
        }
    }
    return result;
}

function getLatestUpdateFromCsv(headers, rows) {
    if (headers.includes("Last Update")) {
        const dateIndex = headers.indexOf("Last Update");
        const dates = rows.slice(1)
            .map(row => row[dateIndex]?.trim())
            .filter(Boolean)
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()));

        if (dates.length > 0) {
            latestUpdateDate = new Date(Math.max(...dates.map(d => d.getTime())));
        } else {
            latestUpdateDate = null;
        }
    } else {
        latestUpdateDate = null;
    }
}

function getContentBBox() {
    const bg = backgroundLayer?.node()?.getBBox();
    const cards = cardLayer?.node()?.getBBox();

    if (!bg && !cards) return null;
    const boxes = [bg, cards].filter(Boolean);
    const x1 = Math.min(...boxes.map(b => b.x));
    const y1 = Math.min(...boxes.map(b => b.y));
    const x2 = Math.max(...boxes.map(b => b.x + b.width));
    const y2 = Math.max(...boxes.map(b => b.y + b.height));
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };

}



function placeCompanyLogoUnderDiagram(url = './assets/company-logo.png', maxWidth = 240, textMargin = 40) {
    if (!viewport || !logoLayer) return;

    const bbox = getContentBBox();
    if (!bbox) {
        console.warn('Visual outcome not found');
        return;
    }

    logoLayer.selectAll('*').remove();

    const img = new Image();
    img.onload = () => {
        const aspect = img.height / img.width || 0.35;
        const width = maxWidth;
        const height = Math.round(width * aspect);

        const x = bbox.x + (bbox.width - width) / 2;
        const y = bbox.y + bbox.height + 80;
        logoLayer.append('image')
            .attr('href', url)
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('pointer-events', 'none');

        logoLayer.append('foreignObject')
            .attr('x', x)
            .attr('y', y + height + textMargin)
            .attr('width', width)
            .attr('height', 100)
            .append('xhtml:div')
            .style('font-size', '10px')
            .style('font-family', 'Arial, sans-serif')
            .style('text-align', 'center')
            .style('color', '#333')
            .html('<p>Author: Francesco Nicolosi</p>' +
                '<p>Personal Blog: <a href="https://www.gamerdad.cloud" target="_blank">www.gamerdad.cloud</a></p>' +
                '<p>Usage License: MIT</p>');


        const legendX = bbox.x;
        const legendY = y;
        const boxSize = 18;
        const spacing = 10;

        logoLayer.append('text')
            .attr('x', legendX)
            .attr('y', legendY - 10)
            .attr('font-size', '18px')
            .attr('font-family', 'Arial, sans-serif')
            .attr('fill', '#333')
            .text('Legenda:');

        guestRoles.forEach((role, i) => {
            const rowY = legendY + i * (boxSize + spacing);
            logoLayer.append('rect')
                .attr('x', legendX)
                .attr('y', rowY)
                .attr('width', boxSize)
                .attr('height', boxSize)
                .attr('fill', roleColors[role])
                .attr('stroke', '#333')
                .attr('rx', 4)
                .attr('ry', 4);

            logoLayer.append('text')
                .attr('x', legendX + boxSize + 10)
                .attr('y', rowY + boxSize - 4)
                .attr('font-size', '16px')
                .attr('font-family', 'Arial, sans-serif')
                .attr('fill', '#333')
                .text(role);
        });

        let notZoommingToShowSearchResults = !getQueryParam("search");
        if (notZoommingToShowSearchResults) {
            fitToContent(0.9);
        }

    };
    img.onerror = () => {
        console.warn('Logo not found:', url);
    };
    img.src = url;
}


function computeThemeWidth(numTeams, thirdLevelBoxWidth, thirdLevelBoxPadX) {
    const n = Number(numTeams) || 0;
    if (n <= 0) {
        return SECOND_LEVEL_LABEL_EXTRA;
    }
    return n * thirdLevelBoxWidth + (n - 1) * thirdLevelBoxPadX + SECOND_LEVEL_LABEL_EXTRA;
}

function computeStreamBoxWidth(
    numThemes,
    teamsPerTheme,
    thirdLevelBoxWidth,
    thirdLevelBoxPadX,
    secondLevelBoxPadX,
    minWidth = 600
) {
    const tCount = Number(numThemes) || 0;
    if (tCount === 0) return minWidth;

    const themeWidths = teamsPerTheme.map(n =>
        computeThemeWidth(n, thirdLevelBoxWidth, thirdLevelBoxPadX)
    );

    const sumThemes = themeWidths.reduce((sum, w) => sum + (Number(w) || 0), 0);
    const interThemePad = (tCount - 1) * secondLevelBoxPadX;

    const total = sumThemes + interThemePad + FIRST_LEVEL_LEFT_PAD;
    return Math.max(total, minWidth);
}

function getMaxFirstLevelWidth(
    organizationWithManagers,
    thirdLevelBoxWidth,
    thirdLevelBoxPadX,
    secondLevelBoxPadX,
    minWidth = 600
) {
    const widths = Object
        .entries(organizationWithManagers)
        .filter(([streamKey]) => streamKey !== firstLevelNA)
        .map(([, secondLevelItems]) => {
            const themeEntries = Object.entries(secondLevelItems)
                .filter(([themeKey]) => themeKey !== secondLevelNA);

            const numThemes = themeEntries.length;
            const teamsPerTheme = themeEntries.map(([, thirdLevelItems]) =>
                Object.keys(thirdLevelItems).length
            );

            return computeStreamBoxWidth(
                numThemes,
                teamsPerTheme,
                thirdLevelBoxWidth,
                thirdLevelBoxPadX,
                secondLevelBoxPadX,
                minWidth
            );
        });

    if (!widths.length) return minWidth;

    const maxW = Math.max(...widths);

    return Number.isFinite(maxW) ? maxW : minWidth;
}

function extractData(csvText) {
    if (!csvText) { alert('Missing CSV File!'); return; }
    const rows = parseCSV(csvText);
    if (rows.length < 2) return;

    const headers = rows[0].map(h => h.trim());
    const people = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = (row[i] || '').trim());
        return obj;
    }).filter(p => p.Status && p.Status.toLowerCase() !== 'inactive');

    getLatestUpdateFromCsv(headers, rows);

    const organization = buildOrganization(people);
    const organizationWithManagers = addGuestManagersTo(organization);

    const drag = d3.drag()
        .on("start", function () {
            d3.select(this).raise();
        })
        .on("drag", function (event) {
            const transform = d3.select(this).attr("transform");
            const translate = transform.match(/translate\(([^,]+),([^\)]+)\)/);
            const x = parseFloat(translate[1]) + event.dx;
            const y = parseFloat(translate[2]) + event.dy;
            d3.select(this).attr("transform", `translate(${x},${y})`);
        });

    const inARow = 6;
    const fieldsToShow = ["Role", "Company", "Location", "Room Link", "In team since", "Name", "User", emailField];

    const nFields = fieldsToShow.length;
    const rowHeight = 11;
    const memberWidth = 160, cardPad = 10, cardBaseHeight = nFields * 4 * rowHeight;
    const thirdLevelBoxWidth = inARow * memberWidth + 100, thirdLevelBoxPadX = 24;
    const secondLevelBoxPadX = 60;
    const firstLevelBoxPadY = 100;

    const largestThirdLevelSize = Math.max(
        ...Object.entries(organizationWithManagers)
            .filter(([streamName]) => streamName !== firstLevelNA)
            .flatMap(([, stream]) =>
                Object.entries(stream)
                    .filter(([themeName]) => themeName !== secondLevelNA)
                    .flatMap(([, theme]) =>
                        Object.values(theme).map(team =>
                            new Set(team.map(m => m.Name?.trim()).filter(Boolean)).size
                        )
                    )
            )
    );

    const rowCount = Math.ceil(largestThirdLevelSize / inARow);
    const thirdLevelBoxHeight = rowCount * cardBaseHeight * 1.2 + 80;
    const secondLevelBoxHeight = thirdLevelBoxHeight * 1.2 + 100;
    const firstLevelBoxHeight = secondLevelBoxHeight * 1.2;

    const firstLevelBoxWidth = getMaxFirstLevelWidth(
        organizationWithManagers,
        thirdLevelBoxWidth,
        thirdLevelBoxPadX,
        secondLevelBoxPadX,
        600
    );

    let streamY = 40;

    Object.entries(organizationWithManagers).forEach(([firstLevel, secondLevelItems]) => {
        if (firstLevel.includes(firstLevelNA)) return;

        let firstLevelDescription = '';

        const firstLevelDescriptionIndex = findHeaderIndex(headers, `${firstOrgLevel} Description`);
        if (firstLevelDescriptionIndex !== -1) {
            const descriptionHeader = headers[firstLevelDescriptionIndex];

            const match = people.find(p => {
                const levels = (p[firstOrgLevel] || '')
                    .split(/\n|,/)
                    .map(s => s.trim().toLowerCase());
                return levels.includes(firstLevel.toLowerCase());
            });

            firstLevelDescription = match ? (match[descriptionHeader] || '') : '';
        }

        let secondLevelX = 60;

        const firstLevelGroup = backgroundLayer.append('g').attr('transform', `translate(40,${streamY})`);
        firstLevelGroup.append('rect')
            .attr('class', 'stream-box')
            .attr('width', firstLevelBoxWidth)
            .attr('height', firstLevelBoxHeight)
            .attr('rx', 40)
            .attr('ry', 40);

        firstLevelGroup.append('text')
            .attr('x', 50)
            .attr('y', 70)
            .attr('text-anchor', 'start')
            .attr('class', 'stream-title')
            .text(`${firstLevel} ${firstLevelDescription !== "" ? ' ⌞ ⌝' : ''}`);

        if (firstLevelDescription !== "") {
            firstLevelGroup.select('rect.stream-box')
                .style('cursor', 'pointer')
                .on('click', () => openDrawer({
                    name: firstLevel,
                    description: firstLevelDescription
                }));

            firstLevelGroup.select('text.stream-title')
                .style('cursor', 'pointer')
                .on('click', () => openDrawer({
                    name: firstLevel,
                    description: firstLevelDescription
                }));
        }

        Object.entries(secondLevelItems).forEach(([secondLevel, thirdLevelItems]) => {
            if (secondLevel.includes(secondLevelNA)) return;

            const secondLevelDescriptionIndex = findHeaderIndex(headers, `${secondOrgLevel} Description`);
            const secondLevelDescription = secondLevelDescriptionIndex !== -1
                ? (people.find(p => (p[secondOrgLevel] || '').split(/\n|,/).map(s => s.trim()).includes(secondLevel))?.[headers[secondLevelDescriptionIndex]] || "")
                : "";

            const secondLevelGroup = firstLevelGroup.append('g').attr('transform', `translate(${secondLevelX},100)`);
            const themeWidth = Object.keys(thirdLevelItems).length * thirdLevelBoxWidth + SECOND_LEVEL_LABEL_EXTRA;

            secondLevelGroup.append('rect')
                .attr('class', 'theme-box')
                .attr('width', themeWidth)
                .attr('height', secondLevelBoxHeight)
                .attr('rx', 30)
                .attr('ry', 30);

            secondLevelGroup.append('text')
                .attr('x', themeWidth / 2)
                .attr('y', 85)
                .attr('text-anchor', 'middle')
                .attr('class', 'theme-title')
                .text(`${truncateString(secondLevel)} ${secondLevelDescription !== "" ? ' ⌞ ⌝' : ''}`);

            if (secondLevelDescription !== "") {
                secondLevelGroup.select('rect.theme-box')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({
                        name: secondLevel,
                        description: secondLevelDescription
                    }));

                secondLevelGroup.select('text.theme-title')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({
                        name: secondLevel,
                        description: secondLevelDescription
                    }));
            }

            Object.entries(thirdLevelItems).forEach(([thirdLevel, members], teamIdx) => {

                const originalMembers = (organization[firstLevel]?.[secondLevel]?.[thirdLevel]) || [];

                const services = aggregateTeamManagedServices(originalMembers, headers, 'Team Managed Services');


                const thirdLevelGroup = secondLevelGroup.append('g').attr('transform', `translate(${teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50},${THIRD_LEVEL_EXTRA})`);
                thirdLevelGroup.append('rect')
                    .attr('class', 'team-box')
                    .attr('width', thirdLevelBoxWidth)
                    .attr('height', thirdLevelBoxHeight)
                    .attr('rx', 20)
                    .attr('ry', 20);

                const serviceCount = services?.items?.length || 0;
                const titleText = `${thirdLevel} - ⚙️ (${serviceCount})`;

                thirdLevelGroup.append('text')
                    .attr('x', thirdLevelBoxWidth / 2)
                    .attr('y', 70)
                    .attr('text-anchor', 'middle')
                    .attr('data-services', services?.items?.filter(Boolean).join(', ') || '')
                    .attr('class', 'team-title')
                    .text(truncateString(titleText));

                thirdLevelGroup.select('rect.team-box')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({ name: thirdLevel, services }));

                thirdLevelGroup.select('text.team-title')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({ name: thirdLevel, services }));


                members.forEach((member, mIdx) => {
                    const col = mIdx % inARow;
                    const row = Math.floor(mIdx / inARow);
                    const cardX = 40 + secondLevelX + teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50 + 20 + col * (memberWidth + cardPad);
                    const cardY = streamY + 100 + 70 + 45 + row * (cardBaseHeight + 10) + 130;

                    const group = cardLayer.append('g')
                        .attr('class', 'draggable')
                        .attr('transform', `translate(${cardX},${cardY})`);

                    group.append('rect')
                        .attr('class', 'profile-box')
                        .attr('width', memberWidth)
                        .attr('height', cardBaseHeight)
                        .attr('rx', 14)
                        .attr('ry', 14)
                        .attr('fill', member.guestRole ? roleColors[member.guestRole] : 'white');

                    function resolvePhoto(email, fallback = './assets/user-icon.png') {
                        const paths = email ? getPhotoPath(email) : fallback;
                        return new Promise((resolve) => {
                            const img = new Image();
                            img.src = paths[0];
                            img.onload = () => resolve(paths[0]);
                            img.onerror = () => {
                                const img2 = new Image();
                                img2.src = paths[1];
                                img2.onload = () => resolve(paths[1]);
                                img2.onerror = () => resolve(fallback);
                            };
                        });
                    }

                    function getPhotoPath(email) {
                        let baseName = email.split('@')[0];
                        baseName = baseName.replace('-ext', '');
                        baseName = baseName.replace('.', '-');
                        return ['./assets/photos/' + baseName + '.jpg', './assets/photos/' + baseName + '.png'];
                    }

                    resolvePhoto(member[emailField]).then(photoPath => {
                        console.log(photoPath);
                        group.append('foreignObject')
                            .attr('x', (memberWidth - 60) / 2)
                            .attr('y', 8)
                            .attr('width', 60)
                            .attr('height', 60)
                            .append('xhtml:img')
                            .attr('class', 'profile-photo')
                            .attr('src', photoPath)
                            .attr('alt', 'Profile photo');
                    });

                    group.append('foreignObject')
                        .attr('x', 0)
                        .attr('y', 72)
                        .attr('width', memberWidth)
                        .attr('height', 24)
                        .append('xhtml:div')
                        .attr('class', 'profile-name')
                        .html(member['Name']);

                    const infoDiv = group.append('foreignObject')
                        .attr('x', 8)
                        .attr('y', 98)
                        .attr('width', memberWidth - 16)
                        .attr('height', cardBaseHeight - 102)
                        .append('xhtml:div')
                        .attr('class', 'info');

                    if (member[emailField]) {
                        const email = member[emailField];
                        infoDiv.append('div').html(`<a href="https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}" target="_blank" style="text-decoration:none; color:inherit;">💬</a> <a href="mailto:${encodeURIComponent(email)}" target="_blank" style="text-decoration:none; color:inherit;">✉️</a>`);
                    }

                    Object.entries(member).forEach(([key, value]) => {
                        if (key !== 'Name' && fieldsToShow.includes(key) && value !== undefined) {
                            infoDiv.append('div').html(`<strong>${key}:</strong> ${value}`);
                        }
                    });
                    group.call(drag);
                });
            });

            secondLevelX += themeWidth + secondLevelBoxPadX;
        });

        streamY += firstLevelBoxHeight + firstLevelBoxPadY;
    });

    requestAnimationFrame(() => {
        placeCompanyLogoUnderDiagram('./assets/company-logo.png', 200, 50);
    });

    fitToContent(0.9);
}

document.getElementById('fileInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        resetVisualization();
        extractData(evt.target.result);
    };
    reader.readAsText(file, 'UTF-8');
});

document.getElementById('drawer-search-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        if (query) {
            searchByQuery(query);
        }
        e.preventDefault();
    }
});

function searchByQuery(query) {
    if (!query) return;

    const searchInput = document.getElementById('drawer-search-input');
    if (!searchInput.value) {
        searchInput.value = query;
    }

    const nodes = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title, [data-services]'));

    const matches = nodes.filter(n => {
        const textMatch = n.textContent?.toLowerCase().includes(query);
        const attrMatch = n.getAttribute('data-services')?.toLowerCase().includes(query);
        return textMatch || attrMatch;
    });

    const output = document.getElementById('output');
    if (matches.length === 0) {
        if (output) output.textContent = 'No result found.';
        //clearHighlightsUtils();
        return;
    }

    if (query === lastSearch) {
        currentIndex = (currentIndex + 1) % matches.length;
    } else {
        lastSearch = query;
        currentIndex = 0;
    }

    const target = matches[currentIndex];

    zoomToElement(target, 1.6, 600);

    if (output) {
        output.textContent = `Found ${matches.length} result(s). Showing ${currentIndex + 1}/${matches.length}.`;
    }
    setSearchQuery(query);
}