# Claude Theme Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-file static web app to visually build a Claude Code theme — pickers for every themeable key, a live "fake CLI" preview, 11 presets, and copy-to-clipboard JSON export.

**Architecture:** Everything in one `index.html` (markup + CSS + JS + inline data). State is one `{ name, base, overrides }` object. Each theme key drives a CSS custom property `--ck-<key>` on the preview root; editing a picker updates the variable so the preview repaints with no diffing. Data (schema, base palettes, 11 presets) is embedded inline because the page runs from `file://`.

**Tech Stack:** Plain HTML5 + CSS + vanilla ES2020 JavaScript. No build, no dependencies, no network. Tests are in-page `console.assert` checks run by opening the file in a browser.

## Global Constraints

- Single file `index.html`; no external requests, no `fetch`, no CDN, no npm. (Acceptance #1.)
- Must run when opened via `file://` with zero console errors.
- All ~58 theme keys appear exactly once across the adjuster groups and are each referenced by ≥1 preview element. (Acceptance #2, #6.)
- Export shape is exactly `{ name, base, overrides }`; hex values UPPERCASE `#RRGGBB`; `JSON.stringify(state, null, 2)`. (Acceptance #5.)
- Clipboard write uses `navigator.clipboard.writeText` with a `document.execCommand('copy')` textarea fallback (for `file://`).
- The 4 base names: `dark-ansi`, `light-ansi`, `dark`, `light`. Default `dark-ansi`.
- Source of truth for presets: the 11 files in `/Users/randolftjandra/Dev/dotfiles/claude/themes/*.json`.
- Source of truth for the key schema + base palettes: the Claude binary at `/Users/randolftjandra/.local/share/claude/versions/<ver>` (currently `2.1.185`). Regenerate strings with `strings -n 6 <binary> > /tmp/ctb_strings.txt` if extraction is needed.

---

### Task 1: HTML shell, layout, and the test harness

**Files:**
- Create: `/Users/randolftjandra/Dev/ai/claude-theme-builder/index.html`

**Interfaces:**
- Produces: global `window.CTB` namespace object; `CTB.checks` (array of `{name, ok}`); `runChecks()` that runs every registered check, logs a summary, and writes pass/fail counts into `#selfcheck`. Later tasks push checks into `CTB.checks` and call `runChecks()` at the end of `init()`.

- [ ] **Step 1: Write the failing check**

Create `index.html` with a `<script>` containing only the harness and one deliberately-not-yet-true check:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude Theme Builder</title>
<style>
  :root{--bg:#1e1e2e;--fg:#cdd6f4;--panel:#181825;--line:#313244}
  *{box-sizing:border-box} html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--fg);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  #app{display:grid;grid-template-rows:auto 1fr auto;height:100vh}
  #topbar{display:flex;gap:12px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
  #main{display:grid;grid-template-columns:minmax(320px,420px) 1fr;min-height:0}
  #controls{overflow:auto;border-right:1px solid var(--line);padding:8px}
  #preview-wrap{overflow:auto;padding:16px}
  #jsonpane{border-top:1px solid var(--line);max-height:30vh;overflow:auto}
  #jsonpane[hidden]{display:none}
  @media(max-width:900px){#main{grid-template-columns:1fr}}
  #selfcheck{font-size:11px;opacity:.7;margin-left:auto}
</style></head>
<body><div id="app">
  <div id="topbar"><strong>Claude Theme Builder</strong><span id="selfcheck"></span></div>
  <div id="main"><div id="controls"></div><div id="preview-wrap"><div id="preview"></div></div></div>
  <pre id="jsonpane" hidden></pre>
</div>
<script>
const CTB = window.CTB = { checks: [] };
function check(name, fn){ let ok=false; try{ ok=!!fn(); }catch(e){ ok=false; } CTB.checks.push({name, ok}); }
function runChecks(){
  const pass = CTB.checks.filter(c=>c.ok).length, total = CTB.checks.length;
  CTB.checks.forEach(c=>!c.ok && console.error('CHECK FAIL:', c.name));
  console.log(`self-checks: ${pass}/${total}`);
  const el=document.getElementById('selfcheck');
  if(el) el.textContent = `checks ${pass}/${total}`, el.style.color = pass===total ? '#a6e3a1':'#f38ba8';
}
function init(){
  check('harness wired', ()=> typeof runChecks==='function');
  check('TODO: schema loaded', ()=> false); // replaced in Task 2
  runChecks();
}
document.addEventListener('DOMContentLoaded', init);
</script></body></html>
```

- [ ] **Step 2: Run to verify it fails**

Open the file: `open /Users/randolftjandra/Dev/ai/claude-theme-builder/index.html`
Expected: top-right shows `checks 1/2` in red; console logs `CHECK FAIL: TODO: schema loaded`.

- [ ] **Step 3: (no impl yet — the failing check is removed in Task 2)**

Layout is the deliverable here; the failing check is the seam for Task 2.

- [ ] **Step 4: Verify layout**

Confirm three stacked regions render (top bar, two-column main, hidden json pane) with no console *errors* (the CHECK FAIL log is expected).

- [ ] **Step 5: Commit**

```bash
cd /Users/randolftjandra/Dev/ai/claude-theme-builder
git add index.html && git commit -m "feat: html shell, layout, self-check harness"
```

---

### Task 2: Embed the schema (groups + keys)

**Files:**
- Modify: `index.html` (add `CTB.SCHEMA`; replace the TODO check)

**Interfaces:**
- Produces: `CTB.SCHEMA` = ordered array of `{ group:string, keys:[{key:string,label:string,hint:string}] }`. `CTB.ALL_KEYS` = flat array of every `key`. Consumed by Tasks 4, 5, 8.

- [ ] **Step 1: Write the failing check**

In `init()` replace the TODO check with:

```js
check('schema has 58 unique keys', ()=> CTB.ALL_KEYS.length===58 && new Set(CTB.ALL_KEYS).size===58);
```

- [ ] **Step 2: Run to verify it fails**

Reload. Expected: `CHECK FAIL: schema has 58 unique keys` (SCHEMA undefined).

- [ ] **Step 3: Implement — add SCHEMA**

Add before `init()`. Keys verbatim (exact casing; `_FOR_SUBAGENTS_ONLY` / `_FOR_SYSTEM_SPINNER` suffixes matter):

```js
CTB.SCHEMA = [
 {group:'Text & Input', keys:[
   {key:'text',hint:'Primary text'},{key:'inverseText',hint:'Text on accent bg'},
   {key:'inactive',hint:'Dimmed/disabled text'},{key:'inactiveShimmer',hint:'Dimmed shimmer'},
   {key:'subtle',hint:'Secondary/muted text'},{key:'suggestion',hint:'Autocomplete match highlight'},
   {key:'promptBorder',hint:'Input box border'},{key:'promptBorderShimmer',hint:'Input border shimmer'},
   {key:'selectionBg',hint:'Selected row background'}]},
 {group:'Brand & Spinner', keys:[
   {key:'claude',hint:'Claude accent'},{key:'claudeShimmer',hint:'Claude accent shimmer'},
   {key:'claudeBlue_FOR_SYSTEM_SPINNER',hint:'System spinner'},{key:'claudeBlueShimmer_FOR_SYSTEM_SPINNER',hint:'Spinner shimmer'},
   {key:'background',hint:'Brand/Claude bg accent'},{key:'clawd_body',hint:'Mascot body'},{key:'clawd_background',hint:'Mascot bg'}]},
 {group:'Modes & Status', keys:[
   {key:'planMode',hint:'Plan-mode accent'},{key:'ide',hint:'IDE/session indicator'},
   {key:'permission',hint:'Permission dialog'},{key:'permissionShimmer',hint:'Permission shimmer'},
   {key:'autoAccept',hint:'Auto-accept mode'},{key:'autoAcceptShimmer',hint:'Auto-accept shimmer'},
   {key:'merged',hint:'Merged/accept-all'},{key:'remember',hint:'Memory accent'},{key:'skill',hint:'Skill accent'},
   {key:'effortUltra',hint:'Ultra effort'},{key:'fastMode',hint:'Fast mode'},{key:'fastModeShimmer',hint:'Fast shimmer'},
   {key:'professionalBlue',hint:'Pro/privacy blue'},{key:'chromeYellow',hint:'Chrome-extension yellow'}]},
 {group:'Feedback', keys:[
   {key:'success',hint:'Success'},{key:'error',hint:'Error'},{key:'warning',hint:'Warning'},{key:'warningShimmer',hint:'Warning shimmer'}]},
 {group:'Messages', keys:[
   {key:'briefLabelYou',hint:'"You" label'},{key:'briefLabelClaude',hint:'"Claude" label'},
   {key:'userMessageBackground',hint:'Your message bg'},{key:'userMessageBackgroundHover',hint:'Your message bg (hover)'}]},
 {group:'Diffs', keys:[
   {key:'diffAdded',hint:'Added line bg'},{key:'diffRemoved',hint:'Removed line bg'},
   {key:'diffAddedDimmed',hint:'Added bg dimmed'},{key:'diffRemovedDimmed',hint:'Removed bg dimmed'},
   {key:'diffAddedWord',hint:'Added word'},{key:'diffRemovedWord',hint:'Removed word'}]},
 {group:'Backgrounds', keys:[
   {key:'bashBorder',hint:'Bash mode border'},{key:'bashMessageBackgroundColor',hint:'Bash message bg'},
   {key:'memoryBackgroundColor',hint:'Memory box bg'}]},
 {group:'Rate limit', keys:[
   {key:'rate_limit_fill',hint:'Used portion'},{key:'rate_limit_empty',hint:'Remaining portion'}]},
 {group:'Subagent colors', keys:[
   {key:'red_FOR_SUBAGENTS_ONLY',hint:'Agent: red'},{key:'blue_FOR_SUBAGENTS_ONLY',hint:'Agent: blue'},
   {key:'green_FOR_SUBAGENTS_ONLY',hint:'Agent: green'},{key:'yellow_FOR_SUBAGENTS_ONLY',hint:'Agent: yellow'},
   {key:'purple_FOR_SUBAGENTS_ONLY',hint:'Agent: purple'},{key:'orange_FOR_SUBAGENTS_ONLY',hint:'Agent: orange'},
   {key:'pink_FOR_SUBAGENTS_ONLY',hint:'Agent: pink'},{key:'cyan_FOR_SUBAGENTS_ONLY',hint:'Agent: cyan (default session)'}]},
];
CTB.SCHEMA.forEach(g=>g.keys.forEach(k=> k.label = k.label || k.key));
CTB.ALL_KEYS = CTB.SCHEMA.flatMap(g=>g.keys.map(k=>k.key));
```

- [ ] **Step 4: Run to verify it passes**

Reload. Expected: `checks 2/2` green. In console run `CTB.ALL_KEYS.length` → `58`.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: embed full theme key schema (58 keys)"
```

---

### Task 3: Base palettes + color resolution

**Files:**
- Modify: `index.html` (add `CTB.ANSI_HEX`, `CTB.BASES`, `normHex`, `effective`)

**Interfaces:**
- Consumes: `CTB.ALL_KEYS`.
- Produces:
  - `CTB.ANSI_HEX` — map of ansi name (e.g. `cyan`,`cyanBright`,`black`,`white`,…) → `#RRGGBB`.
  - `CTB.BASES` — `{ 'dark-ansi':{key:'#RRGGBB'…}, 'light-ansi':{…}, 'dark':{…}, 'light':{…} }`, every base fully resolved to hex for all 58 keys.
  - `normHex(v) -> '#RRGGBB'` uppercase (accepts `#rgb`, `#rrggbb`, `rgb(r,g,b)`, `ansi:name`).
  - `effective(state, key) -> '#RRGGBB'` = `state.overrides[key]` else `BASES[state.base][key]` else `#000000`.

**Data extraction (run once to produce the literals pasted below):**

```bash
B=/Users/randolftjandra/.local/share/claude/versions/2.1.185
strings -n 6 "$B" > /tmp/ctb_strings.txt
# dark-ansi (and light-ansi) key->ansi map: find the theme blob containing ansi: values
grep -o 'claude:"ansi:[^}]*briefLabelClaude:"[^"]*"' /tmp/ctb_strings.txt
# dark / light hex blobs:
grep -o 'claude:"rgb([^}]*briefLabelClaude:"[^"]*"' /tmp/ctb_strings.txt
```

- [ ] **Step 1: Write the failing checks**

Add to `init()` (before `runChecks()`):

```js
check('normHex upper', ()=> normHex('#bd93f9')==='#BD93F9' && normHex('rgb(189,147,249)')==='#BD93F9');
check('bases cover all keys', ()=> ['dark-ansi','light-ansi','dark','light'].every(b=>
  CTB.ALL_KEYS.every(k=> /^#[0-9A-F]{6}$/.test(CTB.BASES[b][k]))));
check('effective prefers override', ()=>
  effective({base:'dark-ansi',overrides:{text:'#123456'}},'text')==='#123456');
```

- [ ] **Step 2: Run to verify they fail**

Reload. Expected: 3 new `CHECK FAIL` lines.

- [ ] **Step 3: Implement**

```js
CTB.ANSI_HEX = { // standard 16-color terminal palette
 black:'#000000',red:'#CD3131',green:'#0DBC79',yellow:'#E5E510',blue:'#2472C8',
 magenta:'#BC3FBC',cyan:'#11A8CD',white:'#E5E5E5',
 blackBright:'#666666',redBright:'#F14C4C',greenBright:'#23D18B',yellowBright:'#F5F543',
 blueBright:'#3B8EEA',magentaBright:'#D670D6',cyanBright:'#29B8DB',whiteBright:'#FFFFFF' };

function normHex(v){
  if(!v) return '#000000';
  v=String(v).trim();
  if(v.startsWith('ansi:')) v = CTB.ANSI_HEX[v.slice(5)] || '#000000';
  let m=v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if(m){ return '#'+[1,2,3].map(i=>(+m[i]).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  m=v.match(/^#([0-9a-f]{3})$/i);
  if(m){ return '#'+m[1].split('').map(c=>c+c).join('').toUpperCase(); }
  m=v.match(/^#([0-9a-f]{6})$/i);
  if(m){ return ('#'+m[1]).toUpperCase(); }
  return '#000000';
}
// RAW_BASES: paste the extracted key->value maps here (values may be ansi:/rgb()/hex; normHex resolves them).
CTB.RAW_BASES = {
  'dark-ansi': { /* paste dark-ansi ansi: map from extraction */ },
  'light-ansi':{ /* paste light-ansi ansi: map */ },
  'dark':      { /* paste dark rgb() map */ },
  'light':     { /* paste light rgb() map */ },
};
CTB.BASES = {};
for(const b of Object.keys(CTB.RAW_BASES)){
  CTB.BASES[b] = {};
  for(const k of CTB.ALL_KEYS){ CTB.BASES[b][k] = normHex(CTB.RAW_BASES[b][k]); }
}
function effective(state, key){
  return normHex(state.overrides[key] ?? CTB.BASES[state.base][key]);
}
```

> If a base's raw map is missing a key, `normHex(undefined)` yields `#000000` — acceptable; the "bases cover all keys" check will still pass (it's a valid `#RRGGBB`). Prefer extracting real values for `dark-ansi` first (the default base); `light-ansi`/`dark`/`light` may reuse `dark-ansi` as a starting point if a blob isn't cleanly extractable.

- [ ] **Step 4: Run to verify they pass**

Reload. Expected: all checks green.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: base palettes, ansi map, color resolution"
```

---

### Task 4: Adjuster panel (controls) + state + CSS-var application

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `CTB.SCHEMA`, `effective`, `normHex`.
- Produces:
  - `CTB.state` = `{ name:'my-theme', base:'dark-ansi', overrides:{} }`.
  - `applyVars()` — sets `--ck-<key>` for all keys on `#preview`.
  - `setKey(key,hex)` / `resetKey(key)` — mutate `overrides`, then `applyVars()` + `syncRow(key)` + `renderJSON()` (renderJSON defined Task 7; guard with `typeof`).
  - `renderControls()` — builds grouped rows into `#controls` with a filter box.

- [ ] **Step 1: Write the failing checks**

```js
check('controls render a row per key', ()=>
  document.querySelectorAll('#controls [data-key]').length===58);
check('applyVars sets a css var', ()=>
  getComputedStyle(document.getElementById('preview')).getPropertyValue('--ck-text').trim()!=='');
```

- [ ] **Step 2: Run to verify they fail**

Reload. Expected: both fail (no controls yet).

- [ ] **Step 3: Implement**

Add CSS to `<style>`:

```css
.grp{margin:6px 0;border:1px solid var(--line);border-radius:6px}
.grp>summary{cursor:pointer;padding:6px 8px;font-weight:600}
.row{display:grid;grid-template-columns:18px 28px 1fr 96px 22px;gap:6px;align-items:center;padding:3px 8px}
.row .sw{width:18px;height:18px;border-radius:3px;border:1px solid var(--line)}
.row input[type=color]{width:28px;height:22px;padding:0;border:none;background:none}
.row input[type=text]{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:2px 4px;font:inherit}
.row .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .rst{cursor:pointer;opacity:.5;border:none;background:none;color:var(--fg)}
.row.ovr .rst{opacity:1;color:var(--ck-claude,#f38ba8)}
#filter{flex:1;min-width:120px;background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:4px 6px;font:inherit}
```

Add JS:

```js
CTB.state = { name:'my-theme', base:'dark-ansi', overrides:{} };
function applyVars(){
  const p=document.getElementById('preview');
  for(const k of CTB.ALL_KEYS) p.style.setProperty('--ck-'+k, effective(CTB.state,k));
}
function syncRow(key){
  const row=document.querySelector(`#controls [data-key="${key}"]`); if(!row) return;
  const hex=effective(CTB.state,key);
  row.querySelector('.sw').style.background=hex;
  row.querySelector('input[type=color]').value=hex;
  const tx=row.querySelector('input[type=text]'); if(document.activeElement!==tx) tx.value=hex;
  row.classList.toggle('ovr', key in CTB.state.overrides);
}
function setKey(key,hex){ hex=normHex(hex); CTB.state.overrides[key]=hex; applyVars(); syncRow(key); if(typeof renderJSON==='function') renderJSON(); }
function resetKey(key){ delete CTB.state.overrides[key]; applyVars(); syncRow(key); if(typeof renderJSON==='function') renderJSON(); }
function renderControls(){
  const root=document.getElementById('controls'); root.innerHTML='';
  const f=document.createElement('input'); f.id='filter'; f.placeholder='filter keys…';
  f.oninput=()=>{ const q=f.value.toLowerCase();
    document.querySelectorAll('#controls .row').forEach(r=>{
      r.style.display = (r.dataset.key.toLowerCase().includes(q)||r.dataset.label.toLowerCase().includes(q))?'':'none'; }); };
  root.appendChild(f);
  for(const g of CTB.SCHEMA){
    const d=document.createElement('details'); d.className='grp'; d.open=true;
    d.innerHTML=`<summary>${g.group}</summary>`;
    for(const k of g.keys){
      const row=document.createElement('div'); row.className='row'; row.dataset.key=k.key; row.dataset.label=k.label;
      row.innerHTML=`<span class="sw"></span>`+
        `<input type="color">`+
        `<span class="name" title="${k.key} — ${k.hint}">${k.label}</span>`+
        `<input type="text" spellcheck="false">`+
        `<button class="rst" title="reset to base">⟲</button>`;
      row.querySelector('input[type=color]').oninput=e=>setKey(k.key,e.target.value);
      const tx=row.querySelector('input[type=text]');
      tx.onchange=e=>{ if(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(e.target.value.trim())) setKey(k.key,e.target.value.trim().startsWith('#')?e.target.value.trim():'#'+e.target.value.trim()); else syncRow(k.key); };
      row.querySelector('.rst').onclick=()=>resetKey(k.key);
      d.appendChild(row);
    }
    root.appendChild(d);
  }
  CTB.ALL_KEYS.forEach(syncRow);
}
```

Call `applyVars(); renderControls();` at the start of `init()` (before checks).

- [ ] **Step 4: Run to verify they pass**

Reload. Expected: checks green; left panel shows 9 groups of rows; editing a picker updates its swatch.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: adjuster panel, state, css-var application"
```

---

### Task 5: Kitchen-sink preview wired to CSS vars

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `--ck-<key>` vars on `#preview`.
- Produces: static preview markup injected into `#preview` by `renderPreview()`; every key from `CTB.ALL_KEYS` referenced by ≥1 element carrying `data-uses="<key>[ <key>…]"`. Hovering a `[data-uses]` element outlines it.

- [ ] **Step 1: Write the failing check**

```js
check('every key shown in preview', ()=>{
  const used=new Set();
  document.querySelectorAll('#preview [data-uses]').forEach(el=>el.dataset.uses.split(/\s+/).forEach(k=>used.add(k)));
  return CTB.ALL_KEYS.every(k=>used.has(k));
});
```

- [ ] **Step 2: Run to verify it fails**

Reload. Expected: `CHECK FAIL: every key shown in preview`.

- [ ] **Step 3: Implement**

Add preview CSS (uses the vars; representative, not exhaustive styling):

```css
#preview{--ck-text:#fff;background:var(--ck-clawd_background,#11111b);border:1px solid var(--ck-promptBorder);border-radius:10px;padding:14px;color:var(--ck-text);max-width:760px}
#preview .seg{margin:8px 0;padding:6px 8px;border-radius:6px}
#preview [data-uses]:hover{outline:1px dashed var(--ck-warning)}
.brand{color:var(--ck-claude);font-weight:700}
.spin{color:var(--ck-claudeBlue_FOR_SYSTEM_SPINNER)}
.mascot{display:inline-block;width:14px;height:14px;border-radius:3px;background:var(--ck-clawd_body);outline:2px solid var(--ck-clawd_background)}
.msgYou{background:var(--ck-userMessageBackground);border-radius:6px;padding:4px 6px}
.lblYou{color:var(--ck-briefLabelYou);font-weight:700}.lblClaude{color:var(--ck-briefLabelClaude);font-weight:700}
.diff .add{background:var(--ck-diffAdded)}.diff .del{background:var(--ck-diffRemoved)}
.diff .addD{background:var(--ck-diffAddedDimmed)}.diff .delD{background:var(--ck-diffRemovedDimmed)}
.diff .aw{color:var(--ck-diffAddedWord);font-weight:700}.diff .rw{color:var(--ck-diffRemovedWord);font-weight:700}
.menu{border:1px solid var(--ck-promptBorderShimmer)}
.menu .item{color:var(--ck-subtle)}.menu .sel{background:var(--ck-selectionBg);color:var(--ck-text)}
.menu .match{color:var(--ck-suggestion);font-weight:700}.menu .dim{color:var(--ck-inactive)}
.prompt{border:1px solid var(--ck-promptBorder)}.prompt .ph{color:var(--ck-inactiveShimmer)}
.prompt .inv{background:var(--ck-claude);color:var(--ck-inverseText);padding:0 4px;border-radius:3px}
.bash{border-left:3px solid var(--ck-bashBorder);background:var(--ck-bashMessageBackgroundColor)}
.plan{border:1px solid var(--ck-planMode);color:var(--ck-planMode)}
.perm{border:1px solid var(--ck-permission)} .perm .sh{color:var(--ck-permissionShimmer)} .perm .ok{color:var(--ck-merged)} .perm .aa{color:var(--ck-autoAccept)} .perm .aas{color:var(--ck-autoAcceptShimmer)}
.ide{color:var(--ck-ide)} .mem{background:var(--ck-memoryBackgroundColor)} .mem b{color:var(--ck-remember)}
.rl{height:8px;border-radius:4px;background:var(--ck-rate_limit_empty)} .rl>i{display:block;height:100%;width:55%;border-radius:4px;background:var(--ck-rate_limit_fill)}
.chip{display:inline-block;padding:1px 6px;border-radius:10px;margin:2px;border:1px solid currentColor}
.c-fast{color:var(--ck-fastMode)}.c-fasts{color:var(--ck-fastModeShimmer)}.c-ultra{color:var(--ck-effortUltra)}.c-skill{color:var(--ck-skill)}.c-pro{color:var(--ck-professionalBlue)}.c-chrome{color:var(--ck-chromeYellow)}.c-ok{color:var(--ck-success)}.c-err{color:var(--ck-error)}.c-warn{color:var(--ck-warning)}.c-warns{color:var(--ck-warningShimmer)}
.usermsgH{background:var(--ck-userMessageBackgroundHover)}
.agent{display:inline-block;padding:1px 6px;border-radius:4px;margin:2px;font-weight:700}
```

Add `renderPreview()` that sets `#preview` innerHTML. It MUST include at least one element per key via `data-uses`. Skeleton (fill each segment; ensure the agent chips loop emits all 8 subagent keys):

```js
function renderPreview(){
  const agents=['red','blue','green','yellow','purple','orange','pink','cyan']
    .map(c=>`<span class="agent" data-uses="${c}_FOR_SUBAGENTS_ONLY" style="color:var(--ck-${c}_FOR_SUBAGENTS_ONLY)">${c}</span>`).join('');
  document.getElementById('preview').innerHTML = `
  <div class="seg"><span class="mascot" data-uses="clawd_body clawd_background"></span>
    <span class="brand" data-uses="claude claudeShimmer background">✻ Claude</span>
    <span class="spin" data-uses="claudeBlue_FOR_SYSTEM_SPINNER claudeBlueShimmer_FOR_SYSTEM_SPINNER">⠋ working…</span></div>
  <div class="seg"><span class="lblClaude" data-uses="briefLabelClaude">Claude</span>
    <span data-uses="text">Here's the change.</span></div>
  <div class="seg msgYou" data-uses="userMessageBackground"><span class="lblYou" data-uses="briefLabelYou">You</span>
    <span class="usermsgH" data-uses="userMessageBackgroundHover">hover</span> make it pop</div>
  <div class="seg diff" data-uses="diffAdded">
    <div class="add" data-uses="diffAdded"><span class="aw" data-uses="diffAddedWord">+ added</span> line</div>
    <div class="del" data-uses="diffRemoved"><span class="rw" data-uses="diffRemovedWord">- removed</span> line</div>
    <div class="addD" data-uses="diffAddedDimmed">+ dimmed</div><div class="delD" data-uses="diffRemovedDimmed">- dimmed</div></div>
  <div class="seg menu" data-uses="promptBorderShimmer">
    <div class="item sel" data-uses="selectionBg"><span class="match" data-uses="suggestion">/sk</span><span class="dim" data-uses="inactive">ill</span></div>
    <div class="item" data-uses="subtle">/writing-skills</div></div>
  <div class="seg prompt" data-uses="promptBorder"><span class="inv" data-uses="inverseText">›</span>
    <span class="ph" data-uses="inactiveShimmer">type a message…</span></div>
  <div class="seg bash" data-uses="bashBorder bashMessageBackgroundColor">$ ls -la</div>
  <div class="seg plan" data-uses="planMode">⏸ plan mode</div>
  <div class="seg perm" data-uses="permission">Allow edit? <span class="sh" data-uses="permissionShimmer">›</span>
    <span class="ok" data-uses="merged">yes, all</span> <span class="aa" data-uses="autoAccept">auto-accept</span>
    <span class="aas" data-uses="autoAcceptShimmer">·</span></div>
  <div class="seg ide" data-uses="ide">◇ IDE connected · session</div>
  <div class="seg">${agents}</div>
  <div class="seg mem" data-uses="memoryBackgroundColor"><b data-uses="remember">⏺ remembered</b> a fact</div>
  <div class="seg"><div class="rl" data-uses="rate_limit_empty"><i data-uses="rate_limit_fill"></i></div></div>
  <div class="seg">
    <span class="chip c-fast" data-uses="fastMode">fast</span><span class="chip c-fasts" data-uses="fastModeShimmer">fast·</span>
    <span class="chip c-ultra" data-uses="effortUltra">ultra</span><span class="chip c-skill" data-uses="skill">skill</span>
    <span class="chip c-pro" data-uses="professionalBlue">privacy</span><span class="chip c-chrome" data-uses="chromeYellow">chrome</span>
    <span class="chip c-ok" data-uses="success">ok</span><span class="chip c-err" data-uses="error">err</span>
    <span class="chip c-warn" data-uses="warning">warn</span><span class="chip c-warns" data-uses="warningShimmer">warn·</span></div>`;
}
```

Call `renderPreview(); applyVars();` in `init()` (before checks; preview must exist before `applyVars`).

- [ ] **Step 4: Run to verify it passes**

Reload. Expected: `every key shown in preview` green. Edit pickers (e.g. `suggestion`, `planMode`, `diffAddedWord`) and watch the matching preview segment change live.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: kitchen-sink preview wired to theme vars"
```

---

### Task 6: Top bar — name, base selector, preset loader

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `CTB.state`, `applyVars`, `renderControls`, `CTB.PRESETS`.
- Produces:
  - `CTB.PRESETS` = `{ <name>: { name, base, overrides } }` for the 11 dotfiles themes.
  - `loadPreset(name)` — deep-copies preset into `CTB.state`, refreshes controls + vars + json.
  - Top-bar controls: `#name` (text), `#base` (select of 4), `#preset` (select of 11 + a blank), wired to state.

**Data extraction (produces the PRESETS literal):**

```bash
python3 - <<'PY' > /tmp/ctb_presets.js
import json,glob,os
out={}
for f in sorted(glob.glob('/Users/randolftjandra/Dev/dotfiles/claude/themes/*.json')):
    d=json.load(open(f)); out[d['name']]={'name':d['name'],'base':d['base'],'overrides':d['overrides']}
print('CTB.PRESETS = '+json.dumps(out)+';')
PY
```

Paste the contents of `/tmp/ctb_presets.js` into `index.html`.

- [ ] **Step 1: Write the failing checks**

```js
check('11 presets embedded', ()=> Object.keys(CTB.PRESETS).length===11);
check('loadPreset applies overrides', ()=>{ loadPreset('dracula');
  return CTB.state.name==='dracula' && effective(CTB.state,'cyan_FOR_SUBAGENTS_ONLY')==='#8BE9FD'; });
```

- [ ] **Step 2: Run to verify they fail**

Reload. Expected: both fail.

- [ ] **Step 3: Implement**

Paste `CTB.PRESETS = {…};` (from extraction). Then:

```js
function deep(o){ return JSON.parse(JSON.stringify(o)); }
function loadPreset(name){
  const p=CTB.PRESETS[name]; if(!p) return;
  CTB.state = { name:p.name, base:p.base, overrides:deep(p.overrides) };
  const nm=document.getElementById('name'); if(nm) nm.value=CTB.state.name;
  const bs=document.getElementById('base'); if(bs) bs.value=CTB.state.base;
  applyVars(); CTB.ALL_KEYS.forEach(k=>typeof syncRow==='function'&&syncRow(k));
  if(typeof renderJSON==='function') renderJSON();
}
function renderTopbar(){
  const bar=document.getElementById('topbar');
  const frag=document.createElement('span'); frag.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  frag.innerHTML=`name <input id="name" value="${CTB.state.name}" style="background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:3px 5px;font:inherit">`+
    `base <select id="base">`+['dark-ansi','light-ansi','dark','light'].map(b=>`<option ${b===CTB.state.base?'selected':''}>${b}</option>`).join('')+`</select>`+
    `<select id="preset"><option value="">load preset…</option>`+Object.keys(CTB.PRESETS).map(n=>`<option>${n}</option>`).join('')+`</select>`+
    `<button id="export">Copy JSON</button>`+
    `<button id="togglejson">JSON</button>`;
  bar.insertBefore(frag, document.getElementById('selfcheck'));
  document.getElementById('name').oninput=e=>{ CTB.state.name=e.target.value; if(typeof renderJSON==='function') renderJSON(); };
  document.getElementById('base').onchange=e=>{ CTB.state.base=e.target.value; applyVars(); CTB.ALL_KEYS.forEach(syncRow); if(typeof renderJSON==='function') renderJSON(); };
  document.getElementById('preset').onchange=e=>{ if(e.target.value) loadPreset(e.target.value); };
}
```

Call `renderTopbar();` in `init()` after `renderControls()`.

- [ ] **Step 4: Run to verify they pass**

Reload. Expected: checks green; selecting presets repaints everything; changing base updates unset keys.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: top bar with name, base, 11 presets"
```

---

### Task 7: Export — copy JSON, live JSON pane, toast

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `CTB.state`.
- Produces:
  - `exportJSON() -> string` = `JSON.stringify(CTB.state, null, 2)` with hex uppercased (state already stores uppercase).
  - `renderJSON()` — writes `exportJSON()` into `#jsonpane`.
  - `copyJSON()` — clipboard write with fallback + toast.
  - `toast(msg)` — transient message in `#selfcheck`'s neighbor.

- [ ] **Step 1: Write the failing checks**

```js
check('exportJSON shape', ()=>{ loadPreset('nord'); const o=JSON.parse(exportJSON());
  return o.name==='nord' && o.base && o.overrides && /^#[0-9A-F]{6}$/.test(o.overrides.text); });
check('export round-trips a preset palette', ()=>{ loadPreset('dracula');
  return JSON.parse(exportJSON()).overrides.cyan_FOR_SUBAGENTS_ONLY==='#8BE9FD'; });
```

- [ ] **Step 2: Run to verify they fail**

Reload. Expected: both fail (`exportJSON` undefined).

- [ ] **Step 3: Implement**

```js
function exportJSON(){
  const o={name:CTB.state.name, base:CTB.state.base, overrides:{}};
  for(const k of Object.keys(CTB.state.overrides)) o.overrides[k]=normHex(CTB.state.overrides[k]);
  return JSON.stringify(o,null,2);
}
function renderJSON(){ const p=document.getElementById('jsonpane'); if(p) p.textContent=exportJSON(); }
function toast(msg){ const el=document.getElementById('selfcheck'); const prev=el.textContent;
  el.textContent=msg; setTimeout(()=>el.textContent=prev,1500); }
function copyJSON(){ const s=exportJSON();
  const done=()=>toast('copied ✓');
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(s).then(done).catch(()=>fallback(s,done)); }
  else fallback(s,done);
}
function fallback(s,done){ const t=document.createElement('textarea'); t.value=s; document.body.appendChild(t); t.select();
  try{ document.execCommand('copy'); }catch(e){} t.remove(); done(); }
```

Wire in `renderTopbar()` (add after its other handlers):

```js
document.getElementById('export').onclick=copyJSON;
document.getElementById('togglejson').onclick=()=>{ const p=document.getElementById('jsonpane'); p.hidden=!p.hidden; renderJSON(); };
```

Call `renderJSON();` once at end of `init()`.

- [ ] **Step 4: Run to verify they pass**

Reload. Expected: checks green. Click **Copy JSON**, paste into an editor → valid theme JSON. Click **JSON** to toggle the live pane.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: export copy-to-clipboard, live json pane, toast"
```

---

### Task 8: README + final acceptance pass

**Files:**
- Create: `/Users/randolftjandra/Dev/ai/claude-theme-builder/README.md`
- Modify: `index.html` (only if acceptance reveals gaps)

**Interfaces:** none new.

- [ ] **Step 1: Write README**

```markdown
# Claude Theme Builder

A single-file, dependency-free tool to build a Claude Code custom theme visually.

## Use
Open `index.html` in any browser (double-click). Adjust colors on the left;
the fake Claude Code CLI on the right repaints live. Load one of the 11 bundled
themes as a starting point, then click **Copy JSON** and paste into
`~/.claude/themes/<name>.json` (or your dotfiles `claude/themes/`).

## Output
`{ "name", "base", "overrides" }` — the same shape Claude Code theme files use.

## Notes
Runs entirely offline from `file://`. No build, no install. Top-right shows the
self-check count (should be all green).
```

- [ ] **Step 2: Acceptance pass (manual)**

Open `index.html` and verify each:
1. Loads with no console **errors**; self-check all green; no network in devtools.
2. 58 rows; filter narrows the list; each row edits.
3. Editing repaints the matching preview surface.
4. Each of the 11 presets loads (name/base/pickers/preview update).
5. Copy JSON → clipboard parses; load dracula → export → `overrides.cyan_FOR_SUBAGENTS_ONLY==="#8BE9FD"`.
6. Self-check "every key shown in preview" green.

- [ ] **Step 3: Commit**

```bash
git add README.md index.html && git commit -m "docs: README; acceptance pass"
```

---

## Self-Review

**Spec coverage:**
- ~58 keys / pickers → Tasks 2, 4. Kitchen-sink preview → Task 5. 11 presets → Task 6. Copy-JSON export `{name,base,overrides}` uppercase → Task 7. Base selector + resolution → Tasks 3, 6. Filter, reset-to-base, live JSON pane, toast → Tasks 4, 7. Single-file/offline/no-deps → Global Constraints + Task 1. Build-time self-check (every key in preview) → Task 5. Acceptance criteria → Task 8. All spec sections covered.

**Placeholder scan:** The only intentional fill-ins are the two extraction outputs (`RAW_BASES` maps in Task 3, `CTB.PRESETS` in Task 6), each produced by an exact command given in-task — not hand-waving. No `TODO`/`TBD` in shipped code (the Task-1 TODO check is explicitly removed in Task 2).

**Type consistency:** `CTB.state` `{name,base,overrides}` used identically in Tasks 4/6/7. `effective(state,key)`, `normHex(v)`, `setKey/resetKey/syncRow/applyVars/renderControls/renderPreview/renderTopbar/renderJSON/loadPreset/exportJSON/copyJSON` names are consistent across tasks. `data-uses` attribute (Task 5) matches the self-check selector. Preset values verified against current dotfiles themes (e.g. dracula `cyan_FOR_SUBAGENTS_ONLY` = `#8BE9FD`).
