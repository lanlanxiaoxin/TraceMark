# TraceMark v0.2.0 Release Notes

**Release date:** May 2026 (W8)  
**Focus:** Personal daily/weekly report assistant + work-context recall for developers (MIT)

## Highlights

- **Today seal flow:** ~5 minutes, three steps, mainline + auto daily report (template / BYOK AI)
- **Weekly battle report + memory capsule:** From confirmed assets; export 1080×1920 share image
- **Ctrl+K recall:** FTS over work assets and raw activity, `@last-week` filters, jump to timeline highlight
- **UI internationalization (zh/en):** **Settings → Language** — Simplified Chinese / English; UI, notifications, tray, and dialogs follow the choice
- **Bilingual report & retrospective generation:** Daily, weekly, battle, weekly retro, and phase retro use locale-specific prompts; AI output normalizes broken Markdown (e.g. `-*` list markers)
- **First-run onboarding:** Project space → capture & privacy → quick tips
- **Local metrics dashboard:** Settings → Advanced (on-device only)

## Install

- **Windows:** [GitHub Releases](https://github.com/lanlanxiaoxin/TraceMark/releases/tag/v0.2.0) or build with `npm run package`
- **Dev:** `npm install` → `npm run dev`

## Upgrade

- Database migrates automatically
- Onboarding on first install; rerun via **Settings → Rerun onboarding**

## Known limitations

- Activity capture is **Windows-first**; macOS / Linux are reserved
- Recall quality depends on confirmed assets and activity; complete seal + confirm assets for best results

## Internationalization

### Switch language

1. Open **Settings → Language**
2. Choose **简体中文** or **English**
3. Takes effect immediately; stored locally as `settings.ui_locale`

If unset: defaults to English when the browser/system locale starts with `en`, otherwise Chinese.

### Coverage

| Area | Notes |
|------|--------|
| UI copy | Today, Projects, Timeline, Reports, Settings, command palette, upload preview, etc. |
| Main process | Daily/Friday notifications, tray menu, folder picker, export dialogs |
| AI reports | Daily (incl. seal v3), weekly, battle report — locale prompts + system instructions |
| AI retrospectives | Weekly + project phase — bilingual prompts; preview matches Reports page |
| Offline retro | Five-section template follows UI language when API is unavailable |

### Tips

- With **English UI**, source context (asset titles, activity summaries) may still be Chinese; AI translates output to English — existing Chinese asset titles are not rewritten automatically
- **Offline** reports/retros use local templates in the chosen language; long auto-generated activity titles may still appear — prefer short titles when confirming assets in Today
- Installer (NSIS) language is separate from **in-app** language; use Settings for UI locale

## Feedback

- [GitHub Issues](https://github.com/lanlanxiaoxin/TraceMark/issues)
- [GitHub Discussions](https://github.com/lanlanxiaoxin/TraceMark/discussions)
- Beta trial: open an Issue tagged `beta-trial`, commit to feedback within 2 weeks

[中文版发布说明](RELEASE_NOTES_v0.2.0.md)
