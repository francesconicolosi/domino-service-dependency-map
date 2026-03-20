# Jira Assets Scripts – Usage Guide

This repository contains Python scripts used to **import and export data from Jira Assets**, supporting team-to-service mappings and service catalog generation.

---

## Prerequisites

- Python 3.9+
- Access to Jira Service Management Assets APIs
- Valid Atlassian API credentials

---

## Environment Variables

Before running any script, make sure the following environment variables are set:

```bash
export ATLASSIAN_EMAIL="email@gucci.com"
export ATLASSIAN_API_TOKEN="YOUR_API_TOKEN"
export ASSETS_WORKSPACE_ID="1057bc5d-8678-4112-b041-8b5b4b879b50"
```

---

## Import – Team to Services Mapping

This script imports data into Jira Assets, mapping teams to managed services.

### Script
`assets_import_param.py`

### Example usage

```bash
python assets_import_param.py   --csv "Team Database - Gucci Digital (7).csv"   --source-object-type 34   --key-col "Name"   --map "Managed Services=Managed Services|Managed services|Managed"
```

### Parameters

- `--csv`  
  Path to the source CSV file.

- `--source-object-type`  
  Jira Assets Object Type ID (e.g. `34` for Teams).

- `--key-col`  
  Column used as the unique key for object matching.

- `--map`  
  Attribute mapping definition.  
  Format:
  ```
  TargetAttribute=Alias1|Alias2|Alias3
  ```

---

## Export – Service Catalog Generation

This script exports services from Jira Assets, excluding definitive entries, and generates a service catalog CSV based on a template.

### Script
`assets_export_excluding_definitive.py`

### Example usage

```bash
python assets_export_excluding_definitive.py   --object-type 31   --template "Service Catalog - DB (76).csv"   --out "Service Catalog - Export.csv"
```

### Parameters

- `--object-type`  
  Jira Assets Object Type ID (e.g. `31` for Services).

- `--template`  
  CSV template used to define column structure and order.

- `--out`  
  Output CSV file path.

---

## Notes

- All scripts rely on Jira Assets REST APIs.
- Ensure the user associated with the API token has sufficient permissions.
- CSV files should be UTF-8 encoded.
- Multi-value fields are typically separated using `||`.

---

## Typical Workflow

1. Import team and managed services relationships.
2. Export enriched service catalog using the defined template.
3. Use the generated CSV for downstream systems or visualizations.
