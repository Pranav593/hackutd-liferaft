# LIFERAFT launch page

Standalone, buildless static site. It has no backend, signup flow, iframe,
coordinator connection or live replay fetch. Serve `dist/` on any static host
when publication is approved. User requested **local only** on 2026-11-08.

From the repository root on Windows:

```powershell
.venv/Scripts/python.exe -m http.server 4173 --bind 127.0.0.1 --directory launch/dist
```

Open http://127.0.0.1:4173. Loopback is accessible only on this computer.

## Content and media

- Maya is a fictional scenario; the footer clock is explicitly fictional.
- `dist/assets/rescue.webm` is a 10-second, 100-frame recording of the actual
  cockpit replay, not a live feed. Reduced motion starts it paused.
- Screenshots and recording use the current redacted `replay.local-job.json`
  fixture: 20 events, checkpoint 30 → first resumed step 31, epoch 1 → 2.
  Local-adapter evidence, legacy/unanchored journal. The journal does not
  independently attest physical computer identity or rehash checkpoint bytes.
- The source cockpit uses the current working-tree design. Its screenshots
  are kept faithful even where its palette differs from the navy launch page.
- `esp32.png` is the team's actual ESP32 video frame (`video-2-49.png`), not a
  generated product photo. Used in the presentation.
- `patch.svg` is an original LIFERAFT brand mark. It is not a third-party logo
  or a certification. Vendored font licenses accompany the fonts.
- GitHub and the HackUTD Devpost event link were supplied by the user. The
  event link is not represented as a LifeRaft project submission.
- No pilot email was supplied. The mailto draft intentionally has an empty
  recipient and a visible explanation. Set its recipient and remove that
  explanation when the team supplies an address; no signup backend needed.

## Rebuild the recorded assets

With the cockpit already serving on port 3001:

```powershell
node scripts/capture-launch.cjs
node scripts/encode-launch.cjs
node scripts/check-launch.cjs
```

Capture intercepts the cockpit API with the checked-in redacted fixture at
build time only. The public site's source contains no fixture or API client.
The encoder uses the existing Playwright FFmpeg installation and sharp.
Chrome and the existing project development dependencies are needed for QA.
QA results and full-page screenshots are saved under ignored `.liferaft/`.

## Future publishing

Publish only `launch/dist`, not the repository or local cockpit. Set the pilot
recipient, approve a hosting deployment, and replace the presentation QR's
local URL with the verified public URL. Do not remove or weaken the cockpit
Host restriction to make marketing media work.
