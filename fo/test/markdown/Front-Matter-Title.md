---
title: Front Matter Title
tags: [test, front-matter]
---

# A heading the title replaces

The front matter above has a `title:` with a value: as markdownlint reads it (MD025, MD041), it is
this document's top-level heading.

## Steps

| # | Do | Expected |
| --- | --- | --- |
| 1 | Open this file | The toolbar's **Heading 1** is grayed out at once, before any click |
| 2 | Click in this text, open the headings menu, press Ctrl+Alt+1 | **Heading 1** grayed out in the menu; Ctrl+Alt+1 makes no `#` heading |
| 3 | Save (Ctrl+S) | `# A heading the title replaces` is removed from the file; no `# Front Matter Title` is added |
| 4 | Edit the front matter, empty the title (`title:`), save | The empty `title:` key is removed from the file; **Heading 1** usable again once the caret moves |
| 5 | Edit the front matter, give it a title again, save the popup | **Heading 1** grayed out at once |

#front-matter

The tag line above stays `#front-matter` when saved, a tag, even though markdownlint reads it as a
heading missing its space (MD018).
