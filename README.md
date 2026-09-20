# Parts

An offline-first inventory for the drawer of sensors, modules and boards on your bench.

Add a component once and you stop rediscovering it: what it is, whether it works, how many
are left, what it cost, how it wires up, which box it lives in, and who borrowed it. The whole
app is one HTML file with no build step, no framework and no dependencies. It installs as a
PWA, runs with the network off, and syncs to Firebase across every device that knows your
password.

---

## Contents

- [Quick start](#quick-start)
- [Hosting on Firebase](#hosting-on-firebase)
- [Firestore setup](#firestore-setup)
- [How the password works](#how-the-password-works)
- [Features](#features)
- [Bulk entry syntax](#bulk-entry-syntax)
- [Files](#files)
- [Data model](#data-model)
- [Where data is stored](#where-data-is-stored)
- [Customising](#customising)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Drop every file in this folder onto any static host and open it. That's the whole install.

```bash
# local preview — a real HTTP origin is required for the service worker
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` straight from disk works too, but the service worker and install prompt
won't be available, so there's no offline cache and no home-screen icon.

---

## Hosting on Firebase

The app already points at the `bench-stock` project, and `firebase.json`, `firestore.rules` and
`firestore.indexes.json` are included and ready to deploy as-is.

```bash
npm install -g firebase-tools
firebase login
firebase use bench-stock     # or: firebase init, pointing at this folder
firebase deploy              # ships hosting + Firestore rules together
```

`firebase.json` keeps the custom 404, sets long cache lifetimes on icons, and marks
`index.html`, `manifest.json` and `sw.js` as `no-cache` so a redeploy is picked up immediately
instead of waiting out a browser cache.

Firebase Hosting serves `404.html` automatically for unknown paths. Do **not** add a catch-all
rewrite to `index.html` — the service worker already keeps the installed app from ever landing
on a dead page, and the 404 card is what you want for stray links.

If you deploy somewhere else, update the URLs in `sitemap.xml`, `robots.txt` and the
`canonical` / `og:url` tags at the top of `index.html`.

---

## Firestore setup

Two things must be switched on in the Firebase console.

**1. Anonymous authentication** — Build → Authentication → Sign-in method → Anonymous → Enable.
The app signs in silently; nobody ever sees a login screen.

**2. Firestore rules.** The database is in production mode, so it denies everything until you
deploy rules. This repo includes them ready to go:

```bash
firebase deploy --only firestore:rules
```

`firestore.rules` grants read/write only to a vault path that looks like a real password hash
(32 lowercase hex characters) and validates the basic shape of every part document, so a
compromised or buggy client can't corrupt what other devices see:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /vaults/{vaultId}/parts/{partId} {
      function validVault() { return vaultId.matches('^[a-f0-9]{32}$'); }
      function validPart() {
        let d = request.resource.data;
        return d.keys().hasAll(['name','status','updated'])
          && d.name is string && d.name.size() > 0 && d.name.size() < 200
          && d.status in ['working','faulty','untested']
          && d.updated is number;
      }
      allow read: if request.auth != null && validVault();
      allow create, update: if request.auth != null && validVault() && validPart();
      allow delete: if request.auth != null && validVault();
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

Want it pinned to one specific inventory instead of any valid-looking hash? Swap the
`validVault()` body for `vaultId == 'paste-your-vault-id-here'`. Find your vault id in the
browser console after connecting: `JSON.parse(localStorage['parts.cfg.v1']).vault`.

---

## How the password works

There is no account, no email and no reset link.

1. You type a password in Settings → Sync password.
2. The app hashes it with SHA-256 (`parts::<password>`).
3. The first 32 hex characters become the Firestore path: `vaults/<id>/parts/*`.
4. The remaining characters are kept locally so a wrong password can be rejected offline.

Type the same password on a phone, a laptop and a tablet and all three land in the same vault —
that's the whole point. **The password itself never leaves the device**, and it can't be
recovered, so write it down somewhere.

Settings → *Ask for password on open* turns the launch screen on if you want the app locked on
a shared device. Settings → *Leave this vault* disconnects without touching your local copy.

Sync is last-write-wins on a per-part `updated` timestamp, in both directions, on every save
and on pull-to-refresh. Edits made offline are queued and merged the next time you're online.

---

## Features

**Tracking**
- Working / not working / untested, cycled by tapping the pill on any card
- Quantity with a stepper, plus a *warn below* threshold that raises a Low stock badge and filter
- Price per unit, with a running total in the header and a currency picker
- Date added, storage location, free-form tags, and notes
- Wiring and pinout in a monospace field, rendered on the card
- Datasheet or product link, shown as a tappable domain chip
- A photo per part, captured from the camera or picked from the library

**Lending**
- Who has it, how many, when it went out, when it's due back, and a note
- Overdue items are flagged; a *Lent out* filter and a breakdown list show everything on loan
- One button marks a part returned

**Organising**
- Search across name, category, tags, box, pinout and borrower
- Filter by condition, category, tag, low stock or lent out
- Six sort modes including grouped-by-category with section headers
- Editable category list — add your own from the dropdown or in Settings
- Bulk entry from a pasted list, and a 24-item starter kit for a cold start

**Everything else**
- Editable palette: seven presets plus a colour picker for background, text and each state colour
- Swipe a card for Edit / Copy / Delete, with undo on every destructive action
- Pull down to sync
- Breakdown sheet with units by category and by storage box
- JSON backup (photos included) and CSV export
- Fully offline once installed; installs to the home screen on Android, iOS and desktop

---

## Bulk entry syntax

Settings → *Add many at once*. One part per line:

```
HC-SR04 ultrasonic x4 @85 #Sensor (Drawer A)
SG90 servo x2 !working
ESP32 devkit @450
10k resistor x50 #Passive
```

| Token | Meaning | Example |
| --- | --- | --- |
| `x4` or `4x` | quantity | `LED assortment x50` |
| `@85` | price per unit | `ESP32 @450` |
| `#Sensor` | category (any of yours) | `#Passive` |
| `!working` `!faulty` | condition | `!faulty` |
| `(Drawer A)` | storage location | `(bin 3)` |

Anything you leave out is inferred. The category guesser reads the name, so *SG90 servo* lands
in Actuator and *ESP32 devkit* in Board. Condition defaults to untested. One undo removes the
whole batch.

---

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup only — links `styles.css` and `app.js` |
| `styles.css` | Every style: tokens, liquid glass, layout, sheets, animation |
| `app.js` | All logic: store, rendering, gestures, sync, theming |
| `sw.js` | Service worker: offline cache and navigation fallback |
| `manifest.json` | Install metadata, icons, shortcuts |
| `404.html` | Custom not-found page in the same glass style (self-contained, no external CSS/JS by design — it has to render even if the other files fail to fetch) |
| `firebase.json` | Hosting + Firestore config — file layout, cache headers |
| `firestore.rules` | Production-mode security rules for the vault sync model |
| `firestore.indexes.json` | Empty index file Firebase expects to find |
| `robots.txt`, `sitemap.xml` | Search engine directives |
| `icon-*.png` | App icons — `any` and `maskable` variants |
| `apple-touch-icon.png` | iOS home screen icon |
| `favicon-32.png` | Browser tab icon |

All of `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.json`, `404.html` and the icons must be deployed together, in the same folder, for the app to work — `index.html` fetches the other two at load time.

Icons are drawn with a generous safe area, so the maskable set stays intact under circle,
squircle, rounded-square and teardrop masks.

---

## Data model

```js
{
  id: "m4k2p9xq",        // generated locally
  name: "DHT22 temperature sensor",
  type: "Sensor",        // one of your categories
  status: "working",     // working | faulty | untested
  qty: 3,
  min: 1,                // warn at or below this, 0 = never
  price: 120,            // per unit, null when unset
  date: "2026-04-18",    // date added
  box: "Drawer B",
  tags: ["i2c", "3v3"],
  lentTo: "Ravi",        // "" when nothing is out
  lentQty: 1,
  lentOn: "2026-05-02",
  lentDue: "2026-05-16",
  lentNote: "robotics club demo",
  url: "https://…",      // datasheet
  pins: "VCC → 3.3V\nDATA → D4",
  note: "one of three reads high",
  photo: true,           // photo bytes live in IndexedDB under this id
  created: 1745000000000,
  updated: 1745000000000 // drives sync conflict resolution
}
```

---

## Where data is stored

| What | Where | Synced |
| --- | --- | --- |
| Parts | `localStorage` → `parts.v1` | yes, to Firestore |
| Settings, palette, categories, vault id | `localStorage` → `parts.cfg.v1` | no, per device |
| Photos | IndexedDB → `parts-media` | no — included in JSON backups |

Photos stay local on purpose: base64 images would blow past Firestore's 1 MB document limit and
run up your storage bill. Move them between devices with a JSON backup, or wire up Firebase
Storage if you'd rather have them synced.

---

## Performance

A scrolling list of glassy cards is expensive by default, so a few things keep it smooth even
with a few hundred parts:

- **Two glass tiers.** The full effect — an SVG-displaced backdrop, layered blended texture,
  a nine-layer shadow stack — only runs on the handful of always-static chrome elements
  (header, dock, sheets, dialogs). Every list row uses `.lgc`, a lighter tier: one
  `backdrop-filter` pass, four shadow layers, no blend modes, no SVG filter. It reads the same
  from a normal viewing distance and costs a fraction as much per element, which matters once
  you're painting it a hundred times over in a list.
- **`content-visibility: auto` on every row**, so the browser skips layout and paint entirely
  for cards outside the viewport instead of maintaining all of them live.
- **A static SVG filter.** The glass warp used to animate its noise field on an endless 26s
  loop, which forced a continuous, whole-surface repaint on the always-visible header and dock
  even when nothing was happening. It's now computed once and reused.
- **A smaller blur radius** (7px, down from 9px) on every glass surface — cheaper to sample,
  particularly on the `position: sticky` header, which resamples its backdrop on every scroll
  frame by nature of being sticky.
- **`requestAnimationFrame`-batched drag updates**, so a fast swipe writes at most one transform
  per frame instead of one per pointer event.
- **A debounced search box** (110ms) so typing doesn't rebuild the entire list on every
  keystroke.
- **`will-change: transform` only while a row is actually animating** — not parked on every
  card permanently, which would otherwise reserve a GPU compositing layer for each one whether
  it's moving or not.

If it's still heavy on a specific device, the biggest remaining lever is the blur radius in
`.lgc` and `.lg` in `styles.css` — dropping either further (or to 0, i.e. a flat translucent
panel) costs very little visually and recovers real frame time on low-power hardware.

---

## Customising

**Palette** — Settings → Palette. Presets, or a colour picker for background, text, working,
not working, untested and low stock. Everything in the interface derives from those six values,
including the dark *Carbon* preset.

**Categories** — add from the dropdown in the editor (`＋ New category…`) or in Settings.
A category in use can't be deleted; the app tells you how many parts hold it.

**Starter kit** — edit the `KIT` array in `index.html` to match what actually came in your box.

**Motion** — all animation runs through one `spring()` function. Raise `stiffness` for snappier,
raise `damping` to cut the overshoot. `prefers-reduced-motion` is respected throughout.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New part |
| `/` or `⌘K` / `Ctrl+K` | Focus search |
| `⌘↵` / `Ctrl+Enter` | Save the open part |
| `Esc` | Close sheet, dialog or open row |

---

## Troubleshooting

**Sync says "Sync failed".** Anonymous sign-in isn't enabled, or the Firestore rules still deny
writes. Both are in [Firestore setup](#firestore-setup).

**A second device shows an empty list.** The password has to match exactly — it's case
sensitive, and a trailing space counts. Wrong passwords open a different empty vault rather than
erroring, by design.

**Install button never appears.** It only shows when the browser offers one: HTTPS, a reachable
`manifest.json`, and a registered service worker. On iOS, use Share → Add to Home Screen.

**Photos vanished.** Clearing site data wipes IndexedDB. Restore from a JSON backup.

**Changes don't show after a deploy.** The service worker serves the cached copy first. Reload
twice, or bump `VERSION` in `sw.js` on every release.

**Edited `styles.css` or `app.js` and nothing changed.** Same cause — bump `VERSION` in `sw.js`,
or hard-reload (`Cmd+Shift+R` / `Ctrl+Shift+R`) to bypass the service worker during development.

---

MIT licensed. Built to be read and edited — it's one file, go change it.
