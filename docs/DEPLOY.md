# Getting Abduct a Chameleon live (incl. the Skywolf Studios portal)

The game is **two things**: `index.html` + the `maps/` folder. Everything is relative-path, so it
works from any folder depth on any host. Multiplayer additionally needs the tiny relay in
`server/` (any Node host), which the game can point at from anywhere.

## Fastest possible live test (1 click, no uploads)
GitHub → this repo → **Settings → Pages → Deploy from a branch → `glowup` / (root)** → Save.
~1 minute later the game is live at
`https://stephenuffugus.github.io/abduct_a_chameleon/` — playable on any phone.

## Putting it on the Skywolf Studios portal
Pick whichever matches how the site is built:

**A. The site is static files (you can upload files/folders)**
1. Download this repo as a ZIP (GitHub → Code → Download ZIP) or clone it.
2. Upload `index.html` and `maps/` into a folder on the site, e.g. `/abduct/`.
3. Link to `/abduct/` from the portal. Done — the whole single-player game runs from there,
   fully offline-capable, no build step, no dependencies.

**B. The site is a builder (Wix / Squarespace / WordPress / etc.)**
Host the game anywhere static (GitHub Pages from step 1 is fine, forever) and embed it on a
portal page with an iframe:

```html
<iframe src="https://stephenuffugus.github.io/abduct_a_chameleon/"
        style="width:100%;height:min(100vh,900px);border:0;border-radius:12px"
        allow="fullscreen; gamepad" allowfullscreen loading="lazy"
        title="Abduct a Chameleon"></iframe>
```

(Also add a plain "open full screen" link to the same URL — phones play better un-iframed.)

**C. The site can run Node (a VPS, Render, Railway, Fly, etc.)**
One process serves the game **and** the multiplayer relay:

```bash
cd server && npm install && npm start        # PORT env respected; defaults to 8080
```

Point a subdomain at it (e.g. `abduct.skywolfstudios.com`) and both single-player and
**🌐 Play Online** work out of the box.

## Multiplayer when the game is hosted statically (A or B)
Deploy just `server/` on any free Node host, then link to the game with the relay override:

```
https://<wherever-the-game-is>/index.html?mp=wss://<your-relay-host>/ws
```

Notes:
- HTTPS pages need a `wss://` relay (Render/Railway/Fly give you TLS automatically).
- The relay stores nothing and has no accounts — it only pairs two players by room code.

## Sanity checklist after deploying
- Open the URL on a phone: title screen → Practice → the First Flight tour should start.
- `maps/levels.json` must be reachable next to `index.html` (if levels show only
  "Prototype Meadow", the `maps/` folder didn't upload beside it).
- For online: two devices → Play Online → host shows a 4-letter code → join → play.
