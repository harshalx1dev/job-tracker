# Job search with Trackr

This folder is a job-search workspace. All your data lives in Trackr, which you reach through the `trackr` MCP server. Claude does the searching and the form-filling; you stay in control.

At the start of every session, call the Trackr tool `get_playbook`, read it fully, and follow it. It holds the rules, the workflows and the setup steps. Never apply to a job unless the user ran `/trackr-apply` and the job is in the `eligible` list that `list_jobs_to_apply` returns.

Commands: `/trackr-start`, `/trackr-search`, `/trackr-apply`, `/trackr-hr-emails`, `/trackr-status`.
