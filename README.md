# Kiwi Rush

An endless runner starring a kiwi bird on a tropical island, written in TypeScript.

- **`index.html`**: v1, a 2D side-scroller (single self-contained file)
- **`v2.html`**: v2, a 3D three-lane runner built with [three.js](https://threejs.org) (single self-contained file)
- **`docs/`**: v2 packaged as an installable web app (PWA), served by GitHub Pages

## v2 controls

| Action | Keyboard | Touch |
|---|---|---|
| Switch lane | ← / → or A / D | swipe left / right |
| Jump (twice = double jump) | ↑ or W | swipe up |
| Slide / slam down | ↓ or S | swipe down |
| Dash | Space | tap |
| Shop · pause · mute | B · P · M | on-screen buttons |

Coins you collect are banked after each run and can be spent in the shop on upgrades and new kiwis.

## Develop

```
npm install
npm run build   # typecheck, then bundle index.html, v2.html and docs/
npm run serve   # serve docs/ on http://localhost:8080
```

Source lives in `src/` (v1) and `v2/src/` (v2).
