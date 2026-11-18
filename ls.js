#!/usr/bin/env node
'use strict';

// A Node.js implementation of the `ls` command.

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

const USAGE = `Usage: ls.js [OPTION]... [FILE]...
List information about the FILEs (the current directory by default).

Options:
  -a, --all             do not ignore entries starting with .
  -A, --almost-all      like -a, but do not list implied . and ..
  -l                    use a long listing format
  -1                    list one file per line
  -R, --recursive       list subdirectories recursively
  -r, --reverse         reverse order while sorting
  -S                    sort by file size, largest first
  -t                    sort by modification time, newest first
  -h, --human-readable  with -l, print sizes in human readable format
      --help            display this help and exit
      --version         output version information and exit
`;

function parseArgs(argv) {
  const opts = {
    all: false,
    almostAll: false,
    long: false,
    one: false,
    recursive: false,
    reverse: false,
    sortBySize: false,
    sortByTime: false,
    humanReadable: false,
    paths: [],
  };

  let endOfOptions = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (endOfOptions || arg === '-' || !arg.startsWith('-')) {
      opts.paths.push(arg);
      continue;
    }

    if (arg === '--') {
      endOfOptions = true;
      continue;
    }

    if (arg.startsWith('--')) {
      switch (arg) {
        case '--all':
          opts.all = true;
          break;
        case '--almost-all':
          opts.almostAll = true;
          break;
        case '--recursive':
          opts.recursive = true;
          break;
        case '--reverse':
          opts.reverse = true;
          break;
        case '--human-readable':
          opts.humanReadable = true;
          break;
        case '--help':
          process.stdout.write(USAGE);
          process.exit(0);
          break;
        case '--version':
          process.stdout.write(`ls.js ${VERSION}\n`);
          process.exit(0);
          break;
        default:
          process.stderr.write(`ls.js: unrecognized option '${arg}'\n`);
          process.stderr.write(`Try 'ls.js --help' for more information.\n`);
          process.exit(2);
      }
      continue;
    }

    // Short option cluster (e.g. -al)
    for (const ch of arg.slice(1)) {
      switch (ch) {
        case 'a':
          opts.all = true;
          break;
        case 'A':
          opts.almostAll = true;
          break;
        case 'l':
          opts.long = true;
          break;
        case '1':
          opts.one = true;
          break;
        case 'R':
          opts.recursive = true;
          break;
        case 'r':
          opts.reverse = true;
          break;
        case 'S':
          opts.sortBySize = true;
          break;
        case 't':
          opts.sortByTime = true;
          break;
        case 'h':
          opts.humanReadable = true;
          break;
        default:
          process.stderr.write(`ls.js: invalid option -- '${ch}'\n`);
          process.stderr.write(`Try 'ls.js --help' for more information.\n`);
          process.exit(2);
      }
    }
  }

  return opts;
}

function humanSize(bytes) {
  const units = ['B', 'K', 'M', 'G', 'T', 'P'];
  let unit = 0;
  let value = bytes;

  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)}${units[unit]}`;
}

function modeString(stats) {
  const type = stats.isDirectory()
    ? 'd'
    : stats.isSymbolicLink()
      ? 'l'
      : stats.isCharacterDevice()
        ? 'c'
        : stats.isBlockDevice()
          ? 'b'
          : stats.isFIFO()
            ? 'p'
            : stats.isSocket()
              ? 's'
              : '-';

  const perm =
    (stats.mode & 0o400 ? 'r' : '-') +
    (stats.mode & 0o200 ? 'w' : '-') +
    (stats.mode & 0o100 ? 'x' : '-') +
    (stats.mode & 0o040 ? 'r' : '-') +
    (stats.mode & 0o020 ? 'w' : '-') +
    (stats.mode & 0o010 ? 'x' : '-') +
    (stats.mode & 0o004 ? 'r' : '-') +
    (stats.mode & 0o002 ? 'w' : '-') +
    (stats.mode & 0o001 ? 'x' : '-');

  return type + perm;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatTime(mtimeMs) {
  const d = new Date(mtimeMs);
  const now = Date.now();
  const sixMonths = 182.5 * 24 * 60 * 60 * 1000;

  const timePart =
    now - mtimeMs > sixMonths || mtimeMs - now > sixMonths
      ? ` ${d.getFullYear()}`
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${timePart}`;
}

