#!/usr/bin/env python3
"""Assets Export Services enriched with Team ownership + Theme + Stream (v3, FIX).

Fix for your issue (columns always empty)
---------------------------------------
In the previous version, Team attributes were extracted by *exact attribute name match*.
In Assets, attribute names can differ by case/spacing or may not be included in the object payload
as `objectTypeAttribute.name` consistently.

This v3 resolves Team/Theme/Stream attributes by **attribute ID** from the object type definition
(objecttype/{id}/attributes), using case-insensitive alias matching. This makes the mapping stable
and should populate:
  - Responsible Teams
  - Owner (Development Manager)
  - Product Theme
  - Stream (from Theme->Stream)

Workflow (as requested)
-----------------------
1) Load Teams (typeId=34) into memory.
2) From each Team, read Theme (attr) and Managed Services (attr).
3) Lookup Theme objects (typeId=32) by label and cache them.
4) From each Theme, read Stream (attr) and cache stream labels (typeId=33 objects can be looked up,
   but for your CSV column we output the Stream label).
5) Export Services (typeId=31) and, for each service, if it appears in a Team's Managed Services,
   append the Team name, Team Development Manager, Team Theme, and Theme Stream(s).

Tenant workaround
-----------------
Your tenant lists only ~25 objects per broad query. We use iterative exclusion:
  objectTypeId = X AND objectId NOT IN (...)
until totalcount is reached.

Output
------
Service attributes + 4 extra columns:
  Responsible Teams | Owner | Product Theme | Stream
Values are deduplicated and joined with '||'.

Required env vars
-----------------
- ATLASSIAN_EMAIL
- ATLASSIAN_API_TOKEN
- ASSETS_WORKSPACE_ID

Optional
--------
- ATLASSIAN_SITE (default https://instance.atlassian.net)

Usage
-----
python assets_export_services_enriched_v3.py \
  --out "Service Catalog - Export.csv" \
  --template "Service Catalog - DB (76).csv"
"""

import os
import csv
import time
import base64
import argparse
import requests
from typing import Any, Dict, List, Optional, Tuple

SITE = os.environ.get("ATLASSIAN_SITE", "https://instance.atlassian.net").rstrip("/")
WORKSPACE_ID = os.environ["ASSETS_WORKSPACE_ID"]
EMAIL = os.environ["ATLASSIAN_EMAIL"]
API_TOKEN = os.environ["ATLASSIAN_API_TOKEN"]

BASE = f"{SITE}/gateway/api/jsm/assets/workspace/{WORKSPACE_ID}/v1"
_auth = base64.b64encode(f"{EMAIL}:{API_TOKEN}".encode("utf-8")).decode("utf-8")
HEADERS = {
    "Authorization": f"Basic {_auth}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

TIMEOUT = (10, 60)


def req(method: str, url: str, payload: Optional[dict], max_retries: int, backoff: float) -> Any:
    last = None
    for attempt in range(1, max_retries + 1):
        try:
            if method == 'GET':
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            else:
                r = requests.post(url, headers=HEADERS, json=payload, timeout=TIMEOUT)

            if r.ok:
                return r.json()

            try:
                body = r.json()
            except Exception:
                body = (r.text or '')[:2000]
            raise RuntimeError(f"HTTP {r.status_code} {url}: {body}")
        except Exception as e:
            last = e
            if attempt < max_retries:
                time.sleep(backoff * attempt)
            else:
                break
    raise RuntimeError(f"Failed after {max_retries} retries: {method} {url}: {last}")


def get_objecttype_attributes(object_type_id: str, max_retries: int, backoff: float) -> List[dict]:
    data = req('GET', f"{BASE}/objecttype/{object_type_id}/attributes", None, max_retries, backoff)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        vals = data.get('values')
        return vals if isinstance(vals, list) else []
    raise RuntimeError(f"Unexpected attributes response type: {type(data)}")


def post_totalcount(ql_query: str, max_retries: int, backoff: float) -> Optional[int]:
    try:
        data = req('POST', f"{BASE}/object/aql/totalcount", {"qlQuery": ql_query}, max_retries, backoff)
    except Exception:
        return None
    if isinstance(data, int):
        return data
    if isinstance(data, dict):
        for k in ('count', 'total', 'totalCount', 'value'):
            v = data.get(k)
            if isinstance(v, int):
                return v
    return None


def post_aql(ql_query: str, max_results: int, include_attributes: bool, max_retries: int, backoff: float) -> List[dict]:
    payload = {
        "qlQuery": ql_query,
        "startAt": 0,
        "maxResults": max_results,
        "includeAttributes": include_attributes,
    }
    data = req('POST', f"{BASE}/object/aql", payload, max_retries, backoff)
    if isinstance(data, dict):
        return data.get('values') or data.get('objectEntries') or []
    return []


def build_exclusion_clause(ids: List[str], chunk_size: int = 50) -> str:
    if not ids:
        return ''
    parts = []
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i+chunk_size]
        parts.append(f" AND objectId NOT IN ({','.join(chunk)})")
    return ''.join(parts)


