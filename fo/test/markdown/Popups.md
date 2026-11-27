---
Title: Popups
tags: [obsidian, test, popups]
aliases: [Popup Samples]
published: true
authors:
  - foss-office
  - Vditor
draft:
---
# Popups

One sample per popup of the Markdown editor, in WYSIWYG mode. Edit each one in its popup, save the file and check that the Markdown source is still the same.

## Front Matter

The front matter above is shown as a properties panel: text, tags, aliases, a boolean, a list and an empty value. It is edited like HTML, in the same popup as the HTML editor:

- WYSIWYG: the panel's text can be selected and copied; its tooltip says how to edit it. A click puts the caret after the panel; `Alt+click` on it, or `Alt+Enter` beside it, opens its YAML
- IR: a click on the panel opens its YAML
- While the YAML is edited, `---` shows in the left margin, as `</>` does for an HTML block
- In the popup: `Alt+Enter` or **Save** draws the panel again from the YAML; `Escape` or **Cancel** closes it unchanged
- `Tab` inserts a tab, `Shift+Tab` removes one level of indentation
- The line wrap button (tooltip "Toggle line wrap") unwraps the long lines, for this edit only
- Emptying the YAML and saving removes the front matter
- Scrolling the panel out of view closes the popup without saving

## Link

`Alt+click` or `Alt+Enter` on [the foss-office repository](https://github.com/JayBeeDe/vscode_extensions "A tooltip") opens its text, URL and tooltip.

## Reference Link

`Alt+click` or `Alt+Enter` on [the Vditor project][vditor] opens its text and label. A [collapsed reference][collapsed reference] and a shortcut one, [CodeMirror][CodeMirror], too.

[vditor]: <https://github.com/Vanessa219/vditor>
[collapsed reference]: <https://commonmark.org/>
[CodeMirror]: <https://codemirror.net/>

## Image

A click on the image opens its source, alt text and tooltip:

![The foss-office logo](../../images/logo.png "A tooltip")

## Inline HTML

`Alt+click` or `Alt+Enter` on <kbd>Ctrl</kbd>+<kbd>S</kbd>, on <mark>marked text</mark> or on <span style="color: #d14;">red text</span> opens the HTML editor.

## HTML Block

`Alt+click` or `Alt+Enter` on the block below opens the HTML editor:

<details>
<summary>Click to unfold</summary>

The hidden text of an HTML block.

</details>

<div align="center">
  <img src="../../images/markdown.png" width="48" alt="markdown">
  <p>A centered HTML block with an image</p>
</div>

## Footnote

The cursor in the footnote reference opens its label; `Alt+Enter` goes back to the text.[^popup]

[^popup]: The footnote text.

## Code Block

A click on the language tag, or `Alt+Enter` in the code, opens the language picker:

```python
def greet(name):
    return f"Hello, {name}!"
```

## Table

The handles on the table's edges open the row and column menus:

| Popup | Opens with               |
| ----- | ------------------------ |
| Link  | `Alt+click`, `Alt+Enter` |
| Image | A click                  |
| HTML  | `Alt+click`, `Alt+Enter` |

Back to [[Home]].
