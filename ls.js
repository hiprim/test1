#!/usr/bin/env node
/**
 * A Node.js implementation of `ls`.
 *
 * Usage:
 *   node ls.js [options] [path ...]
 *
 * Options:
 *   -a, --all       Do not ignore entries starting with `.`
 *   -l, --long      Use a long listing format
 *   -h, --human     With -l, print sizes in a human-readable form
 *   -R, --recursive List subdirectories recursively
 *   -1              One entry per line (default when output is a pipe)
 *   --help          Show this help message
 */

'use strict';

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`Usage: node ls.js [options] [path ...]

Options:
  -a, --all       Do not ignore entries starting with '.'
  -l, --long      Use a long listing format
  -h, --human     With -l, print sizes in a human-readable form
  -R, --recursive List subdirectories recursively
  -1              One entry per line
  --help          Show this help message
`);
}

function parseArgs(argv) {
  const opts = {
    all: false,
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
      const name = arg.slice(2);
      if (name === 'all') opts.all = true;
      else if (name === 'long') opts.long = true;
      else if (name === 'human') opts.human = true;
      else if (name === 'recursive') opts.recursive = true;
      else if (name === 'help') {
        usage();
        process.exit(0);
      } else {
        console.error(`ls: unrecognized option '${arg}'`);
        usage();
        process.exit(2);
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (const ch of arg.slice(1)) {
        if (ch === 'a') opts.all = true;
        else if (ch === 'l') opts.long = true;
        else if (ch === 'h') opts.human = true;
        else if (ch === 'R') opts.recursive = true;
        else if (ch === '1') opts.onePerLine = true;
        else {
          console.error(`ls: invalid option -- '${ch}'`);
          usage();
          process.exit(2);
        }
      }
    } else {
      opts.paths.push(arg);
    }
  }

  if (opts.paths.length === 0) opts.paths.push('.');
  return opts;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes}`;
  const units = ['K', 'M', 'G', 'T', 'P'];
  let value = bytes;
  let unit = '';
  for (let i = 0; i < units.length; i++) {
    value /= 1024;
    unit = units[i];
    if (value < 1024 || i === units.length - 1) break;
  }
  return `${value.toFixed(1).replace(/\.0$/, '')}${unit}`;
}

function modeString(mode, isDir) {
  const type = isDir ? 'd' : '-';
  const bits = [
    (mode & 0o400) ? 'r' : '-',
    (mode & 0o200) ? 'w' : '-',
    (mode & 0o100) ? 'x' : '-',
    (mode & 0o040) ? 'r' : '-',
    (mode & 0o020) ? 'w' : '-',
    (mode & 0o010) ? 'x' : '-',
    (mode & 0o004) ? 'r' : '-',
    (mode & 0o002) ? 'w' : '-',
    (mode & 0o001) ? 'x' : '-',
  ];
  return type + bits.join('');
}

function formatTime(mtime) {
  const date = new Date(mtime);
  const pad = (n) => String(n).padStart(2, '0');
  const now = Date.now();
  const sixMonths = 180 * 24 * 60 * 60 * 1000;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
    'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  if (Math.abs(now - mtime) > sixMonths) {
    return `${month} ${pad(date.getDate())}  ${date.getFullYear()}`;
  }
  return `${month} ${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function listDir(dirPath, opts, topLevel) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch (err) {
    console.error(`ls: cannot open directory '${dirPath}': ${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (!opts.all) {
    entries = entries.filter((e) => !e.startsWith('.'));
  }
  entries.sort((a, b) => a.localeCompare(b));

  if (opts.long) {
    const items = [];
    let totalBlocks = 0;
    for (const entry of entries) {
      const full = path.join(dirPath, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch (err) {
        console.error(`ls: cannot access '${full}': ${err.message}`);
        continue;
      }
      totalBlocks += stat.blocks;
      items.push({ entry, stat });
    }

    console.log(`total ${totalBlocks}`);
    for (const { entry, stat } of items) {
      const size = opts.human ? humanSize(stat.size) : String(stat.size);
      const line = [
        modeString(stat.mode, stat.isDirectory()),
        String(stat.nlink).padStart(3),
        String(stat.uid).padStart(8),
        String(stat.gid).padStart(8),
        size.padStart(8),
        formatTime(stat.mtimeMs),
        ' ',
        entry,
      ].join(' ');
      console.log(line);
    }
  } else if (opts.onePerLine) {
    for (const entry of entries) console.log(entry);
  } else {
    // Column output
    const maxLen = entries.reduce((m, e) => Math.max(m, e.length), 0);
    const width = maxLen + 2;
    const cols = Math.max(1, Math.floor(process.stdout.columns / width));
    for (let i = 0; i < entries.length; i++) {
      process.stdout.write(entries[i].padEnd(width));
      if ((i + 1) % cols === 0 || i === entries.length - 1) {
        process.stdout.write('\n');
      }
    }
  }

  if (opts.recursive) {
    for (const entry of entries) {
      const full = path.join(dirPath, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory() && entry !== '.' && entry !== '..') {
        console.log(`\n${full}:`);
        listDir(full, opts, false);
      }
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const hasMultiple = opts.paths.length > 1;

  for (let i = 0; i < opts.paths.length; i++) {
    const p = opts.paths[i];
    let stat;
    try {
      stat = fs.statSync(p);
    } catch (err) {
      console.error(`ls: cannot access '${p}': No such file or directory`);
      process.exitCode = 1;
      continue;
    }

    if (hasMultiple) {
      if (i > 0) console.log('');
      console.log(`${p}:`);
    }

    if (stat.isDirectory()) {
      listDir(p, opts, true);
    } else {
      if (opts.long) {
        const size = opts.human ? humanSize(stat.size) : String(stat.size);
        console.log([
          modeString(stat.mode, false),
          String(stat.nlink).padStart(3),
          String(stat.uid).padStart(8),
          String(stat.gid).padStart(8),
          size.padStart(8),
          formatTime(stat.mtimeMs),
          ' ',
          p,
        ].join(' '));
      } else {
        console.log(p);
      }
    }
  }
}

main();
