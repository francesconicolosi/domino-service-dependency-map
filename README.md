# Domino Service Mapping

## Description
This application visualizes a service dependency map using the D3.js library. Users can upload a CSV file containing information about services and their dependencies, and view an interactive map that shows the relationships between services.

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
Navigate to the project folder:
cd domino-service-dependency-map
Usage
Open the index.html file in your browser.
Upload a CSV file using the upload button.
Use the search bar to find specific services.
Click on nodes to view detailed information about services.
CSV Format
The CSV file should have the following format:

Service Name,Description,Type,Depends on,Used by
Service1,Service 1 description,Type1,Service2\nService3,Service4\nService5
Service2,Service 2 description,Type2,Service1,Service3
...
Contributions
Contributions are welcome! Please open an issue or submit a pull request to suggest improvements or fix issues.

License
This project is licensed under the MIT License. See the LICENSE file for more details.

Contact
For any questions, you can contact me at your-email@example.com.