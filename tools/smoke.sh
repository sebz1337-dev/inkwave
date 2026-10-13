#!/bin/sh
# Boot the game, play 8 s on autopilot, report state + any console errors. Exit 1 on errors.
cd "$(dirname "$0")/.."
PORT=${SMOKE_PORT:-8490}   # SMOKE_PORT: test a server that serves another checkout
OUT=$(node tools/play.mjs "http://localhost:$PORT/?autostart=60&autopilot&shadercheck" '[{"until":"window.__inkwave && __inkwave.match && __inkwave.match.state===\"playing\" && __inkwave.match.local"},{"wait":8000},{"eval":"(async()=>{const g=await import(\"/src/game/character-geo.js\");const m=__inkwave.match;const k=g.kidStats(\"game\");const tri=(x)=>(x.index?x.index.count:x.attributes.position.count)/3;const hair=tri(g.getHairStyle({hair:0},\"game\").geo);const ts=m.actors.map(a=>g.countTriangles(a.character.root));return JSON.stringify({state:m.state,t:+m.time.toFixed(1),boot:__inkwave.bootMs,fps:__inkwave.fps,perf:__inkwave.perf,gameKidTris:k.skin+k.eyes+k.cloth+hair,headTris:k.head.tris,maxActorTris:Math.max(...ts),turf:m.actors.map(a=>Math.round(a.stats.turf))})})()","log":"smoke"}]' 2>&1)
echo "$OUT" | grep -v "Failed to fetch\|404\|preload"
echo "$OUT" | grep -qiE "\[error\]|pageerror|until timeout|eval error" && { echo "SMOKE FAIL"; exit 1; }
echo "$OUT" | grep -q "smoke ->" || { echo "SMOKE FAIL (no result - is the dev server on :$PORT up?)"; exit 1; }
# character budget guard (docs/RIG.md): the in-match kid meshes (skin + eyes + cloth + hair, game tier) stay under 40k.
KID=$(echo "$OUT" | sed -n 's/.*"gameKidTris":\([0-9]*\).*/\1/p')
if [ -n "$KID" ] && [ "$KID" -gt 40000 ]; then echo "SMOKE FAIL (character budget: game-tier kid $KID tris > 40000)"; exit 1; fi
echo "SMOKE OK"