def fetch_all_objects_excluding(object_type_id: str,
                                batch_size: int,
                                include_attributes: bool,
                                max_retries: int,
                                backoff: float,
                                sleep_sec: float) -> List[dict]:
    base_query = f"objectTypeId = {object_type_id}"
    total = post_totalcount(base_query, max_retries, backoff)
    print(f"[fetch] objectTypeId={object_type_id} totalcount={total}", flush=True)

    seen_ids: List[str] = []
    seen_set = set()
    out: List[dict] = []

    while True:
        q = base_query + build_exclusion_clause(seen_ids, chunk_size=50)
        objs = post_aql(q, batch_size, include_attributes, max_retries, backoff)

        new_objs = []
        for o in objs:
            oid = str(o.get('id'))
            if oid and oid not in seen_set:
                new_objs.append(o)

        if not new_objs:
            break

        for o in new_objs:
            oid = str(o.get('id'))
            seen_set.add(oid)
            seen_ids.append(oid)
            out.append(o)

        if total is not None:
            print(f"  progress {len(seen_ids)}/{total}", flush=True)
            if len(seen_ids) >= total:
                break
        else:
            print(f"  progress {len(seen_ids)}", flush=True)

        if sleep_sec:
            time.sleep(sleep_sec)

    return out


def resolve_attr_id(attr_defs: List[dict], aliases: List[str]) -> Optional[str]:
    """Resolve an attribute ID from object type attribute definitions by case-insensitive name match."""
    alias_set = {a.strip().lower() for a in aliases if a.strip()}
    for a in attr_defs:
        name = a.get('name')
        if isinstance(name, str) and name.strip().lower() in alias_set:
            return str(a.get('id'))
    return None


def values_from_attr_id(obj: dict, attr_id: str) -> List[str]:
    """Extract values for a given objectTypeAttributeId from an object.

    Returns list of strings; reference -> label/objectKey; text -> value.
    Also splits newline/comma/|| and dedups.
    """
    vals: List[str] = []
    for a in obj.get('attributes', []) or []:
        if str(a.get('objectTypeAttributeId')) != str(attr_id):
            continue
        for v in a.get('objectAttributeValues', []) or []:
            ref = v.get('referencedObject')
            if ref:
                lbl = ref.get('label') or ref.get('objectKey')
                if lbl:
                    vals.append(str(lbl))
            else:
                if v.get('value') is not None:
                    vals.append(str(v.get('value')))

    # split
    out: List[str] = []
    for x in vals:
        if not x:
            continue
        s = str(x).strip().replace('\r\n','\n').replace('\r','\n')
        if '||' in s:
            parts = s.split('||')
        elif '\n' in s:
            parts = s.split('\n')
        elif ',' in s:
            parts = s.split(',')
        else:
            parts = [s]
        for p in parts:
            p = p.strip().strip('"')
            if p:
                out.append(p)

    # dedup preserve order
    seen = set()
    dedup: List[str] = []
    for v in out:
        if v not in seen:
            seen.add(v)
            dedup.append(v)
    return dedup


def load_template_header(path: str) -> Optional[List[str]]:
    if not path:
        return None
    try:
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            header = next(reader)
        return [h.strip() for h in header if h.strip()]
    except Exception:
        return None


