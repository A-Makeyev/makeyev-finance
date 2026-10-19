# Average-rate workbook fixtures

Pinned snapshots of the Bank of Israel's two official average-mortgage-rate
workbooks, downloaded on 2026-10-19:

- `pribmash-2026-10-19.xls` - CPI-indexed mortgages
  (`https://www.boi.org.il/boi_files/Pikuah/pribmash.xls`)
- `mashfix-2026-10-19.xls` - non-indexed mortgages
  (`https://www.boi.org.il/boi_files/Pikuah/mashfix.xls`)

`tests/unit/ratesParse.test.ts` asserts the exact current row and bucket values
from these files, so a parser change that silently reads the wrong column fails
before the page can show a wrong rate.

These are real BIFF8 workbooks and are never fetched by tests. To refresh them,
download the two live files and update the date in the file names and in the
parser test. Check the new header row and column count first: if the BOI changed
the bucket layout, the fixture should stay on the known-good version until the
parser and UI are updated.
