# History and export parity evidence

The real app exposes DOCX export only. There is no current PDF/CSV entry point to
preserve. Both backend adapters share `lib/export-doc.ts` and
`app/api/export-doc/route.ts`; document generation receives category/items and
never calls a Supabase business RPC. PostgreSQL export transactionally records
history, increments selected product usage, clears checked states and increments
versions. History deletion is a persisted tombstone with usage recalculation.

## Actual application evidence

`attempts/browser-8892301b-67b9-40e1-bbf6-ef3de44ad29e/report.json` passes16groups:
isolated household/two memberships, original modal category/icon CRUD, products,
checking/quantity, refresh, move and second-device convergence, real browser DOCX
download, rejected history deletion preserved across refresh with zero effect,
deliberate retry committed to a PostgreSQL tombstone and usage decrement, third
household isolation, synchronized product/category deletion, and desktop English
plus mobile Hebrew RTL/light/dark/preferences screenshots. The run has11committed
UI mutations with one ledger/outbox per operation. A rejected preacceptance
history delete is a separate failure path, not a claimed committed operation.

The earlier `browser-ba8f460d…` report passed14groups on the initial fixture
household. A later isolated run removed that test-data interference. All failed
selector/alias attempts remain separate and are not relabeled as app failures or
as completed test passes.

## Demonstrated RTL defect and narrow correction

Genuine LibreOffice rendering exposed two defects in the committed export code:
`createColumnTable` reversed the logical array while `bidiVisual` also reversed
physical cells, putting Hebrew category1 at the left. Paragraph `right`
justification combined with bidi rendered on the physical left. Microsoft's
[paragraph-alignment compatibility note](https://learn.microsoft.com/zh-cn/openspecs/office_standards/ms-oe376/26ecf09a-0f0b-4574-9907-ebd1ddf3015f)
explains this historical bidi mirroring behavior.

The feature-branch fix retains logical cell order and uses logical `start`
justification; RTL/LTR paragraph/run flags remain. The visual proof is independent
of the unrelated original checkout's DOCX edits; those files were untouched.

- Before: `attempts/docx-render-5db07fcc-1734-4173-a974-80c4c8c6f6d6/visual-review.json`
  records the failed actual source render, PDF and inspected PNG. Hebrew category
  heading x positions increase1→7, incorrectly starting at the left.
- Corrected actual route: `attempts/export-cdd07dce-699e-4fe4-9bcb-fd81775268e7/report.json`
  passes5cases (Hebrew/English small and four-column plus empty rejection).
  The DOCX inspector verifies category sequence, quantities, landscape and bidi.
- Corrected genuine renders:
  `attempts/docx-render-24586aef-df42-4d28-91f6-510cde36fb03/visual-review.json`
  passes4visually inspected cases. Hebrew headings1/3/5/7 have x≈748/553/358/163pt;
  English remains x≈89/284/479/674pt. Both80-item four-column documents fit one A4
  landscape page; Hebrew small and actual browser-downloaded English DOCX render
  too. PDFs, PNGs, text bounding boxes and page metadata are retained.

`python3 scripts/stage4-docx-render.py --prepare <documents...>` downloads and
extracts official Debian packages only under ignored `.stage0-runtime/docx-render`.
It installs no system package, executes no package maintainer script, changes no
service, and uses a private LibreOffice profile. Omit `--prepare` after setup.
The signed apt index's newer candidate had three missing package objects; the
consistent private renderer is pinned to the available LibreOffice25.2.3.2 build.

This is a Word-compatible LibreOffice check, not execution of Microsoft Word.
The existing title shopping-cart emoji lacks a glyph in the Linux fallback font;
Hebrew/list text, checkboxes and quantities remain readable. No unrelated title or
font redesign was introduced.

## Remaining boundaries

Physical four-column rendering is now demonstrated for the actual source route.
A focused actual-app300-product/80-checked fixture export is planned after the
corrected route reaches Preview, with snapshot-size and SQL/history evidence.
Its result must be recorded separately before claiming that larger browser path.
Google OAuth and principal display names are identity-task limitations, not DOCX
features. History restore uses existing name matching and preserves current
product quantities; it does not invent historical quantity restoration that the
baseline UI did not provide.
