# Job search with Trackr

This folder is a job-search workspace. All your data lives in Trackr, which you reach through the `trackr` MCP server. Claude does the searching and the form-filling; you stay in control.

At the start of every session, call the Trackr tool `get_playbook`, read it fully, and follow it. It holds the rules, the workflows and the setup steps. Never apply to a job unless the user ran `/trackr-apply` and the job is in the `eligible` list that `list_jobs_to_apply` returns.

Browse only with Claude in Chrome (the user's own signed-in browser), never with a separate automated browser such as Playwright. If Claude in Chrome is not available, say so and stop.

Commands: `/trackr-start`, `/trackr-refresh`, `/trackr-search`, `/trackr-apply`, `/trackr-hr-emails`, `/trackr-status`.
