# Claude Theme Builder

A single-file, dependency-free tool to build a Claude Code custom theme visually.

## Use

Open `index.html` in any browser (double-click it). Then:

- Adjust colors on the left — pickers for all **57** themeable Claude Code keys,
  grouped by surface (Text & Input, Brand & Spinner, Modes & Status, Messages,
  Diffs, Backgrounds, Rate limit, Subagent colors).
- Watch the **fake Claude Code CLI** on the right repaint live. Hover any surface
  to see which key(s) it uses.
- **Load preset…** to start from one of the 11 bundled themes (dracula, nord,
  tokyo-night, catppuccin, gruvbox, everforest, rose-pine, solarized, one-dark),
  then remix.
- Pick a **base** (`dark-ansi` default, plus `light-ansi`, `dark`, `light`).
  Any key you don't override inherits from the base.
- The **⟲** button on a row resets that key back to the base value.
- Click **Copy JSON** to copy the finished theme to your clipboard. **JSON**
  toggles a live preview of the output.

## Output

`{ "name", "base", "overrides" }` — the exact shape Claude Code theme files use,
with uppercase `#RRGGBB` hex. Paste it into `~/.claude/themes/<name>.json` (or a
dotfiles `claude/themes/` directory) and select it with `/theme`.

## Notes

Runs entirely offline from `file://` — no build, no install, no network. The
top-right shows a self-check count (all green = healthy). The key list and base
palettes were extracted from the Claude Code binary.
