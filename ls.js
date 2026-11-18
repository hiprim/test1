#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Option parsing
// ---------------------------------------------------------------------------
const usage = `Usage: ls.js [OPTION]... [FILE]...
List information about the FILEs (the current directory by default).

Options:
  -a, --all          do not ignore entries starting with .
  -A, --almost-all   do not list implied . and ..
  -l                 use a long listing format
  -1                 list one file per line
  -R, --recursive    list subdirectories recursively
  -r, --reverse      reverse order while sorting
  -S                 sort by file size, largest first
  -t                 sort by modification time, newest first
  -h, --human-readable  with -l, print sizes in human readable format
  --help             display this help and exit
  --version          output version information and exit
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
    dirs: [],
  };

  let endOfOptions = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (endOfOptions || arg === '-' || !arg.startsWith('-')) {
      opts.dirs.push(arg);
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
          process.stdout.write(usage);
          process.exit(0);
        case '--version':
          process.stdout.write(`ls.js ${VERSION}\n`);
          process.exit(0);
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

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function humanSize(bytes) {
  const units = ['B', 'K', 'M', 'G', 'T', 'P'];
  let unit = 0;
  let value = bytes;

  while (Math.abs(value) >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)}${units[unit]}`;
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

function formatTime(mtime) {
  const now = Date.now();
  const sixMonths = 182.5 * 24 * 60 * 60 * 1000;
  const d = new Date(mtime);

  const timePart =
    now - mtime > sixMonths || mtime - now > sixMonths
      ? ` ${d.getFullYear()}`
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${timePart}`;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
function readEntries(dir, opts) {
  let names = fs.readdirSync(dir);

  if (!opts.all && !opts.almostAll) {
    names = names.filter((n) => !n.startsWith('.'));
  } else if (opts.almostAll) {
    names = names.filter((n) => n !== '.' && n !== '..');
  }

  const entries = names.map((name) => {
    const full = path.join(dir, name);
    let stats;
    try {
      stats = fs.lstatSync(full);
    } catch (err) {
      // Best-effort: entries that disappear between readdir and stat
      stats = null;
    }
    return { name, path: full, stats };
  }).filter((e) => e.stats !== null);

  entries.sort((a, b) => {
    if (opts.sortBySize) {
      return b.stats.size - a.stats.size;
    }
    if (opts.sortByTime) {
      return b.stats.mtimeMs - a.stats.mtimeMs;
    }
    return a.name.localeCompare(b.name);
  });

  if (opts.reverse) {
    entries.reverse();
  }

  return entries;
}

// Column layouts computed per-directory so output aligns within each listing.
function printEntries(entries, opts) {
  if (opts.long) {
    printLong(entries, opts);
  } else if ((opts.one || !process.stdout.isTTY)) {
    for (const e of entries) {
      process.stdout.write(`${e.name}\n`);
    }
  } else {
    printColumns(entries);
  }
}

function printLong(entries, opts) {
  const columns = entries.map((e) => {
    const s = e.stats;
    const size = opts.humanReadable ? humanSize(s.size) : String(s.size);
    return {
      display: opts.humanReadable ? humanSize(s.size) : null,
      size,
      fields: [
        modeString(s),
        String(s.nlink),
        s.uid === undefined ? '0' : String(s.uid),
        String(s.gid),
        size,
        formatTime(s.mtimeMs),
        e.name,
      ],
    };
  });

  const widths = [11, 0, 0, 0, 0, 12].map(() => 1);
  for (const c of columns) {
    for (let i = 0; i < 6; i++) {
      widths[i] = Math.max(widths[i], c.fields[i].length);
    }
  }

  const totalBlocks = entries.reduce((sum, e) => sum + e.stats.blocks, 0);

  let out = '';
  for (const c of columns) {
    out += c.fields[0].padEnd(widths[0] + 1);
    out += c.fields[1].padStart(widths[1] + 1);
    out += c.fields[2].padStart(widths[2] + 1);
    out += c.fields[3].padStart(widths[3] + 1);
    out += c.fields[4].padStart(widths[4] + 1);
    out += c.fields[5].padStart(widths[5] + 1);
    out += ` ${c.fields[6]}\n`;
  }
  process.stdout.write(out);
}

function printColumns(entries) {
  const maxLen = Math.max(0, ...entries.map((e) => e.name.length));
  const width = maxLen + 2;
  const cols = Math.max(1, Math.floor((process.stdout.columns || 80) / width));
  const rows = Math.ceil(entries.length / cols);

  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const idx = c * rows + r;
      if (idx < entries.length) {
        line += entries[idx].name.padEnd(width);
      }
    }
    process.stdout.write(`${line.trimEnd()}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2));

  let dirs = opts.dirs.length ? opts.dirs : ['.'];
  dirs = dirs.filter(Boolean);

  const onlySingle = dirs.length === 1;

  const topLevel = dirs;
  const results = [];
  const seen = new Set();

  const walk = (target, isTop) => {
    let entries;
    try {
      entries = readEntries(target, opts);
    } catch (err) {
      process.stderr.write(`ls.js: cannot access '${target}': ${err.message}\n`);
      process.exitCode = 2;
      return;
    }

    results.push({ dir: target, entries, header: !isTop });

    if (opts.recursive) {
      const subdirs = entries.filter((e) => e.stats.isDirectory());
      for (const sub of subdirs) {
        const real = fs.realpathSync(sub.path);
        if (seen.has(real)) {
          continue; // avoid symlink/cycle infinite recursion
        }
        seen.add(real);
        walk(sub.path, false);
      }
    }
  };

  for (const d of topLevel) {
    walk(d, true);
  }

  results.forEach((r, idx) => {
    if (idx > 0) {
      process.stdout.write('\n');
    }
    if (r.header) {
      process.stdout.write(`${r.dir}:\n`);
    }
    printEntries(r.entries, opts);
  });
}

main();
