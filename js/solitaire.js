import * as d3 from 'd3';

let fileContent = '';
let lastSearch = '';
let searchResults = [];
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

let svg;
let viewport;
let backgroundLayer;
let cardLayer;

function hideActions() {
    document.getElementById('label-file').classList.add('hidden');
    document.getElementById('fileInput').classList.add('hidden');
    document.querySelector('h1').classList.add('hidden');
}

document.getElementById('toggle-cta').addEventListener('click', function() {
    const elements = [
        document.getElementById('label-file'),
        document.getElementById('fileInput'),
        document.querySelector('h1')
    ];
    elements.forEach(element => element.classList.toggle('hidden'));
});


document.getElementById('searchBar').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        const cards = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title'));

        if (query !== lastSearch) {
            searchResults = cards.filter(card => card.textContent?.toLowerCase().includes(query));
            currentIndex = 0;
            lastSearch = query;
        }

        cards.forEach(card => {
            if (card && card.style && card.style.outline) card.style.outline = ''
        });

        if (searchResults.length === 0) {
            document.getElementById('output').textContent = 'No result found.';
            return;
        }

        const card = searchResults[currentIndex];
        card.style.outline = '3px solid #ffe066';

        currentIndex = (currentIndex + 1) % searchResults.length;
    }
});

window.addEventListener('load', function() {
    let searchParam = null;
    const searchInput = document.getElementById('searchInput');
    fetch('https://francesconicolosi.github.io/domino-service-dependency-map/sample-people-database.csv')
        .then(response => {
            return response.text();
        })
        .then(csvData => {
            resetVisualization();
            extractData(csvData);
            hideActions();
        })
        .catch(error => console.error('Error loading the CSV file:', error));
});


function resetVisualization() {
    d3.select("#canvas").selectAll("*").remove();
    svg = d3.select("#canvas");
    viewport = svg.append("g").attr("id", "viewport");
    backgroundLayer = viewport.append("g").attr("id", "backgroundLayer");
    cardLayer = viewport.append("g").attr("id", "cardLayer");
    svg.call(d3.zoom().on("zoom", (event) => {
        viewport.attr("transform", event.transform);
    }));
}


document.getElementById('fileInput').addEventListener('change', function (e) {
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

function parseCSV(text) {
    const rows = [];
    let current = [];
    let inQuotes = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                value += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            current.push(value);
            value = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (value || current.length > 0) {
                current.push(value);
                rows.push(current);
                current = [];
                value = '';
            }
            if (char === '\r' && text[i + 1] === '\n') i++;
        } else {
            value += char;
        }
    }
    if (value || current.length > 0) {
        current.push(value);
        rows.push(current);
    }
    return rows;
}

const cleanName = name => name.replace(/[\s\t\r\n]+/g, " ").trim();

const findPersonByName = (targetName, result) =>
    Object.values(result).flatMap(stream =>
        Object.values(stream).flatMap(theme =>
            Object.values(theme).flatMap(team =>
                team
            )
        )
    ).find(person =>
        person.Name &&
        person.Name.trim().toLowerCase() === targetName.trim().toLowerCase()
    ) || null;


function buildOrganization(people) {
    const organization = {};
    for (const person of people) {
        let firstLevelItems = (person[firstOrgLevel] || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (firstLevelItems.length === 0) {
            firstLevelItems = [firstLevelNA];
        }
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
                    if (!(Object.values(organization[firstLevelItem][theme][team]).map(p => p.Name).includes(person.Name) || Object.values(organization[firstLevelItem][theme][team]).map(p => p.User).includes(person.User))) {
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
        person[guestRole]
            .split(/\n|,/)
            .map(m => m.trim())
            .filter(Boolean)
    )];

    guestNames.forEach(name => {
        const manager = findPersonByName(name, organization);
        if (!manager) {
            console.log(`Manager "${name}" is null`);
            return;
        }

        const alreadyPresent = thirdLevel.some(member =>
            cleanName(member.Name) === cleanName(name)
        );

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
                    if (!Object.values(result[firstLevel][secondLevel][thirdLevel]).map(entry => entry.Name).includes(p.Name)) {
                        result[firstLevel][secondLevel][thirdLevel].push(p);
                    }
                    guestRoles.forEach(role => addGuestManagersByRole(p, role, result[firstLevel][secondLevel][thirdLevel], organization));
                }
            }
        }
    }
    return result;
}

