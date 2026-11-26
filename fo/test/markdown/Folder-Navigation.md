# Folder Navigation

Tests for browsing folders in the Markdown editor: the **Browse Folder** entry, the **Previous** link and the README shown under a folder's listing. The folders are in [Folders/](Folders/).

The **Previous** link sits in the right cell of the listing's first row, across from `..`. It appears when a folder page opens in the place of another folder page, goes back to that page, and works once: the page it goes back to has no **Previous** of its own.

## Steps

| # | Do | Expected |
| --- | --- | --- |
| 1 | Click [Folders/](Folders/) | The `Folders` page opens in a new tab, with no **Previous** (it was opened from a Markdown file) |
| 2 | In that page, click `With README.markdown/` | Its page replaces the `Folders` page in the same tab, shows its `README.markdown`, and **Previous** goes back to `Folders` |
| 3 | Click `Nested/` | **Previous** goes back to `With README.markdown` |
| 4 | Click **Previous** | Back to `With README.markdown`, now with no **Previous**: it only works once |
| 5 | Click `..` | The `Folders` page, whose **Previous** goes back to `With README.markdown` |
| 6 | Click `With plain README/` | Its `README` is shown as plain text in a code block, the outline sidebar stays closed, and **Previous** goes back to `Folders` |
| 7 | Click `..`, then `Without README/` | Only the listing, the outline sidebar stays closed, and **Previous** goes back to `Folders` |
| 8 | Ctrl+click (⌘+click on macOS) `..` | The `Folders` page opens in a new tab, with no **Previous** |
| 9 | In the Explorer, right-click `test/markdown/Folders` and choose **Browse Folder** | The `Folders` page, with no **Previous** |
| 10 | Command Palette, **Browse Folder** | The workspace folder's page, with no **Previous** |

## Notes

- The **Previous** link has a left arrow icon; `..` has the parent folder icon.
- Folder names with spaces (`With README.markdown`, `With plain README`) check that the links are encoded.
- With `foss-office.markdown.sidebar` set to `auto`, the outline opens for `Folders` only if it has a Markdown README: it has none, so it stays closed too.
