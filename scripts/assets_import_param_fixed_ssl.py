#!/usr/bin/env python3
"""Generic Jira Assets (Cloud) CSV -> Assets updater (append references)

FIX: Stable SSL verification on macOS/Homebrew Python + robust multi-value parsing.

Why you saw intermittent SSL failures
------------------------------------
On some macOS setups (especially Homebrew Python 3.14), Requests may not reliably
pick up a trusted CA bundle, leading to intermittent:
  SSLCertVerificationError: unable to get local issuer certificate

This version forces Requests to use a CA bundle consistently:
- If REQUESTS_CA_BUNDLE or SSL_CERT_FILE is set, it uses that.
- Otherwise it uses certifi.where().

It also keeps the robust multi-value parsing for People Database patterns like:
  Atlas\n,Rosalux\n,Architecture

Env (required)
--------------
ATLASSIAN_EMAIL
ATLASSIAN_API_TOKEN
ASSETS_WORKSPACE_ID

Env (optional)
--------------
ATLASSIAN_SITE (default https://instance.atlassian.net)
DRY_RUN=1
ONLY_KEY="<value>"
STOP_AFTER=N
SLEEP_SEC=0.15
REQUESTS_CA_BUNDLE=/path/to/ca.pem   # optional; preferred in corporate SSL inspection
SSL_CERT_FILE=/path/to/ca.pem        # optional

Tip
---
Rerunning the script is safe: it merges (appends) references and avoids duplicates.
So after fixing SSL, you can just rerun the full command.
"""

import os
import csv
import time
import json
import base64
import argparse
import re
from typing import Dict, List, Optional, Any

import requests

# Ensure a stable CA bundle
try:
    import certifi  # type: ignore
except Exception:
    certifi = None

SITE = os.environ.get("ATLASSIAN_SITE", "https://instance.atlassian.net").rstrip("/")
WORKSPACE_ID = os.environ["ASSETS_WORKSPACE_ID"]
EMAIL = os.environ["ATLASSIAN_EMAIL"]
API_TOKEN = os.environ["ATLASSIAN_API_TOKEN"]

DRY_RUN = os.environ.get("DRY_RUN", "0") in ("1", "true", "TRUE", "yes", "YES")
ONLY_KEY = os.environ.get("ONLY_KEY", "").strip()
STOP_AFTER = int(os.environ.get("STOP_AFTER", "0") or 0)
SLEEP_SEC = float(os.environ.get("SLEEP_SEC", "0.15") or 0.15)

