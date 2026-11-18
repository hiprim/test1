# test1

## nodejs-ls

A Node.js implementation of `ls`, written with no external dependencies (Node >= 12).

### Usage

```bash
node ls.js [OPTION]... [FILE]...
# or, after chmod +x:
./ls.js [OPTION]... [FILE]...
```

### Options

| Option | Description |
| ------ | ----------- |
| `-a`, `--all` | do not ignore entries starting with `.` |
| `-A`, `--almost-all` | do not list implied `.` and `..` |
| `-l` | use a long listing format |
| `-1` | list one file per line |
| `-R`, `--recursive` | list subdirectories recursively |
| `-r`, `--reverse` | reverse order while sorting |
| `-S` | sort by file size, largest first |
| `-t` | sort by modification time, newest first |
| `-h`, `--human-readable` | with `-l`, print sizes in human readable format (e.g. `9.3K`) |
| `--help` | print help and exit |
| `--version` | print version and exit |

Multiple paths may be passed; each is printed with a `dir:` header when more than
one (or when `-R` is used). Column output is used when stdout is a terminal;
otherwise one entry per line (like `ls -1`) is emitted.
