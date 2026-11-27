# Callout Tests

Back to [[Home]]. This page tests every callout type, combined with links to other pages.

#test/callout

## Built-in Types

> [!NOTE] Note
> Links to [[Reference/Glossary#^term-callout]].

> [!TIP] Tip
> Embedded roadmap: ![[Projects/Roadmap]]

> [!IMPORTANT] Important
> Action items: [[Notes/Meeting-Notes#^action-items]]

> [!WARNING] Warning
> Authentication: [[Reference/API#^auth-section]]

> [!CAUTION] Caution
> Do not confuse with [[Reference/API#^api-errors]].

## Titles

A callout is saved as written (open, save, compare the source): untitled, its built-in icon and
title are shown but not written; with a title of its own, the icon shown before it is not written
either.

> [!NOTE]
> Untitled, as GitHub writes its alerts: the source keeps `> [!NOTE]`.

> [!TIP] A title of its own
> The source keeps `> [!TIP] A title of its own`, without the 💡 shown before it.

## Custom Types

> [!question] Frequently asked question
> What is a wikilink? See [[Reference/Glossary#^term-wikilink]].

> [!faq] Type without a built-in icon
> The custom `faq` type should show its title text.

## Wikilinks and Tags Inside a Callout

> [!NOTE] Mixed content
> - Pages: [[Projects/Vditor]], [[Notes/Daily-2026-06-24]]
> - Embed: ![[Notes/Meeting-Notes]]
> - Tags: #mixed #callout/demo
> - Block reference: [[#^callout-footer]]

Footer block ^callout-footer

This page tests callouts combined with cross-file links.