BASE = f"{SITE}/gateway/api/jsm/assets/workspace/{WORKSPACE_ID}/v1"
_auth = base64.b64encode(f"{EMAIL}:{API_TOKEN}".encode("utf-8")).decode("utf-8")
HEADERS = {
    "Authorization": f"Basic {_auth}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# CA bundle resolution priority:
# 1) REQUESTS_CA_BUNDLE
# 2) SSL_CERT_FILE
# 3) certifi.where()
ENV_CA = (os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE") or "").strip()
VERIFY_CA = ENV_CA if ENV_CA else (certifi.where() if certifi else True)

# Use a single Session for connection pooling + consistent verify
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

LABEL_ATTR_CACHE: Dict[str, str] = {}  # objectTypeId -> label attribute name


def _print_http_error(prefix: str, r: requests.Response, payload: Optional[dict] = None):
    print(f"\n[ERROR] {prefix}")
    print("  URL:", r.url)
    print("  Status:", r.status_code)
    try:
        print("  Response JSON:", r.json())
    except Exception:
        print("  Response TEXT:", (r.text or "")[:4000])
    if payload is not None:
        try:
            print("  Payload (truncated):", json.dumps(payload, ensure_ascii=False)[:4000])
        except Exception:
            pass


def http_get(url: str) -> requests.Response:
    r = SESSION.get(url, timeout=60, verify=VERIFY_CA)
    if not r.ok:
        _print_http_error("GET failed", r)
        r.raise_for_status()
    return r


def http_post(url: str, payload: dict) -> requests.Response:
    r = SESSION.post(url, json=payload, timeout=60, verify=VERIFY_CA)
    if not r.ok:
        _print_http_error("POST failed", r, payload)
        r.raise_for_status()
    return r


def http_put(url: str, payload: dict) -> requests.Response:
    r = SESSION.put(url, json=payload, timeout=60, verify=VERIFY_CA)
    if not r.ok:
        _print_http_error("PUT failed", r, payload)
        r.raise_for_status()
    return r


# Robust multi-split:
# - normalize patterns like "\n,Value" and "Value,\n" (common in People DB exports)
# - then split on || OR any of [newline, comma, semicolon]
_SPLIT_RE = re.compile(r"\s*\|\|\s*|[\n,;]+")


def split_values(raw: Any) -> List[str]:
    if raw is None:
        return []

    s = str(raw)
    s = s.strip().strip('"').strip()
    if not s:
        return []

    s = s.replace("\r\n", "\n").replace("\r", "\n")

    # Fix commas that appear at beginning/end of line
    s = re.sub(r"\n\s*,\s*", "\n", s)
    s = re.sub(r"\s*,\s*\n", "\n", s)

    parts = _SPLIT_RE.split(s)

    out: List[str] = []
    for p in parts:
        p = (p or "").strip().strip('"').strip()
        p = p.lstrip(',').strip()
        if p:
            out.append(p)

    seen = set()
    dedup: List[str] = []
    for v in out:
        if v not in seen:
            seen.add(v)
            dedup.append(v)
    return dedup


def aql_search(ql_query: str, max_results: int = 5) -> List[dict]:
    url = f"{BASE}/object/aql"
    payload = {
        "qlQuery": ql_query,
        "startAt": 0,
        "maxResults": max_results,
        "includeAttributes": False,
    }
    data = http_post(url, payload).json()
    if isinstance(data, dict):
        return data.get("values") or data.get("objectEntries") or []
    return []


def get_object(object_id: str) -> dict:
    return http_get(f"{BASE}/object/{object_id}").json()


def get_objecttype_attributes(object_type_id: str):
    return http_get(f"{BASE}/objecttype/{object_type_id}/attributes").json()


def get_label_attr_name(object_type_id: str) -> str:
    oid = str(object_type_id)
    if oid in LABEL_ATTR_CACHE:
        return LABEL_ATTR_CACHE[oid]

    data = get_objecttype_attributes(oid)
    attrs = data.get("values", data) if isinstance(data, dict) else data

    label_name = "Name"
    if isinstance(attrs, list):
        for a in attrs:
            if a.get("label") is True and isinstance(a.get("name"), str):
                label_name = a["name"].strip()
                break

    LABEL_ATTR_CACHE[oid] = label_name
    return label_name


def find_object_in_type(object_type_id: str, label_value: str) -> Optional[dict]:
    label_attr = get_label_attr_name(object_type_id)
    safe_val = label_value.replace('"', '\\"')

    q1 = f'objectTypeId = {object_type_id} AND "{label_attr}" = "{safe_val}"'
    res = aql_search(q1, max_results=2)
    if res:
        return res[0]

    for fallback_attr in ("Name", "Key", "Service Name", "User name", "User", "Email"):
        if fallback_attr == label_attr:
            continue
        q = f'objectTypeId = {object_type_id} AND "{fallback_attr}" = "{safe_val}"'
        res2 = aql_search(q, max_results=2)
        if res2:
            return res2[0]

    return None


def find_source_object(source_object_type_id: str, key_col: str, key_value: str) -> Optional[dict]:
    safe = key_value.replace('"', '\\"')

    q = f'objectTypeId = {source_object_type_id} AND "{key_col}" = "{safe}"'
    res = aql_search(q, max_results=2)
    if res:
        return res[0]

    label_attr = get_label_attr_name(source_object_type_id)
    q2 = f'objectTypeId = {source_object_type_id} AND "{label_attr}" = "{safe}"'
    res2 = aql_search(q2, max_results=2)
    if res2:
        return res2[0]

    if label_attr != "Name":
        q3 = f'objectTypeId = {source_object_type_id} AND "Name" = "{safe}"'
        res3 = aql_search(q3, max_results=2)
        if res3:
            return res3[0]

    return None


def build_attr_def_map(object_type_id: str) -> Dict[str, Dict[str, Any]]:
    data = get_objecttype_attributes(object_type_id)
    attrs = data.get("values", data) if isinstance(data, dict) else data
    if not isinstance(attrs, list):
        raise RuntimeError(f"Unexpected attributes payload: {type(attrs)}")

    out: Dict[str, Dict[str, Any]] = {}
    for a in attrs:
        name = a.get("name")
        attr_id = a.get("id")
        ref_type_id = a.get("referenceObjectTypeId")
        editable = a.get("editable", True)
        max_card = a.get("maximumCardinality")

        if isinstance(name, str) and attr_id is not None:
            out[name.strip().lower()] = {
                "attrId": str(attr_id),
                "refTypeId": str(ref_type_id) if ref_type_id is not None else None,
                "editable": bool(editable),
                "maxCard": int(max_card) if isinstance(max_card, int) else None,
                "name": name.strip(),
            }
    return out


def extract_current_reference_keys_by_attr_id(obj: dict, attr_id: str) -> List[str]:
    keys: List[str] = []
    for attr in obj.get("attributes", []):
        if str(attr.get("objectTypeAttributeId")) == str(attr_id):
            for v in attr.get("objectAttributeValues", []):
                ro = v.get("referencedObject")
                if ro and ro.get("objectKey"):
                    keys.append(ro["objectKey"])
                elif v.get("value"):
                    keys.append(v["value"])

    seen = set()
    out: List[str] = []
    for k in keys:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def resolve_reference_object_key(value_from_csv: str, target_object_type_id: str) -> Optional[str]:
    obj = find_object_in_type(target_object_type_id, value_from_csv)
    if not obj:
        return None
    if obj.get("objectKey"):
        return obj["objectKey"]
    if obj.get("key"):
        return obj["key"]
    full = get_object(str(obj.get("id")))
    return full.get("objectKey")


def put_object(object_id: str, source_object_type_id: str, attributes_payload: List[dict], has_avatar: bool = False, avatar_uuid: str = ""):
    payload = {
        "objectTypeId": str(source_object_type_id),
        "attributes": attributes_payload,
        "hasAvatar": bool(has_avatar),
        "avatarUUID": avatar_uuid or "",
    }
    if DRY_RUN:
        print(f"[DRY_RUN] Would PUT object {object_id} with {len(attributes_payload)} attribute(s).")
        return {"dryRun": True}
    return http_put(f"{BASE}/object/{object_id}", payload).json()


def parse_maps(map_args: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for m in map_args:
        if "=" not in m:
            raise ValueError(f"Invalid --map '{m}'. Expected CSV_COL=Attr1|Attr2")
        left, right = m.split("=", 1)
        csv_col = left.strip()
        candidates = [p.strip() for p in right.split("|") if p.strip()]
        if not candidates:
            candidates = [csv_col]
        out[csv_col] = candidates
    return out


def resolve_attr(meta_map: Dict[str, Dict[str, Any]], candidates: List[str]) -> Optional[Dict[str, Any]]:
    for cand in candidates:
        k = cand.strip().lower()
        if k in meta_map:
            return meta_map[k]
    return None


def process_row(source_object_type_id: str, key_col: str, key_value: str, row: dict,
                csv_to_attr_candidates: Dict[str, List[str]],
                attr_def_map: Dict[str, Dict[str, Any]]):

    src_obj = find_source_object(source_object_type_id, key_col, key_value)
    if not src_obj:
        print(f"[SKIP] Source object not found in type {source_object_type_id}: {key_value}")
        return

    obj_id = str(src_obj.get("id"))
    full = get_object(obj_id)
    has_avatar = bool(full.get("hasAvatar", False))
    avatar_uuid = full.get("avatarUUID", "")

    updates: List[dict] = []

    for csv_col, candidates in csv_to_attr_candidates.items():
        values = split_values(row.get(csv_col, ""))
        if not values:
            continue

        meta = resolve_attr(attr_def_map, candidates)
        if not meta:
            print(f"[WARN] Attribute for CSV column '{csv_col}' not found in objectTypeId={source_object_type_id}. Tried: {candidates}")
            continue

        if not meta.get("editable", True):
            print(f"[WARN] Attribute '{meta.get('name')}' (id={meta['attrId']}) is not editable; skipping for '{key_value}'.")
            continue

        attr_id = meta["attrId"]
        ref_type_id = meta.get("refTypeId")
        max_card = meta.get("maxCard")

        if not ref_type_id:
            print(f"[WARN] Attribute '{meta.get('name')}' (id={attr_id}) has no referenceObjectTypeId. This script updates reference attributes only.")
            continue

        current_keys = extract_current_reference_keys_by_attr_id(full, attr_id)

        new_keys: List[str] = []
        for v in values:
            k = resolve_reference_object_key(v, ref_type_id)
            if not k:
                print(f"[WARN] Reference not found for '{csv_col}': '{v}' (source: {key_value}, targetTypeId: {ref_type_id})")
                continue
            new_keys.append(k)

        merged = list(current_keys)
        for k in new_keys:
            if k not in merged:
                merged.append(k)

        if isinstance(max_card, int) and max_card > 0 and len(merged) > max_card:
            merged = merged[:max_card]
            print(f"[WARN] Truncated '{csv_col}' for '{key_value}' to maxCardinality={max_card}.")

        updates.append({
            "objectTypeAttributeId": str(attr_id),
            "objectAttributeValues": [{"value": k} for k in merged]
        })

    if not updates:
        print(f"[NOOP] Nothing to update for {key_value}")
        return

    try:
        put_object(obj_id, source_object_type_id, updates, has_avatar=has_avatar, avatar_uuid=avatar_uuid)
        print(f"[OK] Updated {key_value}: {', '.join([u['objectTypeAttributeId'] for u in updates])}")
    except requests.exceptions.HTTPError:
        print(f"[SKIP] Failed updating {key_value} (objectId={obj_id}) - continuing...")


def run(csv_path: str, source_object_type_id: str, key_col: str, csv_to_attr_candidates: Dict[str, List[str]]):
    attr_def_map = build_attr_def_map(source_object_type_id)

    processed = 0
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key_value = (row.get(key_col) or "").strip().strip('"')
            if not key_value:
                continue
            if ONLY_KEY and key_value != ONLY_KEY:
                continue

            process_row(source_object_type_id, key_col, key_value, row, csv_to_attr_candidates, attr_def_map)
            processed += 1

            if STOP_AFTER and processed >= STOP_AFTER:
                print(f"[STOP] STOP_AFTER={STOP_AFTER} reached.")
                break

            if SLEEP_SEC:
                time.sleep(SLEEP_SEC)


def main():
    parser = argparse.ArgumentParser(description="Generic Jira Assets CSV reference updater (append) [fixed SSL + multivalue]")
    parser.add_argument('--csv', required=True, help='Path to CSV file')
    parser.add_argument('--source-object-type', required=True, help='Source objectTypeId (e.g., People=35)')
    parser.add_argument('--key-col', required=True, help='CSV column used to identify the source object (e.g., "Email")')
    parser.add_argument('--map', action='append', required=True, help='Mapping: CSV_COL=AttrName1|Alias2|Alias3  (repeatable)')

    args = parser.parse_args()
    csv_to_attr_candidates = parse_maps(args.map)

    print(f"Site: {SITE}")
    print(f"Workspace: {WORKSPACE_ID}")
    print(f"Source objectTypeId: {args.source_object_type}")
    print(f"Key column: {args.key_col}")
    print(f"Dry-run: {DRY_RUN}")
    print(f"SSL verify CA: {VERIFY_CA}")
    if ONLY_KEY:
        print(f"Only key: {ONLY_KEY}")

    for k, v in csv_to_attr_candidates.items():
        print(f"  map '{k}' -> {v}")

    run(args.csv, str(args.source_object_type), args.key_col, csv_to_attr_candidates)


if __name__ == '__main__':
    main()
