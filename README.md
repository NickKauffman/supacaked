# 🎯 Couch Cannons

A 2–8 player party artillery game — like Pocket Tanks, but for a room full of friends.
The **game plays on your TV** (a computer plugged in via HDMI), and **everyone aims with their phone**. No app to install, no controllers to buy. Last tank standing wins.

---

## What you need

- A computer plugged into your TV (HDMI), with [Node.js](https://nodejs.org) installed (v18 or newer).
- Everyone's phones on the **same WiFi** as that computer.

## Run it (one time setup)

Open a terminal in this folder and run:

```bash
npm install
npm start
```

You'll see something like:

```
  🎯  Couch Cannons is live!

  TV (this computer):  http://localhost:3000
  Phones join at:      http://192.168.1.42:3000/play
  Room code:           WXYZ
```

## Play

1. **On the TV computer**, open `http://localhost:3000` in a browser and make it fullscreen (press `F11`, or `Ctrl/Cmd+Shift+F`). You'll see the lobby with a QR code.
2. **Each player** scans the QR code with their phone camera (or types the `Phones join at` address into their browser), enters a name, and taps **Join**.
3. When at least 2 players are in, the **first player to join** gets a **START** button on their phone.
4. On your turn: set **angle** and **power** with the sliders, pick a **weapon**, and smash **FIRE**. Watch your shot arc across the TV.
5. Knock everyone else out. Last tank standing wins, then the first player can start a rematch.

> Tip: the TV shows a dotted preview of where the active player is aiming, plus the wind for that turn. Wind changes every turn — lead your shots.

---

## Weapons

| Weapon | Ammo | What it does |
|---|---|---|
| **Single Shot** | ∞ | Reliable round, small crater. |
| **Big Shot** | 3 | Heavier shell, wider blast. |
| **Cluster** | 2 | Splits into 5 bomblets on impact. |
| **Roller** | 2 | Lands, rolls downhill, then detonates — great for tanks tucked in valleys. |
| **Digger** | 2 | Drills a deep shaft; drops dug-in tanks (and can drop *you*). |
| **Nuke** | 1 | Massive blast. One per tank — make it count. |

The ground is fully destructible, so every shot reshapes the battlefield.

---

## How it's built

- **`server.js`** — a tiny relay (Express + Socket.IO). It serves the two pages, tracks who's connected, and passes messages between the TV and the phones. It does **not** run the game.
- **`public/host.html`** — the TV. Runs the entire simulation (terrain, physics, turns, weapons) and rendering. This is the source of truth.
- **`public/controller.html`** — the phone. A thin controller: sends angle/power/weapon/fire, shows whose turn it is and your health.

Because the server only relays on your local network, aiming feels instant.

### Troubleshooting

- **Phones can't connect?** They must be on the *same WiFi* as the TV computer. Corporate/guest networks sometimes block device-to-device traffic — use a home router or a phone hotspot.
- **QR won't scan?** Just type the `Phones join at` address into a phone browser.
- **Reloading the TV** starts a fresh match. Phones that sleep or drop will automatically rejoin their tank.
- **Change the port:** `PORT=4000 npm start`.

Have fun. Rename it, retheme it, add weapons — it's yours.
