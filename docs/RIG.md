# Squidkid rig contract

The kid is one SkinnedMesh rig. Bones are defined in `src/game/character-geo.js` → `BODY_BONES` (name, parent, rest
position in metres), with `BONE_NAMES`, `BONE_INDEX`, `BONE_PARENT`, `REST`, `getRestPositions(style)`,
`getBoneInverses(style)`. Hair strands (HAIR_MAX × HAIR_SEGS) and the squid form are driven by character.js.

Original bones: hips → spine → chest → neck → head; clavL/R → uArm → fArm → hand; thighL/R → shin → foot;
face helpers eyeL/R, browL/R, mouth, mouthO (children of head). Added bones: see below.

## Rules
- The modeling code may **add** bones (e.g. fingers, thumb, toes, jaw, eyelids, cheeks, tee hem / shorts / tank
  jiggle bones, hair tips). Never rename or remove existing ones; keep rest positions of existing bones unless a
  proportion change is agreed here.
- Every added bone gets a line below (name · parent · purpose · suggested motion). Unanimated bones must look right at
  rest.
- The animation code animates whatever exists.
- Budgets: ≤ 40k triangles per character (all forms + weapon, visible meshes), ≤ ~14 draw calls in kid form.

## Added bones
All added bones have identity rest orientation (like every bone) and are appended to `BONE_NAMES` **after** the hair
bones, so no existing index moved. Everything below looks right at rest if left unanimated. `ADDED_BONES` (exported)
lists them. Mirror rule for L/R pairs: rotations about local X keep their sign, rotations about Y and Z flip sign.

| bone | parent | rest (kid space) | purpose | suggested motion |
|---|---|---|---|---|
| `tank` | chest | (0, 0.848, −0.176) = tank centre | backpack: caps, collars, rails, bolts, back plate, gauge, valve + the back ends of the shoulder straps are skinned to it; character.js re-parents the glass/fill group to it | spring sway/bounce, small angles (≤ 0.12 rad) |
| `hemF`, `hemB` | hips | (0, 0.712, ±0.082/−0.1) | bottom band of the tee (weight ramps in below y≈0.76, strongest at the hem centre front/back) | rotation.x flap ±0.25 with stride/accel; z sway |
| `jaw` | head | head centre + (0, −0.035, −0.035) (`JAW_PIVOT`, character-face.js) | lower face below the lip line: lower lip + inner lip, lower half of the mouth cavity, lower teeth, tongue, chin (FACE rework). Weights are capped at 0.65 (`JAW_GAIN`): the head is so big that the lower lip sits ~19 cm from the pivot | rotation.x 0 … 0.35 × mouthOpen (as coded) opens the modelled mouth ≈ 3.5 cm at 0.3 rad (a wide booyah D); 0.1 ≈ a talking gap |
| `cheekL/R` | head | on the cheek puff, 2 cm inside | cheek puffs (max weight 0.55) | position.y +0.002…0.004 when smiling, small scale 1.0–1.06 |
| `earL/R` | head | ear root (az ±1.5) | pointed ears (weight ramps 0→1 over the first 20 % of the ear) | droop/perk: rotation.z ∓0.3 … ±0.2 (L: − droops), wiggle on hits/landing |
| `toeL/R` | foot | (±0.084, 0.028, 0.09) = ball of the foot | front 40 % of the sneaker (sole, upper, laces) | rotation.x −0.5 … 0 (toe stays planted while the heel lifts at push-off) |
| `hairTip0…7` | `hair{s}_2` | 86 % along each strand (per style, like the hair bones) | club-shaped tentacle tip (t > 0.84 of the strand) | extra spring stage after `hair{s}_2`; curl ±0.4 |
| `hand{L,R}_{thumb,index,middle,ring,pinky}{1,2}` | hand / previous joint | 1 = knuckle (MCP / thumb CMC), 2 = middle joint (PIP / thumb MCP) | articulated fingers + thumb with nails | see *Fingers* below |

### Fingers (important — different convention from a straight-finger rig)
- **Rest pose = power grip** around a Ø 2.8 cm handle (the weapons' grips are built around it: `HAND.hole` in
  character-geo.js, `GRIP_HOLE_L/R` / `FIST_OFFSET` in character-weapons.js). Unanimated hands therefore hold every
  weapon correctly, and a free hand reads as a loose curl.
