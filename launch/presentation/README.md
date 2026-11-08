# LIFERAFT pitch

Editable Google Slides (9 slides):
https://docs.google.com/presentation/d/1mrTBEsA5OmEym0pYkag8l_cDQqtdVtel6jP3yr9eTG0/edit

Stored in the connected user's ChatGPT folder. All nine Google-rendered slides
were inspected after import. Editable text and diagrams, the actual ESP32 photo,
the original brand mark, and all speaker notes survived conversion.

## Stage flow

- Slides 1–4: 62 seconds. Maya is explicitly a fictional scenario.
- Slide 5: 8 seconds, then switch to the on-site demo. The operator presses
  the pull cord; the cockpit is mission control. The button injects the alarm.
  Only use “Live.” when running the actual drill. For a recording fallback,
  change that label to “Recorded replay” before presenting.
- Resume at slide 6 after the demo. Slides 6–9: 50 seconds.
- Total planned talk: 120 seconds plus demo. Timings are written in the notes;
  this is a script target, not a measured rehearsal time.
- Close: “Training survived.” Then pause.

The closing QR currently targets `http://127.0.0.1:4173`, clearly labelled
LOCAL PREVIEW. It only opens on the presenting computer. It cannot work from
a phone while the site remains local-only. Once publication is approved,
replace the QR with the verified public launch-page URL.

## Rebuilding

`build.mjs` uses the bundled `@oai/artifact-tool` authoring runtime. Set
`LIFERAFT_NODE_MODULES`, `LIFERAFT_PRESENTATIONS_SKILL`, and
`LIFERAFT_RUNTIME_PYTHON` from the workspace dependency loader. Run from the
repository root with the bundled Node executable. It requires `patch.png` and
`qr.png` in `.liferaft/slides-build`, and the ESP32 asset in `launch/dist/assets`.
The QR source was generated with qrcode 8.2. Rasterization uses sharp.

It exports PNGs and a draft, runs the presentation finalizer (package, geometry,
font policy, slide count, and first-party re-import), then writes a new final
PPTX. The finalizer refuses to overwrite an existing final output; choose a new
filename for subsequent revisions. Import a validated file as native Google
Slides and inspect the conversion before replacing the deck above.
