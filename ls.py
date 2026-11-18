#!/usr/bin/env python3
"""A very simple Python implementation of `ls`."""

import os
import sys


def main():
    # 目标目录：未传参数时默认为当前目录
    path = sys.argv[1] if len(sys.argv) > 1 else "."

    if not os.path.exists(path):
        print(f"ls: cannot access '{path}': No such file or directory", file=sys.stderr)
        sys.exit(1)

    if os.path.isfile(path):
        print(path)
        return

    entries = sorted(os.listdir(path))
    for entry in entries:
        print(entry)


if __name__ == "__main__":
    main()