- Palms face the thighs at rest (thumb forward, +Z), so **finger curl is rotation about local Z**, not X. Left hand:
  `+z` opens / extends, `−z` closes; right hand: signs flipped. Values relative to rest:
  - open hand: fingers `…1` z = +0.9, `…2` z = +0.75; thumb `thumb1` x = +0.55 (swings it down beside the index), `thumb2` z = −0.5
  - relaxed (idle, free hand): fingers +0.45 / +0.35; `thumb1` x = +0.35, `thumb2` z = −0.25
  - tight fist (punch, fist-pump): fingers −0.35 / −0.5; `thumb1` (y −0.1, z +0.12), `thumb2` z = +0.3
  - holding any weapon grip / the bomb: 0 (rest)
- Names deliberately do **not** match character.js' generic `/^(finger|thumb|…)[LR]\d$/` curl (rotation.x, straight-finger
  assumption): applying that would bend these fingers sideways. To animate them, map your curl value `g` to
  `rotation.z = side * (rest − g)` with the values above (side = +1 for L, −1 for R).

### Not added (and why)
- `lidL/lidR` (re-evaluated): the lids ARE modelled now, but they are not bones. Each lid closes in the skin
  vertex shader by rotating its vertices about the eyeball's own horizontal axis *in eye space* (the eyeball is an
  ellipsoid = unit sphere under an affine map), with a per-vertex travel that is exactly "this column's lid edge → the
  closed line". A rigid bone rotation can't do that: it keeps one travel for the whole lid (the corners over-close) and
  linear-blend skinning with partial weights shrinks the lid into the ball. Drivers, no bone needed:
  - the eye bones' **Y scale** (character.js blink / wink / squint / gaze-follow, as coded) — the shaders read it from
    the bone texture: close = (1 − scaleY) / 0.93;
  - the per-kid uniform **`uLid`** (upper L, upper R, lower L, lower R, 0…1), combined with the bones by max().
  character.js' optional `xb.lidL/lidR` path therefore stays inert.

### Face helpers after the FACE rework
- `eyeL/eyeR` carry no geometry any more (the eyeballs are skinned to `head` and turned in the eye material by
  `uLook` / `uGaze`); their Y scale is the blink signal above. Rest positions unchanged.
- `mouth` / `mouthO` carry no geometry (the mouth is modelled and shaped by `uMouth` / `uMouth2` + `jaw`). FACE pass 2
  moved the mouth up (`MOUTH.el` −0.45 → −0.41), so these two helpers' rest positions are ~7 mm higher.
- `cheekL/R` weights now fade to 0 inside the eye patch (a cheek raise must not push the lower lid into the ball).
- `earL/R`: the rebuilt ears keep the old frame (root, axis, width profile — `earFrame(sx)` in character-face.js), so the
  punk hoops still pierce the rim.

### Proportion / rest-position notes
- Existing bone rest positions are unchanged. The face helpers (`eyeL/R`, `browL/R`, `mouth`, `mouthO`) are derived
  from the re-sculpted head surface and moved ≤ 3 mm; the brows sit on the mask's top rim (`BROW.el` 0.49 → 0.455,
  then 0.515 in the eye/face art pass below) so expressions read under the bangs.
- `FIST_OFFSET` (character-weapons.js) is now the right fist's grip-hole axis (0.0255, −0.0525, 0): twirls pivot on the
  handle. `inHand` / `handR` / `handL` keep their meaning.

### Eye/face art pass (2026-10-13, "make them read as squid kids")
Sculpt and shading only — no bone, rig or style-index change:
- **Lashes removed.** The two geometry lash tabs (`LASHES` / `addLash` in character-face.js) and their contact-shadow
  term in the eye shader are gone: they rendered as a black blob inside the aperture at close range. `RES[].lash` is
  dropped with them.
