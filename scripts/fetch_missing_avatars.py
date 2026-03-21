#!/usr/bin/env python3
import os
import csv
import re
import time
import base64
import argparse
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

import requests

# ----------------------------
# Helpers: naming rules
# ----------------------------

def email_to_bases(email: str) -> Tuple[str, str]:
    """
    Examples:
      nome.cognome@dominio.com      -> dotted: nome.cognome     dashed: nome-cognome
      nome.cognome-ext@dominio.com  -> dotted: nome.cognome     dashed: nome-cognome   (remove -ext)
    """
    local = (email or "").strip().lower().split("@")[0]
    local = local.replace("-ext", "")
    dotted = local
    dashed = local.replace(".", "-")
    return dotted, dashed

def existing_avatar_path(assets_dir: Path, dotted_base: str, dashed_base: str) -> Optional[Path]:
    """
    Match either:
      dashed_base.*  (e.g., nome-cognome.png)
      dotted_base.*  (e.g., nome.cognome.png)
    """
    if not assets_dir.exists():
        return None

    # priority: dashed first, then dotted
    for pattern in (f"{dashed_base}.*", f"{dotted_base}.*"):
        hits = list(assets_dir.glob(pattern))
        if hits:
            return hits[0]
    return None

def guess_ext_from_content_type(ct: str) -> str:
    ct = (ct or "").split(";")[0].strip().lower()
    if ct == "image/png":
        return ".png"
    if ct in ("image/jpeg", "image/jpg"):
        return ".jpg"
    if ct == "image/webp":
        return ".webp"
    if ct == "image/gif":
        return ".gif"
    return ""

def pick_largest_avatar_url(avatar_urls: Dict[str, str]) -> Optional[str]:
    """
    Jira user objects include avatarUrls with keys like 16x16, 24x24, 32x32, 48x48. citeturn138search218turn138search210
    We'll pick the largest numeric size.
    """
    if not isinstance(avatar_urls, dict) or not avatar_urls:
        return None

    best_url = None
    best_size = -1
    for k, v in avatar_urls.items():
        if not v:
            continue
        m = re.match(r"^(\d+)x(\d+)$", str(k))
        if not m:
            continue
        size = int(m.group(1))
        if size > best_size:
            best_size = size
            best_url = v

    # fallback: any value
    return best_url or next((v for v in avatar_urls.values() if v), None)

def try_upgrade_to_96(url: str) -> str:
    """
    In some Atlassian avatar URLs you can change trailing /48 to /96 for a bigger avatar (best effort). citeturn138search214
    We'll only attempt if URL ends with '/<number>'.
    """
    if not url:
        return url
    m = re.search(r"/(\d+)$", url)
    if m:
        return url[:m.start(1)] + "96"
    return url

# ----------------------------
# Jira API: user lookup + download
# ----------------------------

def build_basic_auth_header(email: str, token: str) -> Dict[str, str]:
    raw = f"{email}:{token}".encode("utf-8")
    b64 = base64.b64encode(raw).decode("utf-8")
    return {"Authorization": f"Basic {b64}"}

