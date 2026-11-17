---
name: trackr-log-skipped
description: Add the listings you looked at and skipped earlier in this session to Trackr's Reviewed log
argument-hint: ""
disable-model-invocation: true
---

If you have not read the Trackr playbook in this session, call get_playbook first. Then run the Log skipped command: go back through this conversation and list every job listing you looked at, scored or ruled out but did not save with create_job. Use only listings whose company and title you actually know from this conversation (search results, pages you read, your own notes and tables). Do not invent or guess any, and do not log groups you only counted, such as "about 20 unrelated roles".

For each listing, call log_reviewed_jobs (up to 50 entries per call) with company, title, url if you have it, source, decision "skipped", your score if you gave one, and one short plain reason that matches why you skipped it (for example "needs TypeScript", "8+ years", "archived: Labcorp needed 7+ years"). Do not log jobs that are already on the board: they are logged automatically. Logging a listing twice only updates it.

When you are done, tell me how many you logged per source, and how many you saw but could not log because you no longer have their company and title (for example because earlier messages were summarised). Do not search or apply.
