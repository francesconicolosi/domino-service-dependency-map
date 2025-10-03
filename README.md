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


## Contributions
Contributions are welcome! Please open an issue or submit a pull request to suggest improvements or fix issues.

## License & Attribution
This application is freely available for use under the MIT License. If you use this application or any part of its code, please give appropriate credit to the original author. You can do this by including a link to the original repository and mentioning the author's name in your documentation or project.

Original Author: Francesco "Nyconator" Nicolosi

Original Repository: https://github.com/francesconicolosi/domino-service-dependency-map

Original Github Page: https://francesconicolosi.github.io/domino-service-dependency-map/

## Contact
For any questions, you can contact me at fra900@gmail.com or through my personal blog at https://www.gamerdad.cloud.