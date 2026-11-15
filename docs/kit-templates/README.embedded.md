# Trackr job-search kit

This folder is ready to use: your Trackr token is already inside `.mcp.json`, so there is nothing to fill in.

**Keep this folder private.** Anyone who has `.mcp.json` can use your Trackr token. Don't share the folder, don't put it in a public repository (the included `.gitignore` already excludes `.mcp.json`), and delete the downloaded .zip once you've unzipped it. You can revoke the token in Trackr (Settings → Claude connector) at any time.

## Start

1. **Give Claude a browser.** Install the **Claude in Chrome** extension, and sign in to LinkedIn, Naukri, Indeed and so on yourself, in Chrome. Claude never types your passwords.
2. **Open this folder in Claude Code** (the Code tab of Claude Desktop, or a terminal). When asked, approve the `trackr` server. Run `/mcp` to check it is connected.
3. **Run `/trackr-start`.** Claude reads the playbook, loads your profile, preferences, jobs, answers and resumes, asks which resume to use, and tells you any gaps.

## Commands

| Command | What it does |
|---|---|
| `/trackr-start` | Loads the playbook and your data, asks which resume to use, tells you any gaps |
| `/trackr-refresh` | Reloads the latest data from Trackr and tells you what changed. Use it after you edit your profile, answers or preferences |
| `/trackr-search` | Finds jobs, scores them, prepares answers for the good ones. Never submits |
| `/trackr-apply` | Applies only to jobs you approved in Trackr (Ready to apply, Apply with AI ticked, nothing missing) |
| `/trackr-hr-emails` | Finds posts with an HR email address and drafts emails. Never sends |
| `/trackr-status` | Where everything stands |

`/trackr-search` and `/trackr-hr-emails` accept a short focus after the command, for example `/trackr-search remote only`. The commands can only be started by you: Claude will not run `/trackr-apply` on its own.

## Notes

- The token only works if it was created with **Let Claude add things** ticked for searching and applying. A read-only token can read your data but not add jobs.
- Read tools are pre-approved. Writes and browser actions still ask you first, which is a good way to watch the first few runs.
- Everything Claude knows and does is described in the playbook, which Trackr serves through `get_playbook`.
