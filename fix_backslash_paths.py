import os

BASE = r"c:\Users\meesh_l47nrv4\OneDrive\Desktop\SafeBet IQ\SafeBetdemo-main\SafeBetdemo-main\.next\server"

# These three paths are present in all 72 broken files with \\ instead of /
REPLACEMENTS = [
    (
        r"next/dist\\client\\components\\action-async-storage.external.js",
        "next/dist/client/components/action-async-storage.external.js"
    ),
    (
        r"next/dist\\client\\components\\request-async-storage.external.js",
        "next/dist/client/components/request-async-storage.external.js"
    ),
    (
        r"next/dist\\client\\components\\static-generation-async-storage.external.js",
        "next/dist/client/components/static-generation-async-storage.external.js"
    ),
]

files_fixed = 0
fixes_applied = 0

for root, dirs, files in os.walk(BASE):
    for fname in files:
        if not fname.endswith(".js"):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        changed = False
        for old, new in REPLACEMENTS:
            if old in content:
                content = content.replace(old, new)
                fixes_applied += 1
                changed = True

        if changed:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            files_fixed += 1

print(f"Fixed {files_fixed} files, {fixes_applied} replacements applied")

# Verify the specific file that was failing
verify_path = os.path.join(BASE, "app", "page.js")
with open(verify_path, "r", encoding="utf-8") as f:
    v = f.read()

remaining = v.count(r"next/dist\\")
print(f"Verification page.js: {remaining} remaining backslash paths (should be 0)")
