# Poolantir

Real-time restroom facility monitoring and maintenance reporting system, built as a native iOS app using React + Capacitor.

## What it does

Poolantir connects facility managers and users around a live view of restroom stall availability and maintenance status, backed by Firebase Firestore with real-time sync across all devices.

### User view
- Browse all restroom blocks and their locations
- Tap into any restroom to see the live status of every stall and urinal (Online / Offline)
- Submit a maintenance report (clogged, no paper, broken lock, unclean, other) directly from the app — alerts go to the admin queue instantly

### Admin dashboard
- **Overview** — usage heatmap by facility zone and an anomaly feed (offline nodes, underperforming sensors)
- **Issues** — live queue of pending maintenance reports with one-tap resolve
- **Sensors** — manage every restroom block and its stalls:
  - Add / delete restroom blocks
  - Provision new stall or urinal nodes with label and type
  - Delete individual nodes (cascades cleanly in Firestore)
  - Toggle node status between Online and Offline

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 19, Tailwind CSS v4, Framer Motion |
| Native shell | Capacitor 7 (iOS / WKWebView) |
| Auth | Firebase Auth — Google Sign-In via native iOS flow (`@capacitor-firebase/authentication`) |
| Database | Firebase Firestore (real-time listeners) |
| Build | Vite 6 |

## Local development

**Prerequisites:** Node.js, Xcode (for iOS)

```bash
npm install
npm run dev        # starts Vite dev server at localhost:3000
```

## iOS build

```bash
npm run build      # compile web app → dist/
npx cap sync ios   # copy assets into Xcode project
npx cap open ios   # open in Xcode
```

Then select your device / simulator and hit Run in Xcode.

After any code change:
```bash
npm run build && npx cap sync ios
```

## Firestore security

Rules are in `firestore.rules`. Deploy with:
```bash
firebase deploy --only firestore:rules --project <your-project-id>
```