def jira_user_search(session: requests.Session, site: str, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
    """
    GET /rest/api/3/user/search?query=...
    This is part of Jira Cloud REST API v3 user search. citeturn138search217
    """
    url = f"{site.rstrip('/')}/rest/api/3/user/search"
    r = session.get(url, params={"query": query, "maxResults": max_results}, timeout=(10, 60))
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else []

def pick_user_from_results(results: List[Dict[str, Any]], email: str) -> Optional[Dict[str, Any]]:
    email_l = (email or "").strip().lower()

    # Prefer exact email match if emailAddress is visible
    for u in results:
        ea = (u.get("emailAddress") or "").strip().lower()
        if ea and ea == email_l:
            return u

    # Otherwise prefer active users with avatarUrls
    for u in results:
        if u.get("active") is False:
            continue
        if isinstance(u.get("avatarUrls"), dict) and u.get("avatarUrls"):
            return u

    return results[0] if results else None

def download_image(session: requests.Session, url: str) -> Optional[Tuple[bytes, str]]:
    """
    Download image bytes; allow redirects. Some avatar URLs redirect to site URLs.
    """
    r = session.get(url, timeout=(10, 60), allow_redirects=True)
    if not r.ok or not r.content:
        return None
    return r.content, (r.headers.get("Content-Type") or "")

# ----------------------------
# CSV reading
# ----------------------------

def iter_emails_from_csv(csv_path: Path, email_col: str = "Email") -> List[str]:
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise RuntimeError("CSV has no header")
        if email_col not in reader.fieldnames:
            raise RuntimeError(f"CSV missing '{email_col}' column. Found: {reader.fieldnames}")

        emails = []
        for row in reader:
            e = (row.get(email_col) or "").strip()
            if e:
                emails.append(e)
        return emails

# ----------------------------
# Main workflow
# ----------------------------

def main():
    parser = argparse.ArgumentParser(description="Fetch missing Jira avatars for emails in people-database.csv")
    parser.add_argument("--csv", default="src/people-database.csv", help="Path to people-database.csv (default: src/people-database.csv)")
    parser.add_argument("--assets-dir", default="assets", help="Assets folder where avatars are stored (default: assets)")
    parser.add_argument("--email-col", default="Email", help="CSV column containing email (default: Email)")
    parser.add_argument("--site", default=os.environ.get("ATLASSIAN_SITE", "https://guccidigital.atlassian.net"),
                        help="Atlassian site base url (default from ATLASSIAN_SITE)")
    parser.add_argument("--atlassian-email", default=os.environ.get("ATLASSIAN_EMAIL", ""), help="Atlassian email (default from ATLASSIAN_EMAIL)")
    parser.add_argument("--atlassian-token", default=os.environ.get("ATLASSIAN_API_TOKEN", ""), help="Atlassian API token (default from ATLASSIAN_API_TOKEN)")
    parser.add_argument("--sleep", type=float, default=0.05, help="Sleep between downloads (default: 0.05)")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    assets_dir = Path(args.assets_dir)

    if not args.atlassian_email or not args.atlassian_token:
        raise RuntimeError("Missing ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN (env vars or CLI args).")

    if not csv_path.exists():
        raise RuntimeError(f"CSV not found: {csv_path.resolve()}")

    assets_dir.mkdir(parents=True, exist_ok=True)

    # Build session with Basic Auth
    session = requests.Session()
    session.headers.update({
        "Accept": "application/json",
        **build_basic_auth_header(args.atlassian_email, args.atlassian_token),
    })

    emails = iter_emails_from_csv(csv_path, args.email_col)
    # Dedup while preserving order
    seen = set()
    emails = [e for e in emails if not (e.lower() in seen or seen.add(e.lower()))]

    total = len(emails)
    downloaded = 0
    skipped = 0
    not_found = 0
    failed = 0

    print(f"[start] csv={csv_path} assets_dir={assets_dir} emails={total}", flush=True)

    for idx, email in enumerate(emails, start=1):
        dotted, dashed = email_to_bases(email)
        existing = existing_avatar_path(assets_dir, dotted, dashed)
        if existing:
            skipped += 1
            continue

        # Search user by email first; fallback to localpart without -ext
        fallback_q = dotted  # already removed -ext
        try:
            results = jira_user_search(session, args.site, email)
            if not results:
                results = jira_user_search(session, args.site, fallback_q)

            user = pick_user_from_results(results, email)
            if not user:
                not_found += 1
                continue

            avatar_url = pick_largest_avatar_url(user.get("avatarUrls") or {})
            if not avatar_url:
                not_found += 1
                continue

            # Try 96px first (best effort), then the original largest url citeturn138search214
            urls_to_try = []
            up96 = try_upgrade_to_96(avatar_url)
            if up96 and up96 != avatar_url:
                urls_to_try.append(up96)
            urls_to_try.append(avatar_url)

            img_bytes = None
            content_type = ""
            for u in urls_to_try:
                dl = download_image(session, u)
                if dl:
                    img_bytes, content_type = dl
                    break

            if not img_bytes:
                failed += 1
                continue

            ext = guess_ext_from_content_type(content_type)
            if not ext:
                # fallback if content-type missing
                ext = ".png"

            out_path = assets_dir / f"{dashed}{ext}"
            out_path.write_bytes(img_bytes)
            downloaded += 1

            if idx % 25 == 0 or idx == total:
                print(f"[progress] {idx}/{total} downloaded={downloaded} skipped={skipped} not_found={not_found} failed={failed}", flush=True)

            if args.sleep:
                time.sleep(args.sleep)

        except Exception:
            failed += 1
            continue

    print(f"[done] downloaded={downloaded} skipped(existing)={skipped} not_found={not_found} failed={failed}", flush=True)


if __name__ == "__main__":
    main()