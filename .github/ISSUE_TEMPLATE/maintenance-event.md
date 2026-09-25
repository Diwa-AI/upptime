---
name: Maintenance Event
about: Schedule a planned work window on the public status page
title: "[Scheduled Maintenance] "
labels: maintenance
assignees: ''
---

<!--
start: 2026-09-21T13:00:00.000Z
end: 2026-09-21T14:00:00.000Z
expectedDown: diwa-ai
-->

Replace `start` and `end` above with the real UTC window (ISO-8601).
`expectedDown` is a comma-separated list of slugs that may go down
during this window (`diwa-ai`, `diwa-api`). Upptime will not open a
duplicate incident for those slugs while the window is active.

**What's changing**
Who / what / why this maintenance is happening.

**Customer impact**
What visitors should expect (downtime, degraded performance, no impact).

Filled example:

```
[Scheduled Maintenance] Database index rebuild — Diwa AI

<!--
start: 2026-09-21T13:00:00.000Z
end: 2026-09-21T14:00:00.000Z
expectedDown: diwa-ai
-->

**What's changing**
We are rebuilding search indexes on Diwa AI to improve query performance.

**Customer impact**
The website may be briefly unavailable or slower during the window.
The API health endpoint is not in scope.
```
