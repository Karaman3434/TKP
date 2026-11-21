#!/usr/bin/env python3
"""Static isolation guard for the performance-test branch. Does not execute app code."""
from pathlib import Path
import re, sys

root = Path(__file__).resolve().parent
cfg = (root / "firebase-config.js").read_text(encoding="utf-8")
problems = []
if not re.search(r'projectId:\s*"istakip-performans-test"', cfg):
    problems.append("firebase-config.js projectId must be istakip-performans-test")
if "weicon-asist-default-rtdb" in cfg or "weicon-asist.firebaseapp.com" in cfg:
    problems.append("Production Firebase URL/domain detected in firebase-config.js")
if "TEST_PROJECT_API_KEY_NOT_CONFIGURED" not in cfg:
    problems.append("Test config placeholder missing; audit expects non-runnable placeholder")
for path in root.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in (".js", ".html"):
        continue
    if any(part.startswith(".git") or part == "_backups" for part in path.parts):
        continue
    try: content = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError): continue
    if "weicon-asist-default-rtdb.europe-west1.firebasedatabase.app" in content:
        problems.append(f"Production RTDB URL detected: {path.relative_to(root)}")
    if "weicon-asist.cloudfunctions.net" in content:
        problems.append(f"Production Cloud Function endpoint detected: {path.relative_to(root)}")
if problems:
    print("ISOLATION AUDIT FAILED:")
    print("\n".join("- " + p for p in problems))
    sys.exit(1)
print("PASS: production Firebase RTDB/Cloud Function endpoints not detected; test config remains placeholder.")
