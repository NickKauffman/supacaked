# Putting SupaCaked online (play from anywhere — no shared WiFi)

The game is already a **central server** (Node + Socket.IO relay). It works over the
internet as soon as that server runs on a public host with your domain pointed at it.
No port-forwarding or P2P needed — every phone and TV just talks to the server.

## What you need
- A host that runs an **always-on Node process with WebSockets** (NOT a static/serverless
  host). Easiest: **Render** (free tier). Also fine: Railway, Fly.io, or a small VPS.
- Your domain at GoDaddy: **www.supacaked.com**

## Steps (Render)
1. **Put this folder in a GitHub repo** (it already has `.gitignore`, `Procfile`, `render.yaml`).
   ```
   cd ~/CouchCannons
   git init && git add -A && git commit -m "SupaCaked"
   # create a repo on github.com, then:
   git remote add origin https://github.com/<you>/supacaked.git
   git push -u origin main
   ```
2. On **render.com** → New → **Web Service** → connect the repo. Render reads `render.yaml`
   automatically (build `npm install`, start `npm start`, env `PUBLIC_URL`). It gives you
   HTTPS and a URL like `supacaked.onrender.com`.
3. **Custom domain:** in the Render service → Settings → Custom Domains → add
   `www.supacaked.com`. Render shows a **CNAME target**.
4. **GoDaddy DNS:** in your domain's DNS, add a record:
   - `CNAME`  host `www`  →  the Render target (e.g. `supacaked.onrender.com`)
   - For the bare `supacaked.com`, use GoDaddy **Domain Forwarding** → `https://www.supacaked.com`
     (or the A/ALIAS record Render specifies).
5. Wait for DNS + Render's SSL cert (a few minutes to an hour). Then:
   - **TV/computer:** open `https://www.supacaked.com`, pick a game.
   - **Phones (anywhere):** open `https://www.supacaked.com`, tap a game, join. Done.

`PUBLIC_URL` makes the on-screen QR/join link point at the domain instead of a LAN IP.

## Good to know
- **One shared room.** Right now there is a single global game — anyone who opens the URL
  joins the *same* match. Fine for a private session with friends, but a stranger could wander
  in. Ask me to add **private room codes** if you want each group isolated.
- **Free tier sleeps.** Render's free plan spins down after ~15 min idle (≈30s cold start on
  the next visit). A paid plan or an uptime pinger keeps it warm.
- The controller still says "same WiFi as the TV" — once you're on the domain that's no longer
  required; ask me to update that copy.
