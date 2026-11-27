# three.js r186 (0.186.1), ES modules

The current three.js for new games (Emberholm). The older games stay on `../three/` (r128, a global `THREE`); see docs/ARCHITECTURE.md.

- `three.module.js` and `three.core.js` are copied unchanged from the npm package `three@0.186.1` (`build/`). `three.module.js` imports `./three.core.js`.
- Use it from a game with `import * as THREE from "../../shared/vendor/three-r186/three.module.js";`
- The npm package has no minified build any more, so these are the plain files (about 2.1 MB). Minifying them is a later step, before Emberholm goes into release builds.
