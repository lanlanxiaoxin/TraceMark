# TraceMark

**English** | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

TraceMark is a **daily/weekly report co-pilot + context recall tool** for developers (personal work-asset ledger, MIT). It captures foreground activity and Git signals locally, turns them into **confirmable work assets** via **Today Seal**, and generates daily reports, **weekly battle summaries**, and shareable **Weekly Memory Capsule** PNGs. **Ctrl+K** searches past assets and raw activity, then jumps to the timeline with highlight.

> **Not** employee monitoring, team timesheets, or full-desktop recording. Data stays local by default; you choose what to confirm and whether cloud AI is used.

![Today seal to daily report](docs/assets/showTraceMark.gif)

**Repository:** https://github.com/lanlanxiaoxin/TraceMark

---

## Who it is for

| Primary | Also works for |
|---------|----------------|
| Software engineers | Implementation consultants |
| Product managers | General knowledge workers |

---

## 60-second path

1. `npm run dev`, enable process monitoring in **Settings** (Windows).
2. Complete **Today Seal** on the **Today** tab (3 steps).
3. **Reports** → generate a **daily report**; get a **weekly battle** nudge on Fridays.
4. **Ctrl+K** → e.g. `auth @last-week` → open timeline at the right segment.
5. **Reports → Weekly** → **Export Weekly Memory Capsule** (1080×1920 PNG).

See [docs/demo/RECORDING.md](docs/demo/RECORDING.md) for the demo GIF checklist.

## What it does

```text
Activity capture → sanitize → project spaces
  → suggested assets + Today Seal
  → confirmed library
  → daily report / weekly battle / memory capsule PNG
  → Ctrl+K recall → timeline highlight
```

### Main navigation

| Tab | Purpose |
|-----|---------|
| **Today** | Today Seal + asset inbox |
| **Projects** | Spaces, library, retrospectives |
| **Timeline** | Raw activity by day + recall jump |
| **Reports** | Daily, weekly battle, memory capsule export |
| **Settings** | Tracking, privacy, AI, local metrics |

### Work-asset card types

| Type | Meaning |
|------|---------|
| **Outcome** | Clear deliverable or result |
| **Process** | Important work not yet a deliverable |
| **Evidence** | Supporting material; not a standalone outcome |

Unconfirmed cards do not feed default retrospectives. Low-confidence cards are marked for your review.

---

## Privacy & trust

- **Local-first:** Activity and assets are stored in SQLite under your OS user data directory.
- **You confirm truth:** Auto-generated suggestions are not treated as final facts until you confirm them.
- **Tiered consent (L0–L3):** Basic local capture vs. cloud structured data vs. enhanced summaries vs. per-project directory access—each with explicit boundaries.
- **Optional cloud AI:** Requires your API key and consent; upload preview shows what would leave the device.
- **We do not:** Team admin dashboards, default screen/audio recording, full-disk document indexing, or uploading raw window titles / full local paths.

---

## Platform support

| Platform | Status |
|----------|--------|
| **Windows** | Primary—foreground window capture via Win32 |
| **macOS / Linux** | Activity provider scaffolding (PoC / partial) |

Prebuilt installers will be published on [GitHub Releases](https://github.com/lanlanxiaoxin/TraceMark/releases) when available. Until then, build from source (below).

---

## Tech stack

- **Desktop:** Electron 30 (main + renderer)
- **UI:** React 18, TypeScript, Tailwind CSS 4
- **Storage:** better-sqlite3 (local SQLite)
- **Build:** electron-vite, electron-builder

---

## Getting started

### Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **npm** 9+
- **Windows** for full activity capture (other OS: dev UI only / limited capture)
- **Git** (optional, for Git enrichment)

### Install & run (development)

```bash
git clone https://github.com/lanlanxiaoxin/TraceMark.git
cd TraceMark
npm install
npm run dev
```

### Verify

```bash
npm run typecheck
npm run test
```

### Production build

```bash
npm run build
```

### Windows installer (local)

```bash
npm run package
```

Output directory: `release/` (ignored by git; do not commit binaries).

---

## Optional cloud AI

In **Settings**, you can configure a compatible OpenAI-style API (`base_url`, `model`, `api_key`) for asset suggestions and retrospectives. Offline mode works without AI; candidate cards may be simpler.

Never commit `.env` or API keys. Keys are stored only in your local app database.

---

## Project layout

```text
electron/          Main process: capture, DB, IPC, AI gateway, generators
src/               Renderer: pages & components (Today, Projects, …)
prompts/           Prompt templates for reports & retrospectives
build/             electron-builder & installer config
scripts/           dev, test, packaging helpers
```

Contributor-oriented notes: [CLAUDE.md](CLAUDE.md).

---

## Feedback & beta (v0.2.0)

- [Release notes (EN)](docs/RELEASE_NOTES_v0.2.0.en.md) · [中文版](docs/RELEASE_NOTES_v0.2.0.md) · [Feedback guide](docs/FEEDBACK.md)
- [GitHub Issues](https://github.com/lanlanxiaoxin/TraceMark/issues) · [Discussions](https://github.com/lanlanxiaoxin/TraceMark/discussions)

Looking for **5 developers** to try TraceMark for 2 weeks — open an Issue with `[beta-trial]` in the title.

## Contributing

Issues and pull requests are welcome on GitHub.

1. Fork the repo and create a branch (`feature/…` or `fix/…`).
2. Keep changes focused; run `npm run typecheck` and `npm run test`.
3. Use commit messages like `feat: …`, `fix: …`, `docs: …` (see [CLAUDE.md](CLAUDE.md)).

---

## License

[MIT](LICENSE) © lanlanxiaoxin

---

## Disclaimer

TraceMark observes foreground application activity on your computer. Use it only on machines and accounts you own or are authorized to monitor. You are responsible for complying with local laws and workplace policies.