def build_columns(service_attr_names: List[str], template_path: str, extra_cols: List[str]) -> List[str]:
    tpl = load_template_header(template_path)
    cols: List[str] = []
    seen = set()

    if tpl:
        for h in tpl:
            if h in service_attr_names and h not in seen:
                cols.append(h); seen.add(h)

    for h in service_attr_names:
        if h not in seen:
            cols.append(h); seen.add(h)

    for e in extra_cols:
        if e not in seen:
            cols.append(e); seen.add(e)

    return cols


def join_dedup(values: List[str]) -> str:
    seen = set()
    out = []
    for v in values:
        v = (v or '').strip()
        if not v:
            continue
        if v not in seen:
            seen.add(v)
            out.append(v)
    return '||'.join(out)


def flatten_service(obj: dict, attr_def_by_id: Dict[str, dict], service_attr_names: List[str]) -> Dict[str, str]:
    row = {c: '' for c in service_attr_names}
    for a in obj.get('attributes', []) or []:
        aid = str(a.get('objectTypeAttributeId'))
        ad = attr_def_by_id.get(aid)
        if not ad:
            continue
        name = ad.get('name', aid)
        if name not in row:
            continue
        vals: List[str] = []
        for v in a.get('objectAttributeValues', []) or []:
            ref = v.get('referencedObject')
            if ref:
                vals.append(str(ref.get('label') or ref.get('objectKey') or ''))
            else:
                if v.get('value') is not None:
                    vals.append(str(v.get('value')))
        row[name] = '||'.join([x for x in vals if x])
    return row


