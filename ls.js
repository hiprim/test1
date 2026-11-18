#!/usr/bin/env node
/**
 * A Node.js implementation of `ls`.
 *
 * Usage:
 *   node ls.js [options] [path ...]
 *
 * Options:
 *   -a, --all             Do not ignore entries starting with `.`
 *   -A, --almost-all     Like -a but do not list `.` and `..`
 *   -l, --long           Use a long listing format
 *   -h, --human-readable With -l, print sizes in a human-readable form
 *   -R, --recursive      List subdirectories recursively
 *   -1                   One entry per line
 *   --help               Show this help message
 */

'use strict';

const fs = require('fs');
const path = require('path');

function usage() {
  process.stdout.write(`Usage: node ls.js [options] [path ...]

Options:
  -a, --all             Do not ignore entries starting with '.'
  -A, --almost-all     Like -a but do not list implicit . and ..
  -l, --long           Use a long listing format
  -h, --human-readable With -l, print sizes in a human-readable form
  -R, --recursive      List subdirectories recursively
  -1                   One entry per line
  --help               Show this help message
`);
}

function parseArgs(argv) {
  const opts = {
    all: false,
    almostAll: false,
    long: false,
    human: false,
    recursive: false,
    onePerLine: false,
    paths: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      opts.paths.push(...argv.slice(i + 1));
      break;
    } else if (arg.startsWith('--')) {
      switch (arg) {
        case '--all':
          opts.all = true;
          break;
        case '--almost-all':
          opts.almostAll = true;
          break;
        case '--long':
          opts.long = true;
          break;
        case '--human-readable':
          opts.human = true;
          break;
        case '--recursive':
          opts.recursive = true;
          break;
        case '--help':
          usage();
          process.exit(0);
          break;
        default:
          process.stderr.write(`ls: unrecognized option '${arg}'\n`);
          usage();
          process.exit(2);
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
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
          case 'h':
            opts.human = true;
            break;
          case 'R':
            opts.recursive = true;
            break;
          case '1':
            opts.onePerLine = true;
            break;
          default:
            process.stderr.write(`ls: invalid option -- '${ch}'\n`);
            usage();
            process.exit(2);
        }
      }
    } else {
      opts.paths.push(arg);
    }
  }

  if (opts.almostAll) opts.all = true;
  return opts;
}

function typeChar(stats) {
  if (stats.isDirectory()) return 'd';
  if (stats.isSymbolicLink()) return 'l';
  if (stats.isBlockDevice()) return 'b';
  if (stats.isCharacterDevice()) return 'c';
  if (stats.isFIFO()) return 'p';
  if (stats.isSocket()) return 's';
  return '-';
}

function modeString(stats) {
  const mode = stats.mode & 0o7777;
  const chars = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x'];
  const out = [typeChar(stats)];
  for (let i = 0; i < 9; i++) {
    out.push(mode & (0o400 >> i) ? chars[i] : '-');
  }
  if (mode & 0o4000) out[3] = out[3] === 'x' ? 's' : 'S';
  if (mode & 0o2000) out[6] = out[6] === 'x' ? 's' : 'S';
  if (mode & 0o1000) out[9] = out[9] === 'x' ? 't' : 'T';
  return out.join('');
}

