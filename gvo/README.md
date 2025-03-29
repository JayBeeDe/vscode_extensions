# Git View Online (GVO)

<div style="text-align: center;">
    <img src="https://raw.githubusercontent.com/JayBeeDe/vscode_extensions/refs/heads/master/gvo/images/logo.png" title="Git View Online (GVO)" alt="Git View Online (GVO)" width="256" height="256" />
</div>

This vscode extension can be used to open or copy the URL to the file of a Git-based Web platform such as GitHub, GitLab, Bitbucket, no matter whether public/private, self hosted/on premise.

<div style="text-align: center;">
    <img src="https://raw.githubusercontent.com/JayBeeDe/vscode_extensions/refs/heads/master/gvo/images/screenshots.png" title="Screenshots" alt="Screenshots" />
</div>

## Installation

* In vscode: &nbsp;&nbsp;&nbsp;&nbsp;`ext install JayBeeDe.git-view-online`

* In the shell: &nbsp;`code --install-extension JayBeeDe.git-view-online`

## Configuration

This extension can perform 2 different commands.

|Command|Description|
|:---:|:---:|
|`gitViewOnline.copyUrl`|Copy the URL that targets a file of a Git-based Web platform|
|`gitViewOnline.openUrl`|Open the URL target to the file of a Git-based Web platform|

There are multiple ways to trigger those 2 commands:

- from the command palette
- from a keyboard shortcut (see below)
- from the contextual menu (right click) of the explorer view

If applicable, the extension will also target the selected line(s)

### Keybindings

You can override the following default keybindings:

```json
[
  {
    "command": "gitViewOnline.openUrl",
    "key": "ctrl+b",
    "when": "editorTextFocus"
  },
  {
    "command": "gitViewOnline.copyUrl",
    "key": "ctrl+shift+b",
    "when": "editorTextFocus"
  }
]
```

### Settings

Here is the list of the settings, their scopes and their default values:

|Scope|Name|Type|Default value|Description|
|:---:|:---:|:---:|:---:|---|
|`*`|`gitViewOnline.gitPath`|string|`git`|Binary or absolute path to the git binary|
|`*`|`gitViewOnline.providers`|array of objects|See below|Custom Regexp to transform git remote URLs|
|`*`|`gitViewOnline.forceCommitHash`|boolean|`false`|If enabled, always use commit hashes rather than branch name|
|`copyUrl`|`gitViewOnline.copyLinkType`|string (enum)|`raw`|Link type format: raw, markdown, jira, html|
|`copyUrl`¹|`gitViewOnline.copyLinkTitleFormat`|string|`{{ filePath }} {% if lines == 1 %}line {{ line }}{% elif lines > 1 %}lines {{ lineStart }} to {{ lineStop }} {% endif %}{% if branch is defined %}{{ branch }} branch{% else %} commit {{ hashShort }}{% endif %} in {{ repoType }} repo {{ repoPath }}`|Jinja template to customize URL title.<br />You can use the following built-in variables: `filePath`, `dirName`, `fileName`, `repoPath`, `repoDir`, `repoName`, `repoType`, `branchOrCommit`, `hashLong`, `hashShort`, `branch`, `line`, `lines`, `lineStart`, `lineStop`, `baseUrl`, `url` |

__

¹ not applicable when `gitViewOnline.copyLinkType` set to `raw`

#### Providers

`gitViewOnline.providers` is an array of Regexp used to transform the remote URL from the git command to the URL of the Git-based Web platform

This setting has the following value by default:

```json
[
  {
    "remoteUrl": "^(git@|https://)(github\\.com)(:|/)(.*)(\\.git)$",
    "baseUrl": "https://$2",
    "repoPath": "$4",
    "repoType": "GitHub"
  }
]
```

Suppose the `git remote get-url origin` command returns `git@github.com:JayBeeDe/vscode_extensions.git`. Extension will find that the `remoteUrl` matches and will apply the `baseUrl` regex to replace with. As `baseUrl`, `repoPath` is a replacement regexp from the `remoteUrl` search regexp.