def main():
    parser = argparse.ArgumentParser(description='Export Services enriched (Owner/Teams/Theme/Stream) - v3')
    parser.add_argument('--out', default='assets_service_enriched.csv')
    parser.add_argument('--template', default='')

    parser.add_argument('--service-type', default='31')
    parser.add_argument('--team-type', default='34')
    parser.add_argument('--theme-type', default='32')
    parser.add_argument('--stream-type', default='33')

    parser.add_argument('--batch-size', type=int, default=25)
    parser.add_argument('--max-retries', type=int, default=5)
    parser.add_argument('--backoff', type=float, default=1.5)
    parser.add_argument('--sleep', type=float, default=0.1)

    args = parser.parse_args()

    service_type = str(args.service_type)
    team_type = str(args.team_type)
    theme_type = str(args.theme_type)
    stream_type = str(args.stream_type)

    print(f"Site: {SITE}")
    print(f"Workspace: {WORKSPACE_ID}")

    # Resolve attribute IDs for Team type
    team_attr_defs = get_objecttype_attributes(team_type, args.max_retries, args.backoff)
    team_managed_id = resolve_attr_id(team_attr_defs, ['Managed Services', 'Managed services', 'Managed'])
    team_theme_id = resolve_attr_id(team_attr_defs, ['Theme', 'Product Theme'])
    team_devmgr_id = resolve_attr_id(team_attr_defs, ['Development Manager', 'Dev Manager', 'Development manager'])

    if not team_managed_id:
        print("[WARN] Could not resolve Team 'Managed Services' attribute id. Mapping will be empty.")
    if not team_theme_id:
        print("[WARN] Could not resolve Team 'Theme' attribute id. Product Theme/Stream will be empty.")
    if not team_devmgr_id:
        print("[WARN] Could not resolve Team 'Development Manager' attribute id. Owner will be empty.")

    # Resolve attribute IDs for Theme type
    theme_attr_defs = get_objecttype_attributes(theme_type, args.max_retries, args.backoff)
    theme_stream_id = resolve_attr_id(theme_attr_defs, ['Stream', 'Team Stream'])

    # Label attributes for exact lookups
    theme_label_attr = 'Name'
    for a in theme_attr_defs:
        if a.get('label') is True and isinstance(a.get('name'), str):
            theme_label_attr = a['name'].strip()
            break

    # STEP 1: Load Teams
    print("\n[STEP 1] Loading Teams...", flush=True)
    teams = fetch_all_objects_excluding(team_type, args.batch_size, True, args.max_retries, args.backoff, args.sleep)
    print(f"Loaded {len(teams)} teams.", flush=True)

    # Build service->team mapping + collect theme labels
    service_to_infos: Dict[str, List[dict]] = {}
    theme_labels: List[str] = []
    teams_with_managed = 0

    for t in teams:
        team_name = str(t.get('label') or '').strip()
        managed = values_from_attr_id(t, team_managed_id) if team_managed_id else []
        theme_vals = values_from_attr_id(t, team_theme_id) if team_theme_id else []
        devmgr_vals = values_from_attr_id(t, team_devmgr_id) if team_devmgr_id else []

        if managed:
            teams_with_managed += 1

        for th in theme_vals:
            theme_labels.append(th)

        info = {'team_name': team_name, 'theme': theme_vals, 'devmgr': devmgr_vals}

        for svc in managed:
            k = svc.strip().lower()
            if not k:
                continue
            service_to_infos.setdefault(k, []).append(info)

    print(f"Teams with non-empty managed services: {teams_with_managed}", flush=True)
    print(f"Unique services referenced by teams: {len(service_to_infos)}", flush=True)

    # STEP 2: Resolve Themes by label (exact)
    print("\n[STEP 2] Resolving Theme objects...", flush=True)
    seen = set()
    theme_labels_dedup = []
    for th in theme_labels:
        k = th.strip().lower()
        if k and k not in seen:
            seen.add(k)
            theme_labels_dedup.append(th.strip())

    themes_by_label: Dict[str, dict] = {}
    for th in theme_labels_dedup:
        safe = th.replace('"', '\\"')
        q = f"objectTypeId = {theme_type} AND \"{theme_label_attr}\" = \"{safe}\""
        res = post_aql(q, 2, True, args.max_retries, args.backoff)
        if res:
            themes_by_label[th.lower()] = res[0]

    print(f"Resolved {len(themes_by_label)} theme objects (from {len(theme_labels_dedup)} labels).", flush=True)

    # Build theme -> streams mapping
    theme_to_streams: Dict[str, List[str]] = {}
    if theme_stream_id:
        for th_lower, th_obj in themes_by_label.items():
            theme_to_streams[th_lower] = values_from_attr_id(th_obj, theme_stream_id)
    else:
        print("[WARN] Could not resolve Theme 'Stream' attribute id; Stream column will be empty.")

    # STEP 3: Export Services
    print("\n[STEP 3] Loading Services...", flush=True)
    services = fetch_all_objects_excluding(service_type, args.batch_size, True, args.max_retries, args.backoff, args.sleep)
    print(f"Loaded {len(services)} services.", flush=True)

    service_attr_defs = get_objecttype_attributes(service_type, args.max_retries, args.backoff)
    service_attr_names = [a.get('name', f"attr_{a.get('id')}") for a in service_attr_defs]
    service_attr_by_id = {str(a.get('id')): a for a in service_attr_defs if a.get('id') is not None}

    extra_cols = ['Responsible Teams', 'Owner', 'Product Theme', 'Stream']
    columns = build_columns(service_attr_names, args.template, extra_cols)

    matched_services = 0

    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()

        for svc in services:
            base = flatten_service(svc, service_attr_by_id, service_attr_names)
            row = {c: '' for c in columns}
            for k, v in base.items():
                if k in row:
                    row[k] = v

            service_name = str(svc.get('label') or '').strip()
            key = service_name.lower()

            infos = service_to_infos.get(key, [])
            if infos:
                matched_services += 1

            teams_out: List[str] = []
            owners_out: List[str] = []
            themes_out: List[str] = []
            streams_out: List[str] = []

            for inf in infos:
                if inf.get('team_name'):
                    teams_out.append(inf['team_name'])
                for o in (inf.get('devmgr') or []):
                    owners_out.append(o)
                for th in (inf.get('theme') or []):
                    themes_out.append(th)
                    for st in theme_to_streams.get(th.lower(), []):
                        streams_out.append(st)

            row['Responsible Teams'] = join_dedup(teams_out)
            row['Owner'] = join_dedup(owners_out)
            row['Product Theme'] = join_dedup(themes_out)
            row['Stream'] = join_dedup(streams_out)

            writer.writerow(row)

    print(f"Matched services (with at least 1 responsible team): {matched_services}", flush=True)
    print(f"✅ Export completed: {args.out}", flush=True)


if __name__ == '__main__':
    main()
