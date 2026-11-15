---
name: trackr-update-kit
description: Update this folder's Trackr starter kit (commands and instructions) to the latest version
argument-hint: ""
disable-model-invocation: true
---

Update this folder's Trackr starter kit to the latest version. Follow these steps:

1. Read the file `.kit-version` in this folder. It may not exist, in which case the installed version is unknown.
2. Call the Trackr tool get_kit_update with installedVersion set to that value (leave it out if there is no file) and includeFiles true.
3. If upToDate is true, say the kit is already current and stop.
4. Otherwise compare each returned file with the copy in this folder and tell me briefly which files are new, which changed and which are the same. Also list any folders in `.claude/skills` whose name starts with "trackr-" that the update does not include: they may be retired. Show me what will change and ask me to confirm. Do not write anything yet.
5. After I confirm, write the new and changed files, including `.kit-version`. Never touch `.mcp.json` or `.claude/settings.local.json`: they hold my Trackr token. Delete a retired trackr-* skill folder only if I tell you to.
6. Only write files the tool returned. If the returned `.claude/settings.json` allows anything other than mcp__trackr__ tools, do not write it and tell me why.
7. When done, tell me to start a new session so the new commands load.
