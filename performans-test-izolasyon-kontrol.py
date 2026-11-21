#!/usr/bin/env python3
"""Static isolation guard for the performance-test branch. Does not execute app code."""
from pathlib import Path
import re, sys

root = Path(__file__).resolve().parent
problems = []
cfg_path = root / "firebase-config.js"
if not cfg_path.exists():
    problems.append("firebase-config.js missing")
else:
    cfg = cfg_path.read_text(encoding="utf-8")
    if not re.search(r'projectId:\s*"istakip-performans-test"', cfg):
        problems.append("firebase-config.js projectId must be istakip-performans-test")
    if "weicon-asist" in cfg:
        problems.append("Production Firebase identity detected in firebase-config.js")
    if "TEST_PROJECT_API_KEY_NOT_CONFIGURED" not in cfg:
        problems.append("Test config placeholder missing; audit expects non-runnable placeholder")

scan_suffixes = {".js", ".html", ".json", ".yml", ".yaml", ".txt", ".md"}
for path in root.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in scan_suffixes:
        continue
    if any(part.startswith(".git") or part == "_backups" for part in path.parts):
        continue
    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    rel = str(path.relative_to(root))
    forbidden = [
        "weicon-asist-default-rtdb.europe-west1.firebasedatabase.app",
        "weicon-asist.cloudfunctions.net",
    ]
    for marker in forbidden:
        if marker in content:
            problems.append(f"Production endpoint detected ({marker}): {rel}")
    # Avoid inadvertently hard-wiring the production Firebase project ID into test code.
    if "weicon-asist" in content and rel != "PERFORMANS-TEST-IZOLASYONU.md":
        problems.append(f"Production project identifier detected: {rel}")

# Script order sanity check: where auth.js is included, test config must be included
# earlier in that HTML page. This is a static check only, not browser execution.
for path in root.rglob("*.html"):
    if any(part.startswith(".git") or part == "_backups" for part in path.parts):
        continue
    try:
        html = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>', html, re.I)
    auth_indices = [i for i, src in enumerate(scripts) if re.search(r'(^|/)auth\.js(?:[?#]|$)', src)]
    config_indices = [i for i, src in enumerate(scripts) if re.search(r'(^|/)firebase-config\.js(?:[?#]|$)', src)]
    for ai in auth_indices:
        if not config_indices or not any(ci < ai for ci in config_indices):
            problems.append(f"firebase-config.js must precede auth.js: {path.relative_to(root)}")

if problems:
    print("ISOLATION AUDIT FAILED:")
    print("\n".join("- " + p for p in problems))
    sys.exit(1)
print("PASS: no production RTDB/Cloud Function/project markers detected; test config placeholder and auth/config script order checked.")
