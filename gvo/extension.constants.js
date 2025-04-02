const GVO = "gitViewOnline";

const URL_TEMPLATES = {
    "Bitbucket": "{{ baseUrl }}/projects/{{ repoDir | upper }}/repos/{{ repoName }}/browse/{{ filePath }}?at={% if branchOrCommit == branch %}{{ ('refs/heads/' ~ branch) | urlencode }}{% else %}{{ hashLong }}{% endif %}{% if lines > 0 %}#{{ lineStart }}{% if lines > 1 %}-{{ lineStop }}{% endif %}{% endif %}",
    "GitHub": "{{ baseUrl }}/{{ repoPath }}/blob/{{ branchOrCommit | urlencode }}/{{ filePath }}{% if lines > 0 %}#L{{ lineStart }}{% if lines > 1 %}-L{{ lineStop }}{% endif %}{% endif %}",
    "GitLab": "{{ baseUrl }}/{{ repoPath }}/-/blob/{{ branchOrCommit | urlencode }}/{{ filePath }}{% if lines > 0 %}#L{{ lineStart }}{% if lines > 1 %}-{{ lineStop }}{% endif %}{% endif %}",
};

const LINK_TEMPLATES = {
    "html": "<a href='{{ url }}'>{{ title }}<a/>",
    "jira": "[{{ title }}|{{ url }}]",
    "markdown": "[{{ title }}]({{ url }})",
    "raw": "{{ url }}",
};

const MSG = {
    "COPY_URL_OPEN": "URL copied to clipboard!",
    "COPY_URL_OPEN_LINK": "Open URL",
    "NO_FILE": "No active file found!",
    "NO_PROVIDER": "has no provider URL matching. Please check gitViewOnline.providers setting!"
};

module.exports = { GVO, URL_TEMPLATES, LINK_TEMPLATES, MSG };