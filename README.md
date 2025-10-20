# Domino Dependency Mapping Visualization Tool

## Description
This application visualizes a service dependency map using the D3.js library. Users can upload a CSV file containing information about services and their dependencies, and view an interactive map that shows the relationships between services.

I started developing this small application during a train journey and it was completed during spare moments while playing with my son, who is passionate about Domino. He greatly appreciated the colorful graphics and the animation of the visualized services, which is why the chosen name is Domino Dependency Mapping Visualization Tool! :) 

## Features
- Upload CSV files containing service information.
- Display an interactive map of service dependencies.
- Search for specific services.
- View detailed information about services by clicking on nodes.
- Zoom and drag the map.
- Enriched fields derived from existing attributes (e.g., automatic Jira filter URLs).

## Repository Structure
domino-service-dependency-map/ ├── README.md ├── index.html ├── css/ │ └── styles.css ├── js/ │ ├── main.js │ └── d3.min.js ├── data/ │ └── sample.csv ├── assets/ │ └── images/ │ └── logo.png ├── docs/ │ └── documentation.md └── LICENSE


## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/domino-service-dependency-map.git
2. Navigate to the project folder:
cd domino-service-dependency-map
3. Install the dependencies:
   ```bash
   npm install
4. Compile the application:
   ```bash
   npm run build

## Usage
1. Open the `index.html` file in your browser (located in the `dist` folder).
2. Upload a CSV file using the upload button.
3. Use the search bar to find specific services.
4. Click on nodes to view detailed information about services.
5. Hide decommissioned services based on their Status field and Decommission Date values by clicking the dedicated CTA.
6. How to Search Using the Search Bar: You can refine your search using specific syntax. Below are examples and their meanings:
- key:"ServiceName1" → Searches for services with exactly the key-value pair key:"ServiceName1".
- "Value" → Searches for services that contain this value in any parameter.
- key:ServiceName1 → Searches for services that include a partial match for the key-value pair key:ServiceName1.
- key:ServiceName1,ServiceName2 → Performs a non-exact search for multiple services using comma-separated values.
- key:"ServiceName1","ServiceName2" → Performs an exact search for multiple services using comma-separated values.


## CSV Format
The CSV file should have the following format that are necessary for the dependency mapping visualization:
   ```bash
   Service Name,Description,Type,Depends on,Status,Decommission Date
   Service1,Service 1 description,Type1,Service2\nService3,Running,,
   Service2,Service 2 description,Type2,Service1,Stopped,03-16-2025,
   ```

Additionally, you can include other fields (columns) as desired. These fields will be displayed in the Service detail table section at the bottom, after clicking the single node service. 

# Solitaire: Org‑Chart & Team Explorer
## What it is
Solitaire is a companion application that renders the organizational chart and team/stream structure. It loads a CSV exported from the People Database on the dedicated Confluence page and provides a fast, filterable view of teams, streams, themes, and the services associated with each team. The People Database export typically includes individual‑level fields such as User, Role, Team link, Assigned team, Status, Company, Location, Room Link, In team since, Name, Company email, Photo, Stream.
For team‑level metadata like Theme, Team email, and role owners (e.g., Development Manager, Architect, Scrum Master, Product Manager, Delivery Manager), the Confluence Team Database includes those columns. [People Dat...ci Digital] [Team Datab...ci Digital]

Key Capabilities

Load a CSV exported from the People Database (Confluence).
Search and filter by:

- Team name
- Stream name
- Theme
- Services associated with teams


Click a team tile to see associated services and team metadata.
Navigate between team and stream views quickly.

## Usage (Solitaire)

Open solitaire-beta.html (same bundle hosts both apps).
Click Upload CSV and select the People Database export (or a pre‑joined Team + People export).
Use the search bar to filter by team, stream, theme, or service.
Click a team tile to see services associated to that team (clickable list).


## CSV Format (Solitaire)

Each row is a person exported from the People Database (Confluence). Solitaire will group people by Assigned team to build team tiles; you can still filter by Stream, and you may add a Services column to the exported rows (or provide a separate mapping file) to enable service‑level filters. Typical People Database columns include: User, Role, Team link, Assigned team, Status, Company, Location, Room Link, In team since, Name, Company email, Photo, Stream. [People Dat...ci Digital]
Minimum required columns

Assigned team — Team name used for grouping.
Stream — Stream label (used for filtering).
Name — Person’s full name.

Recommended columns

Role, Company email, Team link, Status, Location, In team since — Improve richness of the team tiles and detail popovers. [People Dat...ci Digital]
Services — Optional; multi‑value list of services this person (or their team) is associated with. If present, Solitaire bubbles these up to the team.


``` bash
User,Role,Team member of,Leading team(s),Status,Company,Location,Room Link,In team since,Name,Company email,Photo,Stream,Team Stream,Team Theme,Team Development Manager,Team Architect,Team Delivery Manager,Team Scrum Master,Team Product Manager,Last Update,Team Managed Services
CSVName,Role,Assigned team,Stream,Company email,Team link,Status,Services
"Designer Name","UX Strategy","Foundation Digital Design","Replatforming Foundations","designer.name@Company.com","https://confluence/.../cb96a6d7-...","ACTIVE","Design System\nDesign Ops""Pinco Pallo","Delivery Manager","Delivery Management","Replatforming Foundations","pincopallo@company.com","https://confluence/.../02c2c794-...","ACTIVE","Platform Engineering\nAtlas""Mario Rossi","Product Manager","Teamcool","Replatforming themes","mario.rossi@company.com","https://confluence/.../d742fbd8-...","ACTIVE","PIM\nCatalog Enrichment"
```

## How Solitaire’s search works

Team name / Stream / Theme: exact or partial matches across the corresponding columns (Option A) or the aggregated values (Option B).
Services: matches any service string listed in the Services field. If aligned with Domino’s Service Name, results will be consistent across the two apps.

## Interoperability with Domino
To enable cross‑navigation between Solitaire and Domino:

Keep Solitaire → Services values identical to Domino → Service Name.
Use the same delimiter convention (\n inside quoted cells) for multi‑value fields to simplify parsing in both apps.


## Contributions
Contributions are welcome! Please open an issue or submit a pull request to suggest improvements or fix issues.

## License & Attribution
This application is freely available for use under the MIT License. If you use this application or any part of its code, please give appropriate credit to the original author. You can do this by including a link to the original repository and mentioning the author's name in your documentation or project.

Original Author: Francesco "Nyconator" Nicolosi

Original Repository: https://github.com/francesconicolosi/domino-service-dependency-map

Original Github Page: https://francesconicolosi.github.io/domino-service-dependency-map/

## Contact
For any questions, you can contact me at fra900@gmail.com or through my personal blog at https://www.gamerdad.cloud.