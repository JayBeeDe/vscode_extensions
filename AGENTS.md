# AGENTS.md

## Project Context

This repository holds several Visual Studio Code extensions, one per top-level folder, each built, run and published on its own:

| Folder    | Name                                                 | What it is                                                                                                                                    | Runs in VS Code for the web | README                               |
| --------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `cacdhc/` | Custom Accentuation Color Dark High Contrast (theme) | VS Code's Dark High Contrast theme with a customizable accent color                                                                           | Yes                         | [cacdhc/README.md](cacdhc/README.md) |
| `fo/`     | foss-office                                          | Editors and viewers for Markdown, Word documents, spreadsheets, Parquet, presentations, PDF, eBooks and xMind, built on open-source libraries | Yes                         | [fo/README.md](fo/README.md)         |
| `gvo/`    | Git View Online                                      | Opens or copies the web URL of a file on its Git platform (GitHub, GitLab, Bitbucket, Forgejo), public or private, hosted or self-hosted      | No                          | [gvo/README.md](gvo/README.md)       |

They are published to the VS Code Marketplace by the GitHub Actions workflow in `.github/workflows/`.

## About me

<!-- TODO: who you are, your role, your level of expertise in the domain,
     anything the agent should tailor its output to -->

## Communication style

<!-- TODO: how the agent should talk to you — tone, verbosity, format
     (e.g. "terse, bullet points, no preamble" or "explain reasoning first") -->

## Rules

