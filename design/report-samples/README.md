# Illustrative Matrix report samples

Open [the sample index](index.html) to inspect the PDF, standalone HTML and Excel files.

These are **output design examples**, not a runtime export service. The fictional **Harbor Service Desk** application is deliberately different from the Payments Hub mock-up. These files are not the result of the job simulated in the Download report dialog. No real requirements, customers, credentials, accounts, repositories or execution results are included. The commit and run identifiers are illustrative.

## One frozen dataset

[fixture.json](fixture.json) is the only source dataset. All formats use snapshot `DEMO-SNAPSHOT-014`, scan `DEMO-SCAN-014` and bundle `DEMO-PACK-014`, captured on **30 October 2026 at 09:00 UTC+04:00**. The generation timestamp is deliberately fixed at 09:05 for reproducible sample artifacts; it does not claim when a user actually generated a file.

| Measure | Value |
|---|---:|
| Requirements | 8 |
| Requirements with a case | 6 |
| Verified passing requirements | 3 |
| Verified automated coverage | 37.5% |
| Awaiting execution evidence | 2 |
| No mapped test | 2 |
| Stale or failing | 1 |
| Open coverage gaps | 5 |
| Test cases / ordered steps | 6 / 19 |

The pinned illustrative run has **3 passed, 1 failed and 1 blocked**; an additional case has no qualifying run. Blocked is not failed, and a case without passing evidence is not verified coverage. No actual tests were executed to create these example outcomes.

## Files and intended use

- **Coverage PDF:** five A4 pages: overview, complete requirement matrix, recovery decisions, a detailed test case and frozen source excerpts. Selectable text, repeating page identity, long-title wrapping and real internal source destinations.
- **Coverage HTML:** one file, no external fonts, scripts, styles or trackers. All six cases and nineteen steps are included. Navigation, source citations and case IDs link to actual embedded anchors and work offline.
- **Coverage Excel companion:** Summary, Requirements, Test evidence and Sources sheets. Values and state counts agree with the PDF and HTML.
- **Test-case Excel workbook:** Summary, Test cases, Steps and Sources sheets. It preserves case revisions, full titles, preconditions, role/data-need references, tags, ordered actions and expected results. This is **not an Octane import template**. Cases are accepted by fictional QA; no UAT sign-off is implied.
- **[manifest.json](manifest.json):** filenames, sizes, SHA-256 hashes, frozen fixture hash and expected counts.
- **[previews/](previews/):** rendered PDF pages and an offline HTML browser capture, used for visual inspection.

Workbook IDs are literal strings, counts and step sequences are numeric cells, and source IDs are internal links to the Sources sheet. Worksheets have filters, frozen headers/key columns, wrapped text and alternating rows. There are no formulas, macros or external links. Source excerpts are clearly identified as synthetic and versioned.

Filenames include application, report family, scan, capture time in UTC and report ID. The coverage PDF/HTML/XLSX share report ID `DEMO-RPT-014`; the related test-case workbook is `DEMO-RPT-015` in the same bundle.

## Reproduce

```bash
python3 design/report-samples/generate.py
python3 design/report-samples/validate.py
```

Run either command from the repository root. The generator also works from another current directory. It requires Python 3 and **ReportLab**; the XLSX writer uses only `zipfile` and XML from the standard library. No package installation or backend scaffold was introduced.

PDFs use locally available **DejaVu Sans** as a readable fallback because IBM Plex is not installed; if DejaVu is unavailable, they use Helvetica. HTML uses the local Arial/sans-serif stack without network loading. File hashes are reproducible on the same generator, ReportLab and font environment. Changing the fixture or fonts intentionally changes the artifacts and hashes.

The validator requires local `pdfinfo`, `pdftotext`, `pdftoppm`, LibreOffice and Playwright with its Chromium browser. It checks fixture relationships/counts, all OOXML package parts, literal strings versus numeric cells, internal workbook links, complete case steps, PDF text/page count, offline HTML anchors and absence of network dependencies. It attempts to open/resave both workbooks through isolated headless LibreOffice profiles in a temporary directory and records an unavailable result if the local environment prevents launch. It renders HTML offline, regenerates the pack and compares artifact hashes. See `validation.json` for the actual results in the validation environment.

**Validation completed on 1 November 2026:** both workbooks opened and resaved successfully in LibreOffice; OOXML content and internal links passed; all 19 steps were preserved; the PDF contains five pages with selectable, complete sample-case text; HTML loaded offline with zero remote requests and all source anchors intact. The HTML had no page-level horizontal overflow at 390px, and the 1280px browser preview is saved in `previews/coverage-html.png`. Regenerating the four artifacts produced identical SHA-256 hashes. PDF pages were visually inspected for wrapping and clipping. The browser/LibreOffice checks required an execution environment that permits those applications to launch; the restricted sandbox alone blocked their startup.

## Validation limits

These samples are output layouts, not a claim that Matrix export jobs, authentication, storage, access checks, cancellation or expiry are implemented. The sample PDF is not tagged or PDF/UA certified. No screen-reader audit or Microsoft Excel desktop test was performed. Workbook structure and content were checked through OOXML inspection; LibreOffice results are recorded separately in `validation.json`. Runtime reporting still needs the contracts and acceptance checks in [REPORTS.md](../../docs/REPORTS.md).
