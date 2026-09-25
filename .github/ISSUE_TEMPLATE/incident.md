---
name: Incident
about: Report an unplanned issue not caught by automated checks
title: "Investigating [impact] — [services]"
labels: status
assignees: ''
---

Keep the `status` label and add `diwa-ai` and/or `diwa-api`.

The title appears on the status page as-is. Example:
`Investigating service degradation — Diwa AI and Diwa API`

The body is the first public update. Use this prefix:

```
Investigating - We are aware of [impact]. We are investigating.
```

Later comments (newest shows first on https://status.diwa.ai):

```
Identified - The root cause has been identified and a fix is being implemented.
Monitoring - A fix has been deployed. We are monitoring.
Resolved - This incident has been resolved.
```

Close the issue after the Resolved comment.
