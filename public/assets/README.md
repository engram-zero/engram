# Showcase assets (public)

Files dropped here are served from the site root under `/assets/…`. Used by the
0G Zero Cup submission page (`my project` tab → Logo URL / Thumbnail URL).

| Save the file as | Served at | Use it for | Specs |
|---|---|---|---|
| `public/assets/logo.png` | `https://engram-bay.vercel.app/assets/logo.png` | **LOGO URL** (square project icon) | square, 512×512 (PNG) |
| `public/assets/cover.png` | `https://engram-bay.vercel.app/assets/cover.png` | **THUMBNAIL URL** (cover / voting card) | ~1280×720 (16:9, PNG) |

The image content (the fire-"E" logo and the in-game cover capture) is generated
outside the repo — see [`docs/ART_ASSETS.md`](../../docs/ART_ASSETS.md) for the logo
prompt and how to capture the cover with photo mode (`?shot`). Just drop the two
PNGs here with the exact names above, commit, and the URLs go live on the next
Vercel deploy.