function extractData(fileContent) {
    if (!fileContent) {
        alert("Missing CSV File!");
        return;
    }
    const rows = parseCSV(fileContent);
    if (rows.length < 2) {
        return;
    }
    const headers = rows[0].map(h => h.trim());
    const people = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = (row[i] || '').trim());
        return obj;
    }).filter(p => p.Status && p.Status.toLowerCase() !== 'inactive');

    const peopleByName = {};
    for (const p of people) {
        if (p.Name) peopleByName[p.Name.trim()] = p;
    }

    const organization = buildOrganization(people);
    const result = addGuestManagersTo(organization);

    const drag = d3.drag()
        .on("start", function () {
            d3.select(this).raise(); // Bring card to front
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


    const largestFirstLevelSize = Math.max(...Object.entries(result)
        .filter(([streamKey]) => streamKey !== firstLevelNA)
        .map(([, stream]) => Object.entries(stream)
            .filter(([themeKey]) => themeKey !== secondLevelNA)
            .reduce((acc, [, theme]) => acc + Object.keys(theme).length, 0)
        )
    ) * inARow;

    const largestThirdLevelSize = Math.max(
        ...Object.entries(result)
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

    Object.entries(result).forEach(([firstLevel, secondLevelItems], sIdx) => {
        if (firstLevel.includes(firstLevelNA)) return;
        let secondLevelX = 60;

        const firstLevelGroup = backgroundLayer.append("g").attr("transform", `translate(40,${streamY})`);
        firstLevelGroup.append("rect")
            .attr("class", "stream-box")
            .attr("width", firstLevelBoxWidth)
            .attr("height", firstLevelBoxHeight)
            .attr("rx", 40)
            .attr("ry", 40);

        firstLevelGroup.append("text")
            .attr("x", 200)
            .attr("y", 50)
            .attr("text-anchor", "middle")
            .attr("class", "stream-title")
            .text(firstLevel);

        Object.entries(secondLevelItems).forEach(([secondLevel, thirdLevelItems], tIdx) => {
            if (secondLevel.includes(secondLevelNA)) return;
            //let teamY = 80;

            const secondLevelGroup = firstLevelGroup.append("g").attr("transform", `translate(${secondLevelX},100)`);
            const themeWidth = Object.keys(thirdLevelItems).length * thirdLevelBoxWidth + 120;
            secondLevelGroup.append("rect")
                .attr("class", "theme-box")
                .attr("width", themeWidth)
                .attr("height", secondLevelBoxHeight)
                .attr("rx", 30)
                .attr("ry", 30);

            secondLevelGroup.append("text")
                .attr("x", themeWidth / 2)
                .attr("y", 35)
                .attr("text-anchor", "middle")
                .attr("class", "theme-title")
                .text(secondLevel);

            Object.entries(thirdLevelItems).forEach(([thirdLevel, members], teamIdx) => {
                const thirdLevelGroup = secondLevelGroup.append("g").attr("transform", `translate(${teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50},70)`);
                thirdLevelGroup.append("rect")
                    .attr("class", "team-box")
                    .attr("width", thirdLevelBoxWidth)
                    .attr("height", thirdLevelBoxHeight)
                    .attr("rx", 20)
                    .attr("ry", 20);

                thirdLevelGroup.append("text")
                    .attr("x", thirdLevelBoxWidth / 2)
                    .attr("y", 28)
                    .attr("text-anchor", "middle")
                    .attr("class", "team-title")
                    .text(thirdLevel);

                members.forEach((member, mIdx) => {
                    const col = mIdx % inARow;
                    const row = Math.floor(mIdx / inARow);
                    const cardX = 40 + secondLevelX + teamIdx * (thirdLevelBoxWidth + thirdLevelBoxPadX) + 50 + 20 + col * (memberWidth + cardPad);
                    const cardY = streamY + 100 + 70 + 45 + row * (cardBaseHeight + 10);

                    const group = cardLayer.append("g")
                        .attr("class", "draggable")
                        .attr("transform", `translate(${cardX},${cardY})`);

                    group.append("rect")
                        .attr("class", "profile-box")
                        .attr("width", memberWidth)
                        .attr("height", cardBaseHeight)
                        .attr("rx", 14)
                        .attr("ry", 14)
                        .attr("fill", member.guestRole ? roleColors[member.guestRole] : "white");

                    group.append("foreignObject")
                        .attr("x", (memberWidth - 60) / 2)
                        .attr("y", 8)
                        .attr("width", 60)
                        .attr("height", 60)
                        .append("xhtml:img")
                        .attr("class", "profile-photo")
                        .attr("src", member.Photo ? "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png" : "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png")
                        .attr("alt", "Foto profilo");

                    group.append("foreignObject")
                        .attr("x", 0)
                        .attr("y", 72)
                        .attr("width", memberWidth)
                        .attr("height", 24)
                        .append("xhtml:div")
                        .attr("class", "profile-name")
                        .html(member["Name"]);

                    const infoDiv = group.append("foreignObject")
                        .attr("x", 8)
                        .attr("y", 98)
                        .attr("width", memberWidth - 16)
                        .attr("height", cardBaseHeight - 102)
                        .append("xhtml:div")
                        .attr("class", "info");

                    Object.entries(member).forEach(([key, value]) => {
                        if (key !== "Name" && fieldsToShow.includes(key) && value !== undefined) {
                            infoDiv.append("div").html(`<strong>${key}:</strong> ${value}`);
                        }
                    });

                    group.call(drag);
                });
            });

            secondLevelX += themeWidth + secondLevelBoxPadX;
        });

        streamY += firstLevelBoxHeight + firstLevelBoxPadY;
    });
}