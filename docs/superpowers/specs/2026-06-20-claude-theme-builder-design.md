# Claude Theme Builder — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)

## Overview

A single-file static web app that lets you visually build a Claude Code custom
theme. You adjust colors via pickers grouped by UI surface, see a live "fake
Claude Code CLI" preview repaint instantly, and click **Export** to copy the
finished theme JSON to the clipboard. No backend, no build step, no
dependencies — open `index.html` in a browser.

## Goals

- A color picker + hex field for **every** themeable Claude Code key (~58 keys,
  the union of the binary's theme schema and the existing dotfiles theme files).
- A comprehensive ("kitchen-sink") live preview that exercises every key, so the
  effect of each adjustment is visible.
- Preload all 11 existing dotfiles themes as presets to load and remix.
- One-click **Copy JSON** producing output in the exact `{ name, base,
  overrides }` shape the existing theme files use (uppercase hex, 2-space
  indent).

## Non-Goals (YAGNI)

- No backend, persistence, or auto-install into `~/.claude/themes`.
- No framework / bundler / package manager — pure HTML/CSS/JS in one file.
- No WCAG contrast checker (possible future nicety, explicitly excluded now).
- Not pixel-perfect with the real CLI — a faithful *approximation* of layout.

## Architecture

Everything lives in `index.html`. Because the file is opened via `file://`,
fetching external JSON is unreliable (CORS), so **all data is embedded inline**
as JS objects:

1. **Schema** (`SCHEMA`): ordered list of groups, each with keys. Every key
   entry is `{ key, label, hint }`. Controls are generated from this — no
   hand-written rows. This is the single source of truth for "what's adjustable".
2. **Bases** (`BASES`): concrete fallback palettes for `dark`, `light`,
   `dark-ansi`, `light-ansi`. The hex `dark`/`light` palettes come from the
   binary; the two `*-ansi` bases resolve their `ansi:<name>` values through a
   standard 16-color hex table (`ANSI_HEX`) so the preview is deterministic.
3. **Presets** (`PRESETS`): the 11 dotfiles themes (dracula, nord, tokyo-night,
   catppuccin-latte/mocha, everforest, gruvbox-dark, one-dark, rose-pine,
   solarized-dark/light) embedded verbatim as `{ name, base, overrides }`.

### State

A single object:

```js
state = { name: "my-theme", base: "dark-ansi", overrides: { /* key: "#RRGGBB" */ } }
```

- Loading a preset replaces `state` with a deep copy of that preset.
- Editing a key writes `overrides[key]`. "Reset to base" deletes it.

### Rendering — CSS variables drive the preview

For each key the app sets a CSS custom property `--ck-<key>` on the preview
root. Preview mock elements reference these vars in their styles (e.g.
`border-color: var(--ck-promptBorder)`). Changing a picker updates the variable
and the on-screen swatch — the preview repaints with no diffing logic.

### Color resolution

`effective(key) = overrides[key] ?? BASES[state.base][key] ?? ANSI fallback`.
Pickers and swatches always display the **effective** value; the picker's
native `<input type=color>` requires `#RRGGBB`, so effective values are
normalized to hex for display. A key is "overridden" (shown with an active
reset button) only when present in `state.overrides`.

## Layout

Three regions in a responsive two-column shell (controls left, preview right;
stacks on narrow widths):

- **Top bar:** theme **name** input · **base** selector (4 bases) · **Load
  preset ▾** (11) · **Copy JSON** button · toast area.
- **Left — adjusters:** ~8 collapsible groups (below). Each row: live swatch +
  `<input type=color>` + hex text input (typing a valid `#RGB`/`#RRGGBB`
  updates the swatch) + reset-to-base. A filter box at the top filters rows by
  key/label substring.
- **Right — kitchen-sink preview:** styled terminal panel (see Preview Map).
  Hovering a preview surface outlines it and shows which key(s) it uses.
- **Bottom (collapsible):** live JSON pane mirroring `state`, updating on edit.

## Adjuster Groups (schema)

Generated from `SCHEMA`. Grouping (keys may be re-bucketed during build for
clarity, but all ~58 must appear exactly once):

1. **Text & Input** — text, inverseText, inactive, inactiveShimmer, subtle,
   suggestion, promptBorder, promptBorderShimmer, selectionBg
2. **Brand & Spinner** — claude, claudeShimmer, claudeBlue_FOR_SYSTEM_SPINNER,
   claudeBlueShimmer_FOR_SYSTEM_SPINNER, background, clawd_body, clawd_background
3. **Modes & Status** — planMode, ide, permission, permissionShimmer,
   autoAccept, autoAcceptShimmer, merged, remember, skill, effortUltra,
   fastMode, fastModeShimmer, professionalBlue, chromeYellow
4. **Feedback** — success, error, warning, warningShimmer
5. **Messages** — briefLabelYou, briefLabelClaude, userMessageBackground,
   userMessageBackgroundHover
6. **Diffs** — diffAdded, diffRemoved, diffAddedDimmed, diffRemovedDimmed,
   diffAddedWord, diffRemovedWord
7. **Backgrounds** — bashBorder, bashMessageBackgroundColor, memoryBackgroundColor
8. **Rate limit** — rate_limit_fill, rate_limit_empty
9. **Subagent colors** — red/blue/green/yellow/purple/orange/pink/cyan
   `_FOR_SUBAGENTS_ONLY`

## Preview Map (surface → keys exercised)

| Preview surface | Keys |
|---|---|
| Brand header + spinner + clawd mascot | claude, claudeShimmer, claudeBlue_FOR_SYSTEM_SPINNER, claudeBlueShimmer_FOR_SYSTEM_SPINNER, background, clawd_body, clawd_background |
| Claude message / You message | briefLabelClaude, briefLabelYou, text, userMessageBackground, userMessageBackgroundHover |
| Diff hunk | diffAdded, diffRemoved, diffAddedDimmed, diffRemovedDimmed, diffAddedWord, diffRemovedWord |
| `/`-autocomplete menu | suggestion, subtle, selectionBg, inactive |
| Prompt input box | promptBorder, promptBorderShimmer, text, inactive, inactiveShimmer, inverseText |
| Bash mode line | bashBorder, bashMessageBackgroundColor |
| Plan-mode banner | planMode |
| Permission dialog | permission, permissionShimmer, merged, autoAccept, autoAcceptShimmer |
| IDE indicator + session/subagent box | ide, all 8 `*_FOR_SUBAGENTS_ONLY` (as labeled chips) |
| Memory box | memoryBackgroundColor, remember |
| Rate-limit bar | rate_limit_fill, rate_limit_empty |
| Mode/status chips | fastMode, fastModeShimmer, effortUltra, skill, professionalBlue, chromeYellow, success, error, warning, warningShimmer |

A build-time self-check asserts every `SCHEMA` key is referenced by at least one
preview element (so nothing is adjustable-but-invisible).

## Export

**Copy JSON** serializes `{ name, base, overrides }` with `JSON.stringify(…, 2)`,
hex normalized to uppercase, and writes it via `navigator.clipboard.writeText`
(with a `document.execCommand('copy')` fallback for `file://`). A toast confirms.
The live JSON pane shows the same content continuously. Output is drop-in for
`claude/themes/<name>.json`.

## File Structure

```
claude-theme-builder/
  index.html        # markup + CSS + JS + embedded SCHEMA/BASES/PRESETS
  README.md         # what it is, how to open, how to use the export
  docs/superpowers/specs/2026-06-20-claude-theme-builder-design.md
```

## Acceptance Criteria

1. Opening `index.html` (via `file://`) renders the builder with no console
   errors and no network requests.
2. Every schema key (~58) has a working picker + hex field + reset; the filter
   box narrows the list.
3. Editing any control repaints the corresponding preview surface live.
4. Loading each of the 11 presets updates name, base, all pickers, and preview.
5. **Copy JSON** places valid JSON on the clipboard that `JSON.parse`s and has
   the `{ name, base, overrides }` shape with uppercase-hex values; loading a
   preset then exporting reproduces that preset's palette.
6. Build-time self-check passes: every schema key is shown in the preview.

## Testing

Manual smoke test against the acceptance criteria (it's a static UI). The
in-page self-check (criterion 6) runs on load and logs pass/fail; a tiny
assertion block verifies `effective()` resolution and hex normalization for a
couple of sample keys.
