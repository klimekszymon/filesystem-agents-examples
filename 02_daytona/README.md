# Stage 4: Daytona Cloud Sandbox

Agent runs in an isolated Daytona cloud sandbox - full Linux environment with shell, git, and file operations.

## Prerequisites

1. Get a Daytona API key from [app.daytona.io](https://app.daytona.io/dashboard/keys)

## Setup

```bash
cd stage4
bun install
```

## Usage

```bash
export OPENAI_API_KEY=your-openai-key
export DAYTONA_API_KEY=your-daytona-key
bun start
```

## Features

- **Isolated sandbox** - each session creates a fresh Linux environment
- **Full shell access** - `ls`, `cat`, `grep`, `git`, etc.
- **File operations** - read, write, delete files in sandbox
- **Git operations** - clone repositories directly
- **Auto-cleanup** - sandbox destroyed on exit

## Architecture

```
agent.js
    │
    └── Daytona SDK
            │
            └── Cloud Sandbox (Linux)
                  ├── fs_read / fs_write / fs_delete
                  ├── shell (full Linux commands)
                  └── git_clone
```

## Tools

| Tool | Description |
|------|-------------|
| `fs_read` | Read file or list directory |
| `fs_write` | Write content to file |
| `fs_delete` | Delete file |
| `shell` | Execute shell command |
| `git_clone` | Clone git repository |

## Benefits over Stage 2/3

- Runs in cloud (not local machine)
- Full Linux environment
- No local dependencies or setup
- Isolated security
- Works on any OS (macOS, Windows, Linux)
