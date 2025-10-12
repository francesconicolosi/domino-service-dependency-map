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


document.getElementById('searchBar').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        const cards = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title'));

        if (query !== lastSearch) {
            //console.log(cards);
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

document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        fileContent = evt.target.result;
        extractData();
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



function extractData() {
    if (!fileContent) {
        alert("Carica prima il file CSV!");
        return;
    }
    const rows = parseCSV(fileContent);
    if (rows.length < 2) {
        console.log("no data found");
        return;
    }
    const headers = rows[0].map(h => h.trim());
    const people = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = (row[i] || '').trim());
        return obj;
    }).filter(p => p.Status && p.Status.toLowerCase() !== 'inactive');

    //console.log("people", people);

    const peopleByName = {};
    for (const p of people) {
        if (p.Name) peopleByName[p.Name.trim()] = p;
    }

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
                    person.Name = person.Name ? person.Name.replace(/[\s\t\r\n]+/g, " ").trim() : person.User;
                    if (!(Object.values(organization[firstLevelItem][theme][team]).map(p => p.Name).includes(person.Name) || Object.values(organization[firstLevelItem][theme][team]).map(p => p.User).includes(person.User))) {
                        organization[firstLevelItem][theme][team].push(person);
                    }
                }
            }
        }
    }
    //console.log(JSON.stringify(organization));
    const result = {};

    const addGuestManagersToTheTeamBasedOn = (p, guestRole, thirdLevel) => {
        if (p[guestRole]) {
            //console.log(guestRole);
            //console.log(p[guestRole]);
            [...new Set(p[guestRole].split(/\n|,/).map(m => m.trim()).filter(Boolean))].forEach(m => {
                //if (m === "Federico Terraneo" && !Object.values(thirdLevel).flat().map(entry => entry.Name).includes(m)) {
                //    console.log("team ", JSON.stringify(thirdLevel));
                //    console.log("team names", Object.values(thirdLevel).flat().map(entry => entry.Name));
                //    console.log("includes " + m + "? " + Object.values(thirdLevel).map(entry => entry.Name).includes(m));
                //    console.log("so I ll add " + findPersonByName(m, organization));
                //}
//
                const manager = findPersonByName(m, organization);
                if (manager.Name === "Federico Terraneo") console.log("manager", manager);
                // if (m === "Eleonora Ciceri") console.log(organization);
                // if (m === "Eleonora Ciceri") console.log(JSON.stringify(organization));
                if (!manager) console.log("manager " + m + " is null");

                if (manager) {
                    let contained = false;//} && !Object.values(thirdLevel).flat().map(entry => entry.Name).includes(m)) {
                    for (const member of thirdLevel) {
                        //if (m === "Federico Terraneo") console.log(JSON.stringify(thirdLevel));
                        //if (m === "Federico Terraneo") console.log("member " + member.Name + " " + member.User);
                        if (member.Name === m) {
                            contained = true
                        }
                    }
                    if (m === "Federico Terraneo") console.log(contained);
                    if (!contained) {
                        if (m === "Federico Terraneo") console.log("adding now ...", JSON.stringify(thirdLevel));
                        manager.guestRole = guestRole;
                        thirdLevel.push(manager);
                        if (m === "Federico Terraneo") console.log("added", JSON.stringify(thirdLevel));
                    }


                    //if (m === "Eleonora Ciceri") console.log("added");
                    //if (m === "Eleonora Ciceri") console.log(thirdLevel);
                }
            });
        }
    };

    for (const [firstLevel, secondLevelItems] of Object.entries(organization)) {
        for (const [secondLevel, thirdLevelItems] of Object.entries(secondLevelItems)) {

            for (const [thirdLevel, members] of Object.entries(thirdLevelItems)) {
                if (!result[firstLevel]) result[firstLevel] = {};
                if (!result[firstLevel][secondLevel]) result[firstLevel][secondLevel] = {};
                if (!result[firstLevel][secondLevel][thirdLevel]) result[firstLevel][secondLevel][thirdLevel] = [];

                for (const p of members) {
                    if (!Object.values(result[firstLevel][secondLevel][thirdLevel]).map(entry => entry.Name).includes(p.Name)) {
                        if (p.Name === "Federico Terraneo") {
                            console.log("adding becfore");
                            console.log("prima", JSON.stringify(result[firstLevel][secondLevel][thirdLevel]));
                        }
                        result[firstLevel][secondLevel][thirdLevel].push(p);
                        if (p.Name === "Federico Terraneo") {
                            console.log("poi", JSON.stringify(result[firstLevel][secondLevel][thirdLevel]));
                        }
                    }
                    guestRoles.forEach(role => addGuestManagersToTheTeamBasedOn(p, role, result[firstLevel][secondLevel][thirdLevel]));
                }
            }
        }
    }
    const svg = d3.select("#canvas");

    const viewport = svg.append("g").attr("id", "viewport");

    const backgroundLayer = viewport.append("g").attr("id", "backgroundLayer");
    const cardLayer = viewport.append("g").attr("id", "cardLayer");

    svg.call(d3.zoom().on("zoom", (event) => {
        viewport.attr("transform", event.transform);
    }));

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
    const cardWidth = 160, cardPad = 10, cardBaseHeight = nFields * 4 * rowHeight;
    const teamBoxWidth = inARow * cardWidth + 100, teamBoxPadX = 24;
    const themeBoxPadX = 60;
    const streamBoxPadY = 100;


    const largestStreamSize = Math.max(...Object.entries(result)
        .filter(([streamKey]) => streamKey !== firstLevelNA)
        .map(([, stream]) => Object.entries(stream)
            .filter(([themeKey]) => themeKey !== secondLevelNA)
            .reduce((acc, [, theme]) => acc + Object.keys(theme).length, 0)
        )
    ) * inARow;

    console.log("largestStreamSize", largestStreamSize);

    const largestTeamSize = Math.max(
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

    const rowCount = Math.ceil(largestTeamSize / inARow);
    console.log(largestTeamSize);
    const teamBoxHeight = rowCount * cardBaseHeight * 1.2;
    const themeBoxHeight = teamBoxHeight * 1.2;
    const streamBoxHeight = themeBoxHeight * 1.2;
    const streamBoxWidth = largestStreamSize * cardWidth * rowCount / 1.4;

    let streamY = 40;

    Object.entries(result).forEach(([stream, themes], sIdx) => {
        if (stream.includes(firstLevelNA)) return;
        let themeX = 60;

        const streamGroup = backgroundLayer.append("g").attr("transform", `translate(40,${streamY})`);
        streamGroup.append("rect")
            .attr("class", "stream-box")
            .attr("width", streamBoxWidth)
            .attr("height", streamBoxHeight)
            .attr("rx", 40)
            .attr("ry", 40);

        streamGroup.append("text")
            .attr("x", 200)
            .attr("y", 50)
            .attr("text-anchor", "middle")
            .attr("class", "stream-title")
            .text(stream);

        Object.entries(themes).forEach(([theme, teams], tIdx) => {
            if (theme.includes(secondLevelNA)) return;
            //let teamY = 80;

            const themeGroup = streamGroup.append("g").attr("transform", `translate(${themeX},100)`);
            const themeWidth = Object.keys(teams).length * teamBoxWidth + 120;
            themeGroup.append("rect")
                .attr("class", "theme-box")
                .attr("width", themeWidth)
                .attr("height", themeBoxHeight)
                .attr("rx", 30)
                .attr("ry", 30);

            themeGroup.append("text")
                .attr("x", themeWidth / 2)
                .attr("y", 35)
                .attr("text-anchor", "middle")
                .attr("class", "theme-title")
                .text(theme);

            Object.entries(teams).forEach(([team, members], teamIdx) => {
                const teamGroup = themeGroup.append("g").attr("transform", `translate(${teamIdx * (teamBoxWidth + teamBoxPadX) + 50},70)`);
                teamGroup.append("rect")
                    .attr("class", "team-box")
                    .attr("width", teamBoxWidth)
                    .attr("height", teamBoxHeight)
                    .attr("rx", 20)
                    .attr("ry", 20);

                teamGroup.append("text")
                    .attr("x", teamBoxWidth / 2)
                    .attr("y", 28)
                    .attr("text-anchor", "middle")
                    .attr("class", "team-title")
                    .text(team);

                members.forEach((member, mIdx) => {
                    const col = mIdx % inARow;
                    const row = Math.floor(mIdx / inARow);
                    const cardX = 40 + themeX + teamIdx * (teamBoxWidth + teamBoxPadX) + 50 + 20 + col * (cardWidth + cardPad);
                    const cardY = streamY + 100 + 70 + 45 + row * (cardBaseHeight + 10);

                    const group = cardLayer.append("g")
                        .attr("class", "draggable")
                        .attr("transform", `translate(${cardX},${cardY})`);

                    group.append("rect")
                        .attr("class", "profile-box")
                        .attr("width", cardWidth)
                        .attr("height", cardBaseHeight)
                        .attr("rx", 14)
                        .attr("ry", 14)
                        .attr("fill", member.guestRole ? roleColors[member.guestRole] : "white");

                    group.append("foreignObject")
                        .attr("x", (cardWidth - 60) / 2)
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
                        .attr("width", cardWidth)
                        .attr("height", 24)
                        .append("xhtml:div")
                        .attr("class", "profile-name")
                        .html(member["Name"]);

                    const infoDiv = group.append("foreignObject")
                        .attr("x", 8)
                        .attr("y", 98)
                        .attr("width", cardWidth - 16)
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

            themeX += themeWidth + themeBoxPadX;
        });

        streamY += streamBoxHeight + streamBoxPadY;
    });
}