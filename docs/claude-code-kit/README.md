# Trackr job-search kit for Claude Code

A ready-made workspace so Claude runs your job search with real `/` commands. Claude Code reads `CLAUDE.md` when a session starts, so Claude already knows what this folder is for.

## Set up (once)

1. **Copy this folder** somewhere on your computer, for example `~/job-search`.
2. **Create a Trackr token** with **Let Claude add things** ticked (Trackr → Settings → Claude connector).
3. **Connect Trackr to Claude Code.** The kit's `.mcp.json` already declares the server and reads your site address and token from two environment variables, so the token is never written into a file. Set them, then restart Claude Desktop (or your terminal):

   - **Windows (PowerShell):**

     ```powershell
     setx TRACKR_URL "https://<your-trackr-site>"
     setx TRACKR_TOKEN "trk_..."
     ```

   - **macOS or Linux:** add `export TRACKR_URL="https://<your-trackr-site>"` and `export TRACKR_TOKEN="trk_..."` to your shell profile and start Claude Code from that terminal. (Claude Desktop only sees variables from the environment it was launched in.)

   Use the Server URL's site address (without `/api/mcp`) and the token from Trackr. The first time you open the folder, Claude Code asks you to approve the project's `trackr` server. Run `/mcp` to check it is connected.

   *Prefer a command? From the folder, `claude mcp add --transport http trackr https://<your-trackr-site>/api/mcp --header "Authorization: Bearer trk_..."` does the same.* The server must be named `trackr`, because `.claude/settings.json` pre-approves the read tools by that name.
4. **Give Claude a browser.** Install the **Claude in Chrome** extension, and sign in to LinkedIn, Naukri, Indeed and so on yourself, in Chrome. Claude never types your passwords.
5. **Open the folder** in Claude Code (the terminal, or the Code tab of Claude Desktop) and start a session.

## Use it

| Command | What it does |
|---|---|
| `/trackr-start` | Loads the playbook and your data, asks which resume to use, tells you any gaps |
| `/trackr-search` | Finds jobs, scores them, prepares answers for the good ones. Never submits |
| `/trackr-apply` | Applies only to jobs you approved in Trackr (Ready to apply, Apply with AI ticked, nothing missing) |
| `/trackr-hr-emails` | Finds posts with an HR email address and drafts emails. Never sends |
| `/trackr-status` | Where everything stands |

`/trackr-search` and `/trackr-hr-emails` accept a short focus after the command, for example `/trackr-search remote only`.

The commands can only be started by you: Claude will not run `/trackr-apply` on its own.

## Notes

- Read tools are pre-approved. Writes and browser actions still ask you first, which is a good way to watch the first few runs. Once you trust it, approve them for the session when asked.
- Everything Claude knows and does is described in the playbook, which Trackr serves through `get_playbook`.
