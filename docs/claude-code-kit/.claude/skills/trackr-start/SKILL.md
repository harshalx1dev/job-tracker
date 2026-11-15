---
name: trackr-start
description: Load the Trackr playbook and the user's data, then report back
argument-hint: ""
disable-model-invocation: true
---

Call the Trackr tool get_playbook, read it fully, then follow its Setup steps: load my profile, job search preferences, jobs, answers and resumes, ask me which resume to use, and give me a short summary of what you found and any gaps. Also read the file `.kit-version` in this folder if it exists, and check with the get_kit_update tool whether a newer kit is available; if one is, tell me to run /trackr-update-kit. Do not search or apply until I give you a command.