- Commits go through the user's `gc` shell function (in `~/.bash_aliases`; check with `bash -ic 'type gc'`). If `gc` is not defined, show instead the plain git commands that do exactly what `gc` would do with its env vars (see the fallback bullet below). Never commit or push without the user's approval. Process:
  - At the end of every request that changed a file versioned in git, the results message always shows the `gc` command(s) (or their plain git fallback) holding the commit message, even when it also asks another question or offers further changes
  - Order of the results message: first the full report of what was done (what changed, what was checked, anything left open), then the commit command(s); the interactive commit prompt, when there is one, always comes last, after that report, never before it
  - If the request ends with no other question for the user, then after showing the commands, ask interactively whether to run them (Yes / No, plus the free-text Other), with the exact commands (`git add …` and `gc …`) written in the question itself so they stay visible while answering. On Yes, run exactly the commands shown (`gc` through `bash -ic '…'`) and report the result; on No, leave them for the user; on Other, follow the answer
  - If the request ends with other questions for the user, only display the commands, without the interactive commit prompt
  - One commit: show only `gc …`. Never show `git add -A`: when nothing is staged, `gc` already runs it. If some files are already staged (e.g. a file removed with `git rm`), `gc` does not stage the rest: then show `git add <files>` first, or the commit holds only what was staged
  - Several commits (only when no file holds changes belonging to more than one commit): show `git add <files>` before each `gc …`, in order, the first one included, even when its files are already staged. A deleted file is staged with `git rm -q --cached --ignore-unmatch <file>` instead: `git add` fails on a deletion that is already staged. Never rely on what is staged at the time: if the first `gc` finds nothing staged, it stages and commits every change, those of the later commits too
  - Fallback when `gc` is not defined, mirroring it: `git add -A` for a single commit (since `gc` stages everything when nothing is staged), or `git add <files>` before each commit when there are several; then `git commit [-s] [-S] -m "<type>(<component>): <subject>" --no-verify` (add `-m "ref: #<number>"` when `ISSUE_REF` would apply); then `git push --no-verify origin <current branch>` once after the last commit. Build them from the env vars as currently set (`bash -ic 'env'`), not from assumed values: `-s` only if `SIGNED_OFF` is set, `-S` only if `SIGNED_GPG` is set, the push only if `AUTO_PUSH=1` and `LOCAL_GIT` is not `1`. Same type, component and message rules as `gc`
  - Usage: `gc "<component>" "<subject>"` writes the first line as `<type>(<component>): <subject>`. Always pass both arguments: with one, the component becomes `dedicated`
  - Component convention, built from the files the commit touches (as the git history does):
    - A file in an extension's folder takes that folder's name: `cacdhc`, `fo`, `gvo`. For `fo`, the subject also names the part changed (see the next bullet)
    - A file in `.github/` (the publishing workflow and its scripts) takes `ci`
    - A root file changed on its own takes its name without leading dot or extension: `AGENTS.md` → `AGENTS`, `README.md` → `README`, `.gitignore` → `gitignore`, `LICENSE` → `LICENSE`
    - A root file changed for an extension (its line in the root `README.md` table, its `.gitignore` entries, a plan or note about it) takes that extension's component, not its own: the commit is about the extension
    - Several components are comma-separated and sorted alphabetically: `ci,fo`
    - Never use catch-all components (`chore`, `dedicated`, `misc`)
  - `fo` subcomponent: the component stays `fo`, and the subject of a `fo` commit always ends by naming the part of foss-office it changes, so that a reader of the history can tell it at a glance: `fix(fo): keep html blocks intact in the markdown editor`, `feat(fo): add a setting to block google fonts in the document editor`. The parts are the features of the "Supported formats" table in [fo/README.md](fo/README.md#supported-formats) (its "Feature" and "Mode" columns say whether each one is an editor or a viewer). A change shared by several of them ends with "in all viewers", or says what it is about ("in the build", "in the translations"); a change to `fo/README.md` alone, "in the readme"
  - Whether through `gc` or the `git commit -m` fallback: the commit message is always a single line, as short as possible, with no body and no `Co-Authored-By` trailer. It must be at most `MAX_CHARS` characters, `MAX_CHARS` being its default value as currently exported (`bash -ic 'echo $MAX_CHARS'`); avoid overriding `MAX_CHARS`. The `fo` part's words count in it: " in the presentation viewer" alone takes 27 characters
  - The subject is lowercased, except text wrapped in `¤…¤`. A third argument is ignored
  - `<type>` comes from the branch prefix (`fix`, `feat`, `test`, `specs`, `docs`), otherwise `fix`. `ISSUE_TYPE=<type>` overrides it. Choose the type from the change itself, without asking: `feat` for a new capability (a setting, a button, a viewer, a section of documentation), `fix` for a correction or an adjustment of existing behavior (including removing something), `docs` for documentation or agent instructions alone, `test` for tests alone
  - Leave `ISSUE_REF` empty, unless the commit resolves a GitHub issue whose number is not in the current branch name: then prefix the call with `ISSUE_REF=<issue number>` (e.g. `ISSUE_REF=1` for issue #1), which adds a `ref: #<number>` line
  - Never override the other env vars in the commands shown: `SIGNED_GPG`, `AUTO_PUSH`, `SIGNED_OFF`, `LOCAL_GIT` and `DEBUG` always keep their default values. By default `gc` signs with GPG (`SIGNED_GPG=1`), pushes right after the commit (`AUTO_PUSH=1`) and always passes `--no-verify`
- GitHub issues (repository `JayBeeDe/vscode_extensions`), whether created from work here (a plan, a bug found) or worked on here:
  - Label: the extension's folder name (`cacdhc`, `fo`, `gvo`), as for the commit component; one label per extension concerned
  - Issue type, chosen from the content without asking: `Feature` for a new capability (the commit type `feat`), `Bug` for a correction (`fix`), `Task` otherwise
  - Always set both when creating an issue, and check them on an existing issue before working on it. The installed `gh` is old (no `gh label`, no `--type`): set them through the API, e.g. `echo '{"labels":["fo"]}' | gh api -X POST repos/JayBeeDe/vscode_extensions/issues/<number>/labels --input -`, and for the type the GraphQL mutation `updateIssueIssueType` with the issue's node id and the type's id (`repository { issueTypes(first: 20) { nodes { id name } } }`)
  - Working on an issue: its label gives the commit component, its type the commit type, and its number goes in `ISSUE_REF` when not in the branch name

## File Naming Convention

- Extension folders are named from the extension's initials: `cacdhc` (Custom Accentuation Color Dark High Contrast), `fo` (foss-office), `gvo` (Git View Online)
- TypeScript modules in camelCase (`linkHoverTooltip.ts`), React components in PascalCase (`Word.tsx`)
- LESS partials start with an underscore (`_panel.less`) and are imported by `index.less`
- Test samples go in `fo/test/<viewer>/`, one folder per viewer (see `fo/test/README.md`)

## Folder structure

```
.
├── .github/workflows/   publishing to the VS Code Marketplace
├── cacdhc/              the theme
├── fo/                  foss-office
└── gvo/                 Git View Online
```

## Agent behavior

- Run, from the extension's folder: `npm run build` after every change (it also builds `fo/vditor/`), `npm run lint`, and for `fo` `npm run i18n:check`
- A user-facing string of `fo` goes in all 8 `fo/i18n/<language>.json`; `fo/vditor/src/js/i18n/` is generated from them at build time (git-ignored): never edit it
- Check a change in a real browser before reporting it done: for `fo`'s Markdown editor, a page loading `fo/resource/markdown/dist/` driven by `puppeteer-core` with the installed Chromium (`/usr/bin/chromium-browser`). That Chromium is a snap: it cannot read `/tmp` nor hidden folders, so the test page and scripts go in `fo/sandbox/<subfolder>` (git-ignored), the subfolder named after the GitHub issue worked on (`issue-16`), or a short topic when there is none (`presentation-timer`). When the task is done, ask the user whether to keep or remove that subfolder, just before the commit prompt
- Say what was tested and how, and what was not (e.g. "not tried in VS Code itself")
- Every new feature of `fo` comes with a sample file under `fo/test/` that shows it, so it can be tried by hand: in the viewer's folder (`fo/test/<viewer>/`). The Markdown samples are written by hand in `fo/test/markdown/` and listed in its `README.md`. The other viewers' samples are generated: change `fo/test/sources/` (for the `.docx`, `.pptx` and `.epub`) or `fo/test/generate-samples.mjs`, run `node test/generate-samples.mjs`, and describe what to check in `fo/test/README.md`
- Screenshots: when a change alters anything visible in a screenshot shown in an extension's `README.md` (`fo/images/screenshot-*.png`, `cacdhc/images/screenshots.png`, `gvo/images/screenshots.png`), every affected screenshot is updated too, each one taken again the way it was made (for `fo`, both the light and the dark high contrast one, from the same sample file, e.g. `fo/test/markdown/Showcase.md` for the Markdown editor). A screenshot that cannot be taken again faithfully (VS Code itself, a theme, a composite such as `cacdhc/images/screenshots.kra`) is listed in the results message as out of date, for the user to update

## Success Criteria

- The build passes, the lint and (for `fo`) the i18n check report no error
- The change was checked working, in a browser or in the dev window (`npm run desktop`)
- A user-visible change (setting, behavior, internet access) is reflected in the extension's `README.md`
- The screenshots showing what changed are updated, or listed as out of date
- A new `fo` feature has its sample under `fo/test/`
- The results message ends with the commit command(s), following the rules above
