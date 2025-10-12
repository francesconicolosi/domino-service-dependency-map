import * as d3 from 'd3';

let fileContent = '';

let lastSearch = '';
let searchResults = [];
let currentIndex = 0;

document.getElementById('searchBar').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        const cards = Array.from(document.querySelectorAll('.profile-name, .team-title, .theme-title'));

        if (query !== lastSearch) {
            console.log(cards);
            searchResults = cards.filter(card => card.textContent?.toLowerCase().includes(query));
            currentIndex = 0;
            lastSearch = query;
        }

        cards.forEach(card => {
            if (card && card.style && card.style.outline) card.style.outline = ''
        });

        if (searchResults.length === 0) {
            document.getElementById('output').textContent = 'Nessuna card trovata.';
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

function findPersonByName(targetName, result) {
    for (const stream in result) {
        for (const theme in result[stream]) {
            for (const team in result[stream][theme]) {
                const members = result[stream][theme][team];
                for (const person of members) {
                    if (person.Name === targetName) {
                        return person;

                    }
                }
            }
        }
    }
    return null;
}

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

    const peopleByName = {};
    for (const p of people) {
        if (p.Name) peopleByName[p.Name.trim()] = p;
    }

    const streams = {};
    for (const person of people) {
        let personStreams = (person['Team Stream'] || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (personStreams.length === 0) personStreams = ['No Stream'];
        let personThemes = (person['Team Theme'] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (personThemes.length === 0) personThemes = ['No Theme'];
        let personTeams = (person['Team member of'] || '').split(/\n|,/).map(t => t.trim()).filter(Boolean);
        if (personTeams.length === 0) personTeams = ['No Team'];

        for (const stream of personStreams) {
            if (!streams[stream]) streams[stream] = {};
            for (const theme of personThemes) {
                if (!streams[stream][theme]) streams[stream][theme] = {};
                for (const team of personTeams) {
                    if (!streams[stream][theme][team]) streams[stream][theme][team] = [];
                    streams[stream][theme][team].push(person);
                }
            }
        }
    }
    console.log(streams);
    const result = {};
    for (const [stream, themes] of Object.entries(streams)) {
        for (const [theme, teams] of Object.entries(themes)) {
            const guestMembers = [];
            const addedMembers = new Set();

            for (const [team, members] of Object.entries(teams)) {
                let productManagers = new Set(), deliveryManagers = new Set(), scrumMasters = new Set(),
                    architects = new Set(), developmentManagers = new Set();

                if (!result[stream]) result[stream] = {};
                if (!result[stream][theme]) result[stream][theme] = {};
                if (!result[stream][theme][team]) result[stream][theme][team] = [];

                for (const p of members) {
                    if (!addedMembers.has(p.Name)) {
                        addedMembers.add(p.Name);
                        result[stream][theme][team].push(p);
                    }

                    const processManagers = (field, guestRole, managers) => {
                        if (p[field]) {
                            [...new Set(p[field].split(/\n|,/).map(m => m.trim()).filter(Boolean))].forEach(m => {
                                if (!managers.has(m)) {
                                    managers.add(m);
                                    const manager = findPersonByName(m, result);
                                    if (manager && !addedMembers.has(manager.Name)) {
                                        addedMembers.add(manager.Name);
                                        manager.guestRole = guestRole;
                                        guestMembers.push(manager);
                                    }
                                }
                            });
                        }
                    };

                    processManagers("Team Product Manager", "PM", productManagers);
                    processManagers("Team Delivery Manager", "DM", deliveryManagers);
                    processManagers("Team Scrum Master", "SM", scrumMasters);
                    processManagers("Team Architect", "Architect", architects);
                    processManagers("Team Development Manager", "DevM", developmentManagers);
                }

                result[stream][theme][team].push(...guestMembers);
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
    const fieldsToShow = ["Role", "Company", "Location", "Room Link", "In team since", "Name", "Gucci email"];
    const roleColors = {
        PM: "#ffe066",
        DM: "#b2f7ef",
        SM: "#a0c4ff",
        Architect: "#ffd6e0",
        DevM: "#f1faee"
    };

    const nFields = fieldsToShow.length;
    const rowHeight = 11;
    const cardWidth = 160, cardPad = 10, cardBaseHeight = nFields * 4 * rowHeight;
    const teamBoxWidth = inARow * cardWidth + 100, teamBoxPadX = 24;
    const themeBoxPadX = 60;
    const streamBoxPadY = 100;

    const largestStreamSize = Math.max(...Object.values(result).map(stream =>
        new Set(Object.values(stream).flatMap(theme =>
            Object.values(theme).flat().map(m => m.Name?.trim()).filter(Boolean)
        )).size));

    const largestTeamSize = Math.max(
        ...Object.entries(result)
            .filter(([streamName]) => streamName !== "No Stream")
            .flatMap(([, stream]) =>
                Object.entries(stream)
                    .filter(([themeName]) => themeName !== "No Theme")
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
    const streamBoxWidth = largestStreamSize / rowCount * cardWidth * rowCount / 1.4;

    let streamY = 40;

    Object.entries(result).forEach(([stream, themes], sIdx) => {
        if (stream.toLowerCase().includes("no stream")) return;
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
            if (theme.toLowerCase().includes("no theme")) return;
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