# Fork integration record (sebz1337-dev/inkwave)

Date: 2026-10-12. Author: OpenCode session with the repo owner.
Purpose: let the next agent (or human) know exactly what was merged, what was
adapted vs cherry-picked, what was deferred and why, and how to continue.

## 1. Starting point

* Canonical network root is **`DevFrancois/inkwave`** (170 forks). `README.md:66`
  still points at `jaydendavisnc/inkwave`, which 404s — stale, do not trust it.
* This fork (`sebz1337-dev/inkwave`, branch `main`) was identical to upstream
  `main @ 2a32efe` ("INKWAVE 1.0", 2026-09-26).
* Branch layout now:
  * `main-original @ 2a32efe` — pristine 1.0 backup (pushed to origin).
  * `main` — integration branch (pushed to origin, ahead ~60 commits).
  * `savepoint/pre-autoplay` branch + `savepoint-pre-autoplay` tag — rollback
    point from before the autoplay port (pushed to origin).
* Full fork survey (all ~171 fork names vs base, via
  `gh api repos/DevFrancois/inkwave/compare/main...OWNER:main`) was done with
  4 parallel subagents. Detail: ~67 forks identical, ~100 ahead (all
  `behind 0`), 1 dead (`Samgith2025/inkwave`). Most "ahead" forks only carry
  the shared stacks below, not unique work. Fork list snapshot was at
  `C:/Users/User/AppData/Local/Temp/opencode/forks.txt` (temp, may be gone).

## 2. De-facto baseline (merged first, fast-forward, no conflicts)

`DevFrancois/main` never moved past 1.0, but the forks share 32 commits of
real upstream work. Merged via `lvjunling/inkwave:main @ 679d2db`:

1. Jayden 1.1 (`19c62df`, `53b9aa3`): online multiplayer, Boss Battle,
   character/lighting overhaul, Cargo Terminal stage, What's New cards.
2. LilDannyy `zone-control-stages-arsenal` (23 commits + merge `3e9b550`):
   Zone Control mode, 4 stages, rebuilt maps, kits arsenal (`src/game/kits/`),
   desktop (Electron) app, botlab fixes, HULLBREAKER, ghost sync.
3. MapleForCode i18n (5 commits): `music-manifest` root, EN+zh-CN
   (`src/i18n/strings.js` + `zh.js`), language dropdown, net error codes.
4. MrTangLuyao (4 commits, PRs #18/#19): click-to-relock mouse (`eaf2eb8`),
   judge-screen `t()` shadowing fix (`429d570`).

Consequences: `package.json` scripts changed — **`npm start` = Electron app**
(`electron .`), web server is now **`npm run serve`** (needs Python).
`src/i18n/strings.js` with `t()` (+EN fallback) is the i18n system; there is
no `src/i18n/ja.js` in this tree (JP excluded on purpose). The arsenal is the
kits system with `WEAPON_SUCCESSOR` (`dualies→twins`, `splatling→spinner`,
`slosher→bucket`); `src/game/bots.js` is the Zone-Control-evolved bot AI.

## 3. Clean cherry-picks (16, history preserved, `cherry-pick <sha>`)

* People-11 (11, perf/boot): `3f96766` (keep GL programs), `ec2fdf0` (GTAO
  half-res), `2c794f2` (prop materials), `0389573`/`b92b2b8`/`96e46e2` (CSS),
  `0d092f6` (audio while loading), `8eb2e0e`/`e83efa0` (spectate/respawn),
  `81dd37a` (cached portrait), `a19a5a6` (worker audio grain).
* `jy/9822785` respawn-hide cap (`src/net/netmatch.js`).
* `Blagii` Electron GPU settings (`electron/main.cjs` only).
* `xiaovvupup/8c79bca` + `99a89ee` (Pages multiplayer + custom relay domain).
* `anfaal/e77d2d9` FxHooks leak fix (`src/fx/fxHooks.js` only).
* Redundant, skipped: `kindle4jerry/bf62620` (older duplicate of `eaf2eb8`
  already in baseline).

## 4. Manual ports (adapted, committed as "Port …"; no JP/phone hunks)

All `node --check` clean at commit time. PC-only: every `src/i18n/ja.js`,
jp-font, `touch.css`/phone-layout hunk was dropped.

| What | Source | Files touched | Notes |
|---|---|---|---|
| Perf/logger/GPU-probe infra | JONI `572dcaa` (partial) + `gpu-selftest.js`/`gpu-caps.js` file checkouts from `ee47ee9`/`c2cd438` | `src/core/{logger,perf,gpu-selftest,gpu-caps}.js` NEW + `src/main.js` wiring (`Log.install`, boot steps, `Perf.init`, `__inkwave.perf`) | New files verbatim from `joni/main` HEAD (already include lazy-hitch + `#version` fixes); wiring minimal, `_gateDone` lines excluded (no gate in this tree) |
| Browser fullscreen + Esc/mouse | People-11 `e2d44b4` | `src/{config,main}.js`, `src/ui/menus.js` | Adds `fullscreen: true` default, `_enterFullscreen/_exitFullscreen` (skipped under `window.inkwaveNative`), `_resumedAt` 500 ms guard, relock prompt `{ id: 'Click to take back the mouse' }`; settings toggle now always shown (was Electron-only); i18n keys reused |
| Cheat foundation | anfaal `01b22f2` (cheat parts only) | `src/game/cheats.js` NEW + `main/actor/weapons/match/paint/menus/strings` | Session-only (`isCheatKey` filter in `saveJSON`, `CHEAT_DEFAULTS` merged, never saved); Settings→Cheats tab + pause CHEATS entry + `action`-row type; god/team-god/ink/special/respawn/steady/speed/jump/gravity/fire/damage/paint/freeze/passive/timer/slow-mo + refill/paint/+1min/end; `fpsCap`/phone/`lite`/touch parts skipped (`fpsCap` already existed) |
| Aimbot + auto-fire | anfaal `ceb5016` | `src/game/player.js`, `menus.js`, `strings.js` | Snap + auto-fire + 500 % assist range (friction floor, share cap, cone widen) |
| Fire-solver core + targeting + muzzle hooks | anfaal `712dceb` (full, 3 commits) | `src/game/aimbot.js` NEW + `main` (`G.frameDt`) + menus/FOV + `player.js` `_aimbot` + `weapons.js` 6 hooks (shooter/rounds/slosher/blaster/flick/charger) | Solver knows base kinds; new kit kinds degrade to camera-snap (acceptable); `autoFire()` shared; `index.html` preload skipped (this tree has no preload list) |
| Autoplay | anfaal `b6a46cf` | `src/game/autoplay.js` + `tools/autoplay-eval.mjs` NEW; `player/bots/match/main/config/aimbot/cheats/menus/strings/smoke` | Levels 1–5 (`AUTOPLAY` table, ApexBrain), 1.5 s manual override, `?autopilot=1..5`, bot hooks adapted to `MELEE` table; `SMOKE_PORT`; player disabled-branch merge fixed (was returning before splatted-map planning) |
| Laptop GPU batch | jy `b0241a3`+`a5fe4e0`+`7488a2c` | `src/core/renderer.js` (`gpuInfo()` + `gpuPref` powerPreference + `this.gpu`), `config` (`gpuPref`), `main` (iGPU auto-tune→medium + toast), menus row, EN strings, `tools/{boot-dump,gpu-set-check}.mjs`, `.gitignore` (`tools/serve.log`) | EN-only (zh falls back); menu-art preview card skipped |
| Chunked stage build | JONI `c3c753b` (core) | `src/main.js` (`_buildWorldNow` yields + `compileAsync` + `Log.steps('build')`) + `test/perf-summary.test.mjs` | Gate/safety parts N/A (no gate infra); lazy-hitch + GPU verdicts already present in checked-out files |
| Kit pre-warm | JONI `f007bc9` (part) | `src/{main,config}.js` | `_prewarmWeaponBatches()` on menu idle behind `prewarm: true`; gate/watchdog/touch-editor skipped (need `showBusy`/gate UI that doesn't exist) |
| Movement numbers | anfaal `f59d786` (numbers-only) | `src/{config}.js` (`swim 12`, `enemyInk 1.5`, refills, respawn 7 s, `WEIGHT` table; spinner/charger heavy, twins/brush/blade light), `actor.js` (swim weight), `weapons.js` (idle run weight + shot falloff), menus weight label | Roster variants dropped (incompatible with kits, see §5) |
| Wall-hosing fix | anfaal `f9ca5c1` (adapted) | `src/game/bots.js` (`_hidT` + 0.35 s `inView` cut-off) | Dry-pit fix (`641de33`) already present in baseline |

## 5. Deferred with reasons (all attempted, conflicts measured)

* **anfaal deep weapons** (`3c959a1`, `77f4d3c`, `34c0938`, roster `0f1cc4d`,
  balance `0a09cca`, specials `474f9b5`, kits `4ccdf09`, Dynamo `79aee9a`,
  subs `f0df5b7`, roll/surge `97f9cd7`, poses `28c0a09`): built for the
  retired 1.0 arsenal; this tree replaced it with kits. Blind merge breaks
  every weapon. Needs a dedicated weapons branch with per-kind playtesting.
* **anfaal stages** (`bafa49e` Skatepark/Rooftops + `a943287` art):
  `maps.js`/`dressing.js` diverged under Zone-Control. Needs a stages branch.
* **anfaal big bot overhauls** (`7a48936`, `a864a66`): same reason; the
  high-value one-liners (freeze/passive hooks, wall-hosing) are already in.
* **Boot prod pipeline** (`ca366af` service worker/build, `5ce1d8d`,
  `c13b1bc`, `11face5`, `ddc831e`, `5327767` phone parts): deferred, no PC
  need; touch/PWA parts excluded by policy.
* **JONI gate/watchdog/UI** (`f007bc9` remainder, `61b739a` profiles tab):
  needs `showBusy`/loading-gate UI that doesn't exist in this tree.
* **People-11 leftovers** (17): `aa356a0` already covered (`_trackVsync`);
  `ea11d1d` already fine; rest need `main.js` surgery on a diverged tree —
  low value/risk without device testing. Tried via `cherry-pick -n`, all
  conflicted, reset clean.
* **Docs-only / cheats-for-fun**: `9G420` (godmode fork), `smithmanny`
  (shop/monetization), translation-only commits — skipped by policy.

## 6. How to verify / playtest

* Web: `npm run serve` (needs Python) → `http://localhost:8490`
  (`?autostart=180`, `?map=halyard&time=dusk`, `?autopilot=3`,
  `?verbose`, `?shadercheck`). **Note:** `npm start` now launches the
  **Electron app**, not the server (baseline changed scripts).
* Desktop: `npm start` (Electron). Browser-fullscreen code paths are
  correctly guarded out there.
* Exercise: Settings → Cheats (all toggles + 4 actions), Aimbot + field,
  Autoplay + strength; pause CHEATS entry; Esc/fullscreen flow; Video →
  Graphics card picker; console `[inkwave:boot]`/`[inkwave:perf]` lines,
  `__inkwave.perf`; `npm run smoke` for the headless pass.
* Environment quirk (2026-10-12): Windows box has **no Python**
  (`python`/`python3` are Store stubs), so `serve`/`build` scripts can't run
  there; `node --check` on touched files is the verified gate so far.

## 7. Fork review: norfan + caomeiguojiang (2026-10-13)

Reviewed with temp remotes `norfan` / `caomei` (fetched, `--no-tags`):

* **`caomeiguojiang/inkwave`** `main @ 53b9aa3` — ancestor of our `main`, 0 unique
  commits. Its only real work is on **`codex/assertok @ 6f26f09`** (15 commits):
  vendored i18next + 4 locales (`en/ja/zh-Hans/zh-Hant`) *replacing*
  `src/i18n/strings.js`, self-hosted Swei CJK fonts, `server-node/` relay +
  Docker/Assertok build, staged startup, upstream-tracking docs. Its tip touches
  `fxHooks.js`/`netmatch.js`/`main.js` — the same files as our ports (pointer
  relock, FX retention, respawn), so verify before reusing anything from it.
* **`norfan/fork-inkwave`** `main @ a012962` — base `98ea296` + 18 commits
  (+8 720 / −189, 53 files): local split-screen 1–4 players (`src/ui/local4p.js`,
  renderer splits, per-seat input), phone-as-pad over LAN
  (`electron/pad-relay.cjs`, `pad.html`, `src/net/padlink.js`, `vendor/qrcode/`,
  `android-pad/` APK shell, `tools/pad-*.mjs`), phone HUD/labels, per-player
  names + loadouts, Windows packaging. It touches 13 files we also rewrote since
  base (`main.js`, `menus.js`, `renderer.js`, `match.js`, `player.js`,
  `weapons.js`, `hud.js`, `ui.css`, …) — port per feature, never as a merge.

Ported now (owner's calls, 2026-10-13):

* `padSensitivity` default `1.0 → 1.3` (`ac741b6`, `src/config.js`) — right-stick
  camera ×1.3 by default. Verified live: Settings → Controls shows "Controller
  sensitivity 1.30×", `__inkwave.settings.padSensitivity === 1.3`.
* `MATCH.durations → [90, 180, 300, 600, 1200]` + `maxDuration 180 → 1200`
  (`ab788da`/`ac741b6`), **keeping** `defaultDuration: 180` (3 min). Saved
  `matchLength: 90/180` stay valid; `main.js:731` no longer clamps the new
  options away. Verified live: stage select shows MATCH LENGTH
  90 SEC / **3 MIN** / 5 MIN / 10 MIN / 20 MIN, clicking 20 MIN sets
  `settings.matchLength = 1200` and START launches `match.duration = 1200`;
  Settings → Gameplay lists the same 5 options; the one-minute cue still fires
  (`match.js:208`: `time <= 60 && duration > 60` → track switches to
  `battle_final`).

Reviewed, deliberately **not** ported:

| norfan change | why |
|---|---|
| `PLAYER.hp 100 → 300` (`ab788da`) → `600` (`ac741b6`) | **Kept 100** (owner's call). Bundled with their split-screen work and **never accompanied by a weapon-damage retune**, so it is a ~6× TTK balance change, not a setting. Revisit only together with per-weapon damage tuning. |
| `defaultDuration 600` (10-min default round) | **Kept 180**. The long options are additive here; norfan's 10-min default is not followed. |
| `_styleCache` blank-menu fix (`f46b406`) | N/A here: our `_style()` already reads `(this._styleCache || {})` and `_saveStyle` assigns the object itself; norvan indexed `_styleCache[idx]` before init. |
| `src/net/mock.js` duration handling + `src/net/session.js:246` | **Fixed** (was the mock's `90 ? 90 : 180` and the online clamp `60..600`). Mock `create()` now uses the catalog — `MATCH.durations.includes(s.matchLength) ? s.matchLength : MATCH.defaultDuration` — and its `join()` host picks `pick(MATCH.durations)`. Online `setSettings` clamps to `MATCH.maxDuration` instead of a hard 600, so the 20-min option is not silently halved online. Verified with two real clients against a local relay: host `setSettings({duration:1200})` → guest lobby 1200 (screenshot: LENGTH chip on 20 MIN), 300/90 pass, rogue 999999 → 1200, 10 → 60. Note the online path still accepts any length inside `60..MATCH.maxDuration` from a host (the clamp is a range guard, not a catalog check). |

## 8. Suggested next work

1. Playtest this `main` first (cheats/autoplay/GPU paths above).
2. One branch per deferred block, starting with weapons (`0f1cc4d` family
   reconciled against `src/game/kits/` + `WEAPON_SUCCESSOR`).
3. Fix `README.md:66` upstream URL (`DevFrancois/inkwave`, not `jaydendavisnc`).
4. Consider `npm run check` in Git Bash (the `for … $(find …)` script is
   bash-only; plain `node --check` was used on Windows instead).
5. Split-screen + phone-pad (norfan §7) is the largest unported feature block;
   needs its own branch and a per-seat input/menu wiring pass on this tree.

