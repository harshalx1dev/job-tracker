# Trackr job-search kit for Claude Code

A ready-made workspace so Claude runs your job search with real `/` commands. Claude Code reads `CLAUDE.md` when a session starts, so Claude already knows what this folder is for.

## Set up (once)

1. **Copy this folder** somewhere on your computer, for example `~/job-search`.
2. **Create a Trackr token** with **Let Claude add things** ticked (Trackr → Settings → Claude connector).
3. **Connect Trackr to Claude Code.** Open the kit's `.mcp.json` in any text editor and replace two values:
   - `YOUR-TRACKR-SITE` with your Trackr site address (for example `my-trackr.vercel.app`);
   - `trk_PASTE_YOUR_TOKEN_HERE` with your token (keep the word `Bearer` and the space in front of it).

   Save the file. The first time you open the folder, Claude Code asks you to approve the project's `trackr` server. Run `/mcp` to check it is connected.

   The token is stored in that file on your computer, so keep the folder private: don't share it or put it in a public repository. (The kit's `.gitignore` already excludes `.mcp.json`.) If you'd rather not store the token in a file, replace the two values with `${TRACKR_URL}` and `${TRACKR_TOKEN}` (as `"url": "${TRACKR_URL}/api/mcp"` and `"Authorization": "Bearer ${TRACKR_TOKEN}"`) and set those two environment variables before starting Claude Code. A token can be revoked in Trackr at any time.

   *Prefer a command? From the folder, `claude mcp add --transport http trackr https://<your-trackr-site>/api/mcp --header "Authorization: Bearer trk_..."` does the same.* The server must be named `trackr`, because `.claude/settings.json` pre-approves the read tools by that name.
4. **Give Claude a browser.** Install the **Claude in Chrome** extension, and sign in to LinkedIn, Naukri, Indeed and so on yourself, in Chrome. Claude never types your passwords.
5. **Open the folder** in Claude Code (the terminal, or the Code tab of Claude Desktop) and start a session.

## Use it

| Command | What it does |
|---|---|
| `/trackr-start` | Loads the playbook and your data, asks which resume to use, tells you any gaps |
| `/trackr-refresh` | Reloads the latest data from Trackr and tells you what changed. Use it after you edit your profile, answers or preferences |
| `/trackr-search` | Searches LinkedIn, Naukri, Indeed, company career pages and LinkedIn hiring posts in turn, scores the jobs, adds the good ones, prepares answers for the best. Never submits |
| `/trackr-apply` | Applies only to jobs you approved in Trackr (Ready to apply, Apply with AI ticked, nothing missing) |
| `/trackr-hr-emails` | Finds posts with an HR email address and drafts emails. Never sends |
| `/trackr-status` | Where everything stands |

`/trackr-search` accepts a source (`linkedin`, `naukri`, `indeed`, `careers`, `posts`) or a short focus after the command, for example `/trackr-search naukri` or `/trackr-search remote only`. `/trackr-hr-emails` accepts a short focus.

The commands can only be started by you: Claude will not run `/trackr-apply` on its own.

## Notes

- Read tools are pre-approved. Writes and browser actions still ask you first, which is a good way to watch the first few runs. Once you trust it, approve them for the session when asked.
- Everything Claude knows and does is described in the playbook, which Trackr serves through `get_playbook`.
