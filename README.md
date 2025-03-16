# Domino Service Mapping

## Description
This application visualizes a service dependency map using the D3.js library. Users can upload a CSV file containing information about services and their dependencies, and view an interactive map that shows the relationships between services.

I started developing this small application during a train journey, experimenting with the exceptional boost that artificial intelligence can provide in kickstarting something completely new. It was completed during spare moments while playing with my son, who is passionate about Domino. He greatly appreciated the colorful graphics and the animation of the visualized services, which is why the chosen name is Domino Service Dependency Map! :) 

## Features
- Upload CSV files containing service information.
- Display an interactive map of service dependencies.
- Search for specific services.
- View detailed information about services by clicking on nodes.
- Zoom and drag the map.

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
1. Open the index.html file in your browser (within the dist folder).
2. Upload a CSV file using the upload button.
3. Use the search bar to find specific services.
4. Click on nodes to view detailed information about services.

## CSV Format
The CSV file should have the following format:
   ```bash
   Service Name,Description,Type,Depends on,Used by
   Service1,Service 1 description,Type1,Service2\nService3,Service4\nService5
   Service2,Service 2 description,Type2,Service1,Service3
   ```

## Contributions
Contributions are welcome! Please open an issue or submit a pull request to suggest improvements or fix issues.

## License & Attribution
This application is freely available for use under the MIT License. If you use this application or any part of its code, please give appropriate credit to the original author. You can do this by including a link to the original repository and mentioning the author's name in your documentation or project.

Original Author: Francesco "Nyconator" Nicolosi

Original Repository: https://github.com/francesconicolosi/domino-service-dependency-map

Original Github Page: https://francesconicolosi.github.io/domino-service-dependency-map/

## Contact
For any questions, you can contact me at fra900@gmail.com or through my personal blog at https://www.gamerdad.cloud.