- **Iris + sclera rebalanced.** `EYEB.iris` 0.37 → 0.62 → **0.42** (the manga reference has the iris at about half
  the aperture, with a real white sclera around it), aperture widened (`xh` 0.5 → 0.55, `hu`/`hl` 0.6/0.57 → 0.68/0.63,
  radii up), limbal ring thicker/darker, pupil rebalanced, sclera desaturated with the corner pink cut.
- **Mask: a connected eye outline, shading only.** The old filled patch (`visorSD` in character-face.js + its shader
  twin `iwVisorSD`) is **deleted**, recess included — a thin rim could not be modelled on the carrier grid anyway.
  The pigment is now computed in the skin shader alone, in **eye-aperture space** (from `uEyeMi`, `uEyeC`, `uEyeAp`),
  so it *follows every eye shape and size automatically* — verified across `eyeSize` 0/1/2. `iwMaskSD()` returns a
  bold ring (thick over the upper lid, thin under it, no spikes), the two rings are joined by a **bridge bar** across
  the nose (`abs(az)`-space ellipse at `el ≈ 0.115`) so the mask reads as one connected shape like the reference, and
  a soft head-space gate (`(abs(az)-0.355)/0.32`, `(el-0.15)/0.34`) keeps the ring off the cheeks — without the gate,
  aperture-space distances are angular and `e ≈ 1` reaches a long way from the eyeball's centre.
- **Head sculpt.** `HR` 0.178/0.176/0.165 → 0.186/0.168/0.168 (wider, flatter cranium), flatter crown, stronger brow
  ridge, cheekbone and chin, an added jaw-corner term, a sharper nose tip and wing crease plus an under-tip shadow.
- **Jaw plane follows the sculpt** (the "head cut in half" fix). `JAW_PLANE.d` was an absolute depth below `HEAD_C`;
  once `HR.y` changed it cut a visible crease across the lower face. It is now `0.163 · HR.y / HR0.y` (recomputed in
  `setFaceShape`, so every faceShape gets a consistent jaw) and the smooth-min blend widened `k 0.016 → 0.038`, which
  softens the junction into the neck instead of creasing it.
- **Hairline scallop.** `hairline(az)` (and its `iwHairline` twin) gains a shallow `cos(az*9)` wave at the front, so
  the cap edge reads as fringe locks rather than one smooth helmet edge.
- **Tentacle section + tips.** The strand section is cupped underneath (`strandSpec`, character-geo.js) so the printed
  sucker rows sit in a groove; tips taper to a point (`lerp(1, 0.2, …)`) with 1.3× the curl; strands are 7 % thinner.
- **Suckers off the reference sheet.** Modelled cup radius 0.20 → 0.30 × the strand radius (spacing up with them, so
  they sit as separate discs in two staggered rows), printed cups 0.66/0.4 → 0.8/0.5 of the section with a wider band;
  bang locks wider and flatter (`L.r` 0.8 → 0.95, `L.flat` 1.3 → 1.5) so the fringe reads as tabs, not tubes.
- **Measured budget** (`window.lab.headInfo(tier)`, `lodInfo()`): hero 107 487 tris (skin 29 234 — of which head+neck
  20 634 — cloth 41 560, hair 32 757, eyes 3 936), game **31 282**, far **9 026**. The 40k rule above is the in-match
  tier; the hero tier is the close-up/locker tier and always ran above it.
- **Iterate** with `node tools/char-sheet.mjs --slot hair --cam face --lod hero --out /tmp/sheet` (one browser, one
  PNG per option; `SLOT_NAMES` in character-style.js is the option table it sweeps — `hair`, `skin`, `outfit`, `eyes`,
  `hat`, `brows`, `faceShape`, `eyeSize`).

### Chibi pass 2 — "exaggerate" (2026-10-13)
Follow-up brief: eyes "way way bigger", hair "still too many fringe and way too thin", "exaggerate the proportion",
and the jaw line was called out as ugly.
- **Eyes**: `EYEB` 0.068/0.082/0.045 with an opening of `xh 0.64 / hu 0.78 / hl 0.71` and the iris at **0.58** of the
  aperture, pupil 0.33 → **0.42** of the iris — big iris + big pupil + white sclera, the manga read. `EYE.el`
  0.16 → **0.06** puts the eyes on the head's midline (chibi layout, no huge forehead), `EYE.az` 0.36, `EYE_RECT`
  `0.03…0.72 / −0.26…0.56`. (A first attempt at `xh 0.80 / hu 1.00` with a 0.208 head was too far: the eyeballs came
  out of their sockets and the face went blank — pulled back.)
- **Head**: `HR0` 0.200/0.184/0.180, crown flattening 0.13, jaw taper 0.30 → **0.34** with the cheek/mochi terms cut
  roughly in half (0.0050 / 0.0032 / 0.0032), a small forward chin (0.0044) and a stronger jaw corner (0.0036);
  the under-jaw plane went deeper (0.186) with a wider blend (0.052) so the jaw reads as a line, not a cut. Neck
  thicker to match (`NECK_R` ≈ 0.045), ears smaller (`earFrame` L 0.106 → 0.082).
- **Hair**: strand counts now Tide 3 · Spike 4 · Twin 3 · Bob 3 · Pony 4 · Crest 3 · Knot 4 · Swoop 4 — the
  face-framing locks, second bangs and the small swoop locks are gone. Each survivor is exaggerated (`rk` ×1.45,
  end radius ×1.9, a longer taper to a point) and the single bang tab per style is more tube-like (`flat` 1.5 → 1.05)
  so it reads as one lock instead of a sheet.
- **Mask**: the liner is bold again to match the reference — `w = 0.16 + 0.34·smoothstep(−0.9, 0.7, up)` with the
  inner edge at `e = 0.9`, so it covers the lid margin and hugs the eye. Gate + bridge follow the new eye centre.
  At a distance the ring + bridge now read as a proper Inkling eye mask (verified in the game-tier line-up).
- **Portraits** were re-framed for the bigger head: face 0.60 · head 0.76 · bust 1.32 spans (showcase.js).
- **Budget**: game-tier kid 28 922 tris (smoke guard ok), hero ~90k, far ~8.5k — all under the 40k rule.

### Chibi + chunky-hair pass (2026-10-13)
Owner brief: "a lot more chibi / manga, bigger eyes", and hair that reads as a few thick sculpted locks instead of a
bundle of thin strands.
- **Bigger eyes.** `EYEB` radii +11 % (`rx/ry/rz` 0.060/0.073/0.040) and a bigger opening (`xh` 0.55 → 0.66,
  `hu` 0.68 → 0.82, `hl` 0.63 → 0.76); `EYE_RECT` widened to keep containing the patch (`0.05 … 0.70`,
  `−0.26 … 0.52` — `el0` is bounded by `MOUTH_RECT.el1 = −0.27` because the carrier knots must stay ordered). Iris
  stays at 0.42 so the manga proportion of sclera-to-iris holds. The mask is aperture-space, so the ring and bridge
  scaled with the eyes for free; the liner was thinned to `0.01 + 0.12·smoothstep(−0.9, 0.7, up)` and its inner edge
  moved to `e = 1` so it sits exactly on the lid edge instead of overlapping it.
- **Bigger head.** `HR0` 0.186/0.168/0.168 → 0.196/0.180/0.176 (chibi). The jaw plane scales with `HR.y` and
  `setFaceShape` recomputes it, so the head can grow without re-introducing the jaw crease.
- **Hair: fewer, thicker locks.** Strand counts per style: Tide 7 → 3, Spike 6 → 5, Twin 6 → 4, Bob 7 → 5, Pony 6 → 5,
  Crest 5 → 3, Knot 7 → 6, Swoop 6 → 4 (the wispy face-framing locks and the second bang per strand are gone; two
  crest fins and two swoop locks were dropped). Each remaining lock is thicker (`rk` ×1.05 with the removed strands
  doing the heavy lifting), tapers over a longer run to a point (`lerp(1, 0.12, sstep(0.72, 1, t))`), keeps more of
  its end radius (`r1 × 1.2`) and has a smaller club (0.24 → 0.16). Bang tabs are lifted 14 mm off the scalp so they
  read as locks rather than a smooth sheet, and the front hairline rose (`hairline` front 0.58 → 0.72, plus its
  `iwHairline` twin) so the fringe clears the eyes.
- **Budget after this pass** (`lab.headInfo`/`lodInfo`): hero 89 923 tris (hair 32 757 → **15 285**), game **28 834**,
  far **8 554** — everything under the 40k rule, hair cost roughly halved.
- Remaining knobs if you want to push further: the liner weight/bridge ellipse in `iwMaskSD`/the pigment block, the
  per-style strand arrays in `STYLES`, the global `rk` multiplier and the hairline height.

### Face sculpt + eye size are style slots (2026-10-13)
`faceShape` (6 options, `FACE_SHAPES`) and `eyeSize` (3, `EYE_SIZES`) live in `character-face.js`, mirrored by name in
`character-style.js` (`FACE_SHAPE_NAMES`, `EYE_SIZE_NAMES`) and listed in `SLOT_NAMES` for the locker and the labs.
Index 0 of both is exactly the art-pass look, so every saved profile, bot and roster entry is unchanged.
- `setFaceShape(faceShape, eyeSize)` mutates `EYEB` / `HR` / `EYE_FRAMES` / `MOUTH_FRAME` / `FACE_SHADER` **in place**
  (exported identities and the append-only rig are untouched). It runs from the `Character` constructor and from every
  geometry build, via `useFaceShape(style)` in character-geo.js.
- Materials **snapshot** the constants they need: `faceUniforms()` clones the vectors/matrices, so a later
  `setFaceShape()` for another kid cannot move this kid's eye frames. Geometry is cached per face key
  (`getKidShared(lod, style)`, `getHairStyle`, `getBoneInverses` → `lod|bodyLevel|face.eye`), which is what makes two
  differently-sculpted kids coexist in one scene (verified: two Characters, `faceShape 0`/`eyeSize 0` vs
  `faceShape 2`/`eyeSize 1`, distinct meshes and distinct looks in the same render).
- Anchors do **not** move: `HEAD_C`, the head bone and the face helper bones keep their rest positions, so IK, gaze
  (`getHeadPosition`) and portrait framing stay valid — the sculpt only scales radii around the same head centre.
- **Locker**: a new `HEAD` tab (`LOCKER_TABS`, menus.js) holds FACE SHAPE + EYE SIZE, each tile a live face portrait of
  your kid with that option; the sticker sheet lists both, and picks save through `_saveStyle` like every other slot
  (verified end to end: pick Sharp + Bright → `profile.style.faceShape/eyeSize` and `localStorage['inkwave.profile']`).
  Nothing else in the locker needed changing — tiles, portraits, portrait cache keys, presets and the online sync are
  all field-agnostic, which is why the slots had to be flat integers (`SLOT_NAMES` strings are the i18n keys).
- **Budget guard**: `tools/smoke.sh` now fails if the game-tier kid meshes (skin + eyes + cloth + hair via
  `kidStats('game')`) exceed 40 000 triangles (currently 31 282). Trip-tested with a lowered threshold.

### Props
- `getSubDef('bomb')` (character-weapons.js): hand-held splat bomb (`body` → plastic material, `ink` → team ink material),
  held by its knurled cap in the LEFT fist: parent a group to `handL` at `inHandL.pos/quat` (same maths as weapons).

## Added bones (log)
- `tank` · parent chest · at the tank centre (0, 0.848, -0.176) · the whole backpack (glass, caps, rails, plate, back
  ends of the straps) weighted to it · character.js bounces/sways it with springs (and re-parents the ink-fill/glass group to it).
- `hem` (or `hemF` + `hemB`) · parent spine/hips · bottom band of the tee · character.js flaps it with acceleration
  and stride (rotation.x/z springs); rest pose must look right unanimated.
- `jaw` (optional) · parent head · lower face/chin · character.js opens it with the mouth (rotation.x ≈ 0.35 × open).
- ✔ (see *Fingers* — rest = grip, curl axis local Z, names `hand{L,R}_*`) fingers (optional) named like `fingerL1`, `thumbR` · character.js curls rotation.x around grips (1.1 rad), relaxes
  when free; `lidL/lidR` (optional) close with blinks (rotation.x up to 1.2) — lids not added (see *Not added*).
- Already handled if they appear: toeL/toeR, lidL/lidR, jaw, tank, hem/hemF/hemB, finger*/thumb*.