function humanSize(bytes) {
  const units = ['B', 'K', 'M', 'G', 'T', 'P'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const rounded = value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded}${units[i]}`;
}

function formatTime(stats) {
  const d = stats.mtime;
  const now = new Date();
  const sixMonths = 182.5 * 24 * 60 * 60 * 1000;
  const parts = [
    d.toLocaleString('en-US', { month: 'short' }),
    String(d.getDate()).padStart(2, ' '),
  ];
  if (Math.abs(now - d) > sixMonths) {
    parts.push(String(d.getFullYear()).padStart(5, ' '));
  } else {
    parts.push(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  }
  return parts.join(' ');
}

function sortNames(entries) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  entries.sort((a, b) => collator.compare(a.name, b.name));
}

// Collected for the long form so columns can be aligned to their widest value.
function listDir(dir, opts) {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    if (!opts.all && dirent.name.startsWith('.')) continue;
    const full = path.join(dir, dirent.name);
    let stats;
    try {
      stats = fs.lstatSync(full);
    } catch (err) {
      process.stderr.write(`ls: cannot access '${full}': ${err.message}\n`);
      continue;
    }
    entries.push({
      name: dirent.name,
      full,
      stats,
      isDir: stats.isDirectory(),
      linkTarget: stats.isSymbolicLink() ? fs.readlinkSync(full) : null,
    });
  }

  if (opts.all && !opts.almostAll) {
    const dotEntries = [
      { name: '.', full: path.join(dir, '.'), stats: fs.lstatSync(dir), isDir: true, linkTarget: null },
      { name: '..', full: path.join(dir, '..'), stats: fs.lstatSync(path.join(dir, '..')), isDir: true, linkTarget: null },
    ];
    entries.unshift(...dotEntries);
  }

  sortNames(entries);
  return entries;
}

function printLong(entries, opts) {
  const rows = entries.map((e) => ({
    mode: modeString(e.stats),
    nlink: String(e.stats.nlink),
    size: e.stats.size,
    time: formatTime(e.stats),
    name: e.name,
  }));

  let nlinkWidth = 1;
  let sizeWidth = 1;
  for (const r of rows) {
    nlinkWidth = Math.max(nlinkWidth, r.nlink.length);
    if (!opts.human) sizeWidth = Math.max(sizeWidth, String(r.size).length);
  }

  for (const [idx, row] of rows.entries()) {
    const entry = entries[idx];
    const size = opts.human ? humanSize(row.size) : String(row.size);
    const sizeField = opts.human ? size.padStart(4, ' ') : size.padStart(sizeWidth, ' ');
    const target = entry.linkTarget ? ` -> ${entry.linkTarget}` : '';
    const line = [
      row.mode,
      row.nlink.padStart(nlinkWidth, ' '),
      row.time,
      sizeField,
      row.name,
    ].join(' ') + target;
    process.stdout.write(`${line}\n`);
  }
}

function printNames(entries) {
  for (const e of entries) process.stdout.write(`${e.name}\n`);
}

function shouldPrintHeader(paths, opts) {
  return paths.length > 1 || opts.recursive;
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const paths = opts.paths.length ? opts.paths : ['.'];

  const files = [];
  const dirs = [];

  for (const p of paths) {
    let stats;
    try {
      stats = fs.lstatSync(p);
    } catch (err) {
      process.stderr.write(`ls: cannot access '${p}': No such file or directory\n`);
      process.exitCode = 2;
      continue;
    }
    if (stats.isDirectory()) {
      dirs.push(p);
    } else {
      files.push({ name: p, full: p, stats, isDir: false, linkTarget: null });
    }
  }

  // Plain files are listed first, with no header.
  if (files.length) {
    sortNames(files);
    if (opts.long) printLong(files, opts);
    else printNames(files);
  }

  // Directories follow; a header is shown when listing more than one target.
  const header = shouldPrintHeader(paths, opts);
  const listedDirs = opts.recursive
    ? walkDirs(dirs, opts)
    : dirs.map((d) => ({ dir: d, entries: listDir(d, opts) }));

  for (const item of listedDirs) {
    if (header || files.length) {
      process.stdout.write(`\n${item.dir}:\n`);
    }
    if (opts.long) printLong(item.entries, opts);
    else printNames(item.entries);
  }
}

function walkDirs(dirs, opts) {
  const result = [];
  const seen = new Set();
  const visit = (dir) => {
    const real = fs.realpathSync(dir);
    if (seen.has(real)) return;
    seen.add(real);
    result.push({ dir, entries: listDir(dir, opts) });
    for (const e of result[result.length - 1].entries) {
      if (e.isDir && e.name !== '.' && e.name !== '..') {
        visit(e.full);
      }
    }
  };
  for (const d of dirs) visit(d);
  return result;
}

run();