function readEntries(dir, opts) {
  let names = fs.readdirSync(dir);

  if (!opts.all && !opts.almostAll) {
    names = names.filter((n) => !n.startsWith('.'));
  } else if (opts.almostAll) {
    names = names.filter((n) => n !== '.' && n !== '..');
  }

  const entries = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const stats = fs.lstatSync(full);
      entries.push({ name, path: full, stats });
    } catch {
      // Entry disappeared between readdir and stat; skip it.
    }
  }

  entries.sort((a, b) => {
    if (opts.sortBySize) return b.stats.size - a.stats.size;
    if (opts.sortByTime) return b.stats.mtimeMs - a.stats.mtimeMs;
    return a.name.localeCompare(b.name);
  });

  if (opts.reverse) entries.reverse();

  return entries;
}

function printLong(entries, opts) {
  const rows = entries.map((e) => {
    const s = e.stats;
    const size = opts.humanReadable ? humanSize(s.size) : String(s.size);
    return [
      modeString(s),
      String(s.nlink),
      String(s.uid === undefined ? 0 : s.uid),
      String(s.gid),
      size,
      formatTime(s.mtimeMs),
      e.name,
    ];
  });

  const widths = new Array(6).fill(1);
  for (const r of rows) {
    for (let i = 0; i < 6; i++) {
      widths[i] = Math.max(widths[i], r[i].length);
    }
  }

  let out = '';
  for (const r of rows) {
    out += r[0].padEnd(widths[0] + 1);
    out += r[1].padStart(widths[1] + 1);
    out += r[2].padStart(widths[2] + 1);
    out += r[3].padStart(widths[3] + 1);
    out += r[4].padStart(widths[4] + 1);
    out += r[5].padStart(widths[5] + 1);
    out += ` ${r[6]}\n`;
  }
  process.stdout.write(out);
}

function printColumns(entries) {
  const names = entries.map((e) => e.name);
  const maxLen = names.reduce((m, n) => Math.max(m, n.length), 0);
  const width = maxLen + 2;
  const cols = Math.max(1, Math.floor((process.stdout.columns || 80) / width));
  const rows = Math.ceil(names.length / cols);

  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      if (idx < names.length) line += names[idx].padEnd(width);
    }
    process.stdout.write(`${line.trimEnd()}\n`);
  }
}

function printEntries(entries, opts) {
  if (entries.length === 0) return;
  if (opts.long) {
    printLong(entries, opts);
  } else if (opts.one || !process.stdout.isTTY) {
    for (const e of entries) process.stdout.write(`${e.name}\n`);
  } else {
    printColumns(entries);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const targets = opts.paths.length ? opts.paths : ['.'];
  const results = [];
  const seen = new Set();

  const walk = (target) => {
    let stats;
    try {
      stats = fs.lstatSync(target);
    } catch (err) {
      process.stderr.write(`ls.js: cannot access '${target}': ${err.message}\n`);
      process.exitCode = 2;
      return;
    }

    if (stats.isDirectory()) {
      try {
        const entries = readEntries(target, opts);
        results.push({ dir: target, entries });

        if (opts.recursive) {
          for (const sub of entries) {
            if (!sub.stats.isDirectory()) continue;
            const real = fs.realpathSync(sub.path);
            if (seen.has(real)) continue; // avoid cycle via symlink/loop
            seen.add(real);
            walk(sub.path);
          }
        }
      } catch (err) {
        process.stderr.write(`ls.js: cannot access '${target}': ${err.message}\n`);
        process.exitCode = 2;
      }
    } else {
      // A single file argument is listed directly.
      results.push({
        dir: null,
        entries: [{ name: target, path: target, stats }],
      });
    }
  };

  for (const t of targets) {
    if (t) walk(t);
  }

  const multiple = results.length > 1;

  results.forEach((r, idx) => {
    if (idx > 0) process.stdout.write('\n');
    if (r.dir !== null && multiple) {
      process.stdout.write(`${r.dir}:\n`);
    }
    printEntries(r.entries, opts);
  });
}

main();
