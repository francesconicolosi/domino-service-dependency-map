import * as d3 from 'd3';

let lastSearch = '';
let currentIndex = 0;

const firstOrgLevel = 'Team Stream';
const secondOrgLevel = 'Team Theme';
const thirdOrgLevel = 'Team member of';
const firstLevelNA = `No ${firstOrgLevel}`;
const secondLevelNA = `No ${secondOrgLevel}`;
const thirdLevelNA = `No ${thirdOrgLevel}`;

const guestRoleColors = ["#ffe066", "#b2f7ef", "#a0c4ff", "#ffd6e0", "#f1faee"];
const guestRoles = ["Team Product Manager", "Team Delivery Manager", "Team Scrum Master", "Team Architect", "Team Development Manager"];

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

function hideActions() {
    const label = document.getElementById('label-file');
    const file = document.getElementById('fileInput');
    const h1 = document.querySelector('h1');
    [label, file, h1].forEach(el => el && el.classList.add('hidden'));
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function updateQueryString(value) {
    const url = new URL(window.location);
    url.searchParams.set('search', value);
    window.history.pushState({}, '', url);
}

function findHeaderIndex(headers, name) {
    const target = (name || '').trim().toLowerCase();
    return headers.findIndex(h => (h || '').trim().toLowerCase() === target);
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

function openDrawer({ teamName, services }) {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const titleEl = document.getElementById('drawer-title');
    const listEl = document.getElementById('drawer-list');

    if (!drawer || !titleEl || !listEl) return;

    titleEl.textContent = `Managed Services — ${teamName}`;
    listEl.innerHTML = '';

    if (!services.exists) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Team Managed Service column is not present.';
        listEl.appendChild(li);
    } else if (services.items.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No Service is managed by this team.';
        listEl.appendChild(li);
    } else {
        services.items.forEach(s => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `index.html?search=id%3A"${encodeURIComponent(s)}"`;
            a.textContent = s;
            a.target = '_blank';
            li.appendChild(a);
            listEl.appendChild(li);
        });
        ``
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

document.getElementById('toggle-cta')?.addEventListener('click', function () {
    const label = document.getElementById('label-file');
    const file = document.getElementById('fileInput');
    const h1 = document.querySelector('h1');
    [label, file, h1].forEach(el => el && el.classList.toggle('hidden'));
});

window.addEventListener('load', function () {
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample-people-database.csv')
        .then(response => response.text())
        .then(csvData => {
            resetVisualization();
            extractData(csvData);
            hideActions();
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
        console.error('Elemento #canvas non trovato.');
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
    if (group) highlightGroup(d3.select(group));
}

function clearHighlights() {
    viewport.selectAll('rect')
        .attr('stroke', null)
        .attr('stroke-width', null);
}

function highlightGroup(groupSel) {
    clearHighlights();
    const rect = groupSel.select('rect.profile-box').node()
        ? groupSel.select('rect.profile-box')
        : groupSel.select('rect');
    if (rect.node()) {
        rect.attr('stroke', '#ff9900').attr('stroke-width', 3);
    }
}

function parseCSV(text) {
    const rows = [];
    let current = [];
    let inQuotes = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                value += '"'; i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            current.push(value); value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (value || current.length > 0) {
                current.push(value); rows.push(current); current = []; value = '';
            }
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else {
            value += char;
        }
    }
    if (value || current.length > 0) { current.push(value); rows.push(current); }
    return rows;
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
            console.log(`Manager "${name}" is null`);
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
            }
        }
    }
    return result;
}

function getFormattedDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
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
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            latestUpdateDate = maxDate.toISOString();
        } else {
            latestUpdateDate = null;
        }
    } else {
        latestUpdateDate = null;
    }

    requestAnimationFrame(() => {
        const el = document.getElementById("latestUpdateDate");
        if (latestUpdateDate) {
            const formatted = getFormattedDate(latestUpdateDate);
            el.textContent = `Last Update: ${formatted}`;
        }
    });

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
    const fieldsToShow = ["Role", "Company", "Location", "Room Link", "In team since", "Name", "User", "Gucci email"];

    const nFields = fieldsToShow.length;
    const rowHeight = 11;
    const memberWidth = 160, cardPad = 10, cardBaseHeight = nFields * 4 * rowHeight;
    const thirdLevelBoxWidth = inARow * memberWidth + 100, thirdLevelBoxPadX = 24;
    const secondLevelBoxPadX = 60;
    const firstLevelBoxPadY = 100;

    const largestFirstLevelSize = Math.max(...Object.entries(organizationWithManagers)
        .filter(([streamKey]) => streamKey !== firstLevelNA)
        .map(([, stream]) => Object.entries(stream)
            .filter(([themeKey]) => themeKey !== secondLevelNA)
            .reduce((acc, [, theme]) => acc + Object.keys(theme).length, 0)
        )
    ) * inARow;

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
    const thirdLevelBoxHeight = rowCount * cardBaseHeight * 1.2;
    const secondLevelBoxHeight = thirdLevelBoxHeight * 1.2;
    const firstLevelBoxHeight = secondLevelBoxHeight * 1.2;

    const firstLevelBoxWidth = largestFirstLevelSize * memberWidth * inARow / 4;

    let streamY = 40;

    Object.entries(organizationWithManagers).forEach(([firstLevel, secondLevelItems]) => {
        if (firstLevel.includes(firstLevelNA)) return;
        let secondLevelX = 60;

        const firstLevelGroup = backgroundLayer.append('g').attr('transform', `translate(40,${streamY})`);
        firstLevelGroup.append('rect')
            .attr('class', 'stream-box')
            .attr('width', firstLevelBoxWidth)
            .attr('height', firstLevelBoxHeight)
            .attr('rx', 40)
            .attr('ry', 40);

        firstLevelGroup.append('text')
            .attr('x', 200)
            .attr('y', 50)
            .attr('text-anchor', 'middle')
            .attr('class', 'stream-title')
            .text(firstLevel);

        Object.entries(secondLevelItems).forEach(([secondLevel, thirdLevelItems]) => {
            if (secondLevel.includes(secondLevelNA)) return;

            const secondLevelGroup = firstLevelGroup.append('g').attr('transform', `translate(${secondLevelX},100)`);
            const themeWidth = Object.keys(thirdLevelItems).length * thirdLevelBoxWidth + 120;

            secondLevelGroup.append('rect')
                .attr('class', 'theme-box')
                .attr('width', themeWidth)
                .attr('height', secondLevelBoxHeight)
                .attr('rx', 30)
                .attr('ry', 30);

            secondLevelGroup.append('text')
                .attr('x', themeWidth / 2)
                .attr('y', 35)
                .attr('text-anchor', 'middle')
                .attr('class', 'theme-title')
                .text(secondLevel);

            Object.entries(thirdLevelItems).forEach(([thirdLevel, members], teamIdx) => {
                const thirdLevelGroup = secondLevelGroup.append('g').attr('transform', `translate(${teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50},70)`);
                thirdLevelGroup.append('rect')
                    .attr('class', 'team-box')
                    .attr('width', thirdLevelBoxWidth)
                    .attr('height', thirdLevelBoxHeight)
                    .attr('rx', 20)
                    .attr('ry', 20);

                thirdLevelGroup.append('text')
                    .attr('x', thirdLevelBoxWidth / 2)
                    .attr('y', 28)
                    .attr('text-anchor', 'middle')
                    .attr('class', 'team-title')
                    .text(thirdLevel);

                const originalMembers = (organization[firstLevel]?.[secondLevel]?.[thirdLevel]) || [];

                const services = aggregateTeamManagedServices(originalMembers, headers, 'Team Managed Services');

                thirdLevelGroup.select('rect.team-box')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({ teamName: thirdLevel, services }));

                thirdLevelGroup.select('text.team-title')
                    .style('cursor', 'pointer')
                    .on('click', () => openDrawer({ teamName: thirdLevel, services }));


                members.forEach((member, mIdx) => {
                    const col = mIdx % inARow;
                    const row = Math.floor(mIdx / inARow);
                    const cardX = 40 + secondLevelX + teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50 + 20 + col * (memberWidth + cardPad);
                    const cardY = streamY + 100 + 70 + 45 + row * (cardBaseHeight + 10);

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

                    group.append('foreignObject')
                        .attr('x', (memberWidth - 60) / 2)
                        .attr('y', 8)
                        .attr('width', 60)
                        .attr('height', 60)
                        .append('xhtml:img')
                        .attr('class', 'profile-photo')
                        .attr('src', member.Photo ? 'user-icon.png'
                            : 'user-icon.png')
                        .attr('alt', 'Foto profilo');

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

    fitToContent(0.9);
}

document.getElementById('fileInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        resetVisualization();
        extractData(evt.target.result);
        hideActions();
    };
    reader.readAsText(file, 'UTF-8');
});

document.getElementById('clearSearch').addEventListener('click', function () {
    searchParam = '';
    const searchInput = document.getElementById('searchBar');
    searchInput.value = searchParam;
    toggleSearchButton(searchParam);
    updateQueryString(searchParam);
});

function toggleSearchButton(searchInput) {
    if (searchInput) {
        document.getElementById("clearSearch").classList.remove('hidden');
    } else {
        document.getElementById("clearSearch").classList.add('hidden');
    }
}

function searchByQuery(query) {
    if (!query) return;

    toggleSearchButton(query);
    const searchInput = document.getElementById('searchBar');
    if (!searchInput.value) {
        searchInput.value = query;
    }

    const nodes = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title'));
    const matches = nodes.filter(n => n.textContent?.toLowerCase().includes(query));

    const output = document.getElementById('output');
    if (matches.length === 0) {
        if (output) output.textContent = 'No result found.';
        clearHighlights();
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
    updateQueryString(query);
}

document.getElementById('searchBar')?.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;

    const query = e.target.value.trim().toLowerCase();
    searchByQuery(query);
});
