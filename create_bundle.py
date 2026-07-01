import os
import zipfile

BASE = r"c:\Users\meesh_l47nrv4\OneDrive\Desktop\SafeBet IQ\SafeBetdemo-main\SafeBetdemo-main"
OUT  = r"c:\Users\meesh_l47nrv4\OneDrive\Desktop\SafeBet IQ\SafeBetdemo-main\rc1-v10-bundle.zip"

NEXT_SKIP = {".next/cache"}

def should_skip_next(rel):
    for skip in NEXT_SKIP:
        if rel.startswith(skip):
            return True
    return False

file_count = 0

with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:

    # Top-level files
    for name in ["package.json", "package-lock.json", "next.config.js", "Procfile", ".npmrc"]:
        full = os.path.join(BASE, name)
        if os.path.isfile(full):
            zf.write(full, name)
            file_count += 1

    # .ebextensions directory
    eb_dir = os.path.join(BASE, ".ebextensions")
    if os.path.isdir(eb_dir):
        for fname in os.listdir(eb_dir):
            full = os.path.join(eb_dir, fname)
            arc = f".ebextensions/{fname}"
            zf.write(full, arc)
            file_count += 1

    # .platform directory (nginx config, security headers)
    platform_dir = os.path.join(BASE, ".platform")
    if os.path.isdir(platform_dir):
        for root, dirs, files in os.walk(platform_dir):
            for fname in files:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, BASE).replace("\\", "/")
                zf.write(full, rel)
                file_count += 1

    # .next directory (skip cache)
    next_dir = os.path.join(BASE, ".next")
    for root, dirs, files in os.walk(next_dir):
        for fname in files:
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, BASE).replace("\\", "/")
            if not should_skip_next(rel):
                zf.write(full, rel)
                file_count += 1

    # public directory
    pub_dir = os.path.join(BASE, "public")
    if os.path.isdir(pub_dir):
        for root, dirs, files in os.walk(pub_dir):
            for fname in files:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, BASE).replace("\\", "/")
                zf.write(full, rel)
                file_count += 1

size_mb = os.path.getsize(OUT) / 1024 / 1024
print(f"Bundle: {size_mb:.1f} MB, {file_count} files")
print(f"Output: {OUT}")
