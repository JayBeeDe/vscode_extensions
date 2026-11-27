# Saved As Written

What Lute drops between the Markdown and the editor, kept on save (issue 15). For each step, in
WYSIWYG then in IR mode: open this file, edit any line, save (Ctrl+S) and compare the source.

[TOC]

## Block IDs

A paragraph with an Obsidian block ID, hidden in the editor. ^saved-para

- A list item with a block ID, shown as text ^saved-item
- An item without one
  - A nested item with a block ID ^saved-nested

1. A numbered item with a block ID ^saved-numbered

> [!NOTE] A callout
> With a block ID. ^saved-callout

## Reference Titles

A [double][double], a [single][single] and a [parenthesized][paren] reference link, each with a
title in its definition (not shown in the editor):

[double]: <https://example.com/double> "Double-quoted title"
[single]: <https://example.com/single> 'Single-quoted title'
[paren]: <https://example.com/paren> (Parenthesized title)

## Steps

| #   | Do                                                                                   | Expected                                                         |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | Save                                                                                 | The `[TOC]` line is kept (written `[toc]`), not turned into code |
| 2   | Save                                                                                 | Every `^saved-…` block ID is kept, the list items' too           |
| 3   | Save                                                                                 | The three definitions keep their titles                          |
| 4   | Type at the end of a definition line in the editor, delete it, save                  | The links still work; the titles are kept                        |
| 5   | In IR mode, select the paragraph "A paragraph with an Obsidian block ID" and copy it | The copied Markdown ends with `^saved-para`                      |
