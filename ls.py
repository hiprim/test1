#!/usr/bin/env python3
"""A very simple Python implementation of ls.

Lists the contents of one or more directories. If -l is passed, also
shows the size and last-modified time of each entry.
"""

import argparse
import os
import sys


def human_readable_size(num: int) -> str:
    for unit in ("B", "K", "M", "G", "T"):
        if num < 1024 or unit == "T":
            return f"{num:.1f}{unit}" if unit != "B" else f"{num}B"
        num /= 1024
    return f"{num:.1f}P"


def list_dir(path: str, long: bool = False) -> int:
    if os.path.isfile(path):
        entries = [path]
        base = None
    else:
        try:
            entries = sorted(os.listdir(path))
        except OSError as exc:
            print(f"ls: {path}: {exc.strerror}", file=sys.stderr)
            return 1
        base = path

    if len(entries) > 1:
        print(f"{path}:")
    for name in entries:
        full = name if base is None else os.path.join(base, name)
        if long:
            stat = os.stat(full)
            size = human_readable_size(stat.st_size)
            mtime = __import__("datetime").datetime.fromtimestamp(stat.st_mtime)
            print(f"{size:>8}  {mtime:%Y-%m-%d %H:%M}  {name}")
        else:
            print(name)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="List directory contents.")
    parser.add_argument("-l", action="store_true", help="use a long listing format")
    parser.add_argument(
        "paths", nargs="*", default=["."], help="files or directories to list"
    )
    args = parser.parse_args()

    status = 0
    for path in args.paths:
        status |= list_dir(path, long=args.l)
    return status


if __name__ == "__main__":
    sys.exit(main())
