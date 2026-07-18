---
name: verify
description: Verify the running Phaser/React game through its Playwright-accessible browser surface.
---

# Verify

1. Build with `npm run build` and serve `dist` using `npm run preview -- --host 127.0.0.1 --port 4175`.
2. Drive the app in Playwright through the visible base-screen buttons and Phaser canvas; inspect `window.render_game_to_text()` only as the game's public accessibility/test surface.
3. Use a 2560x1440 viewport for QHD backing-store checks and capture screenshots under `.tmp/test-artifacts/`.
4. Seed scenarios only through the application's documented localStorage save key, then reload so `saveRepository` performs real normalization.
5. Cover at least one adjacent persistence probe, such as a lost echo whose map differs from the selected raid map.
