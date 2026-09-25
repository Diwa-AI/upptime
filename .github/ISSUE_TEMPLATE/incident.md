---
name: Incident
about: Report an unplanned issue not caught by automated checks
title: "Investigating [impact] — [services]"
labels: status
assignees: ''
---

Keep the `status` label and add `diwa-ai` and/or `diwa-api`.

The title appears on the status page as-is. Example:

`Investigating service degradation — Diwa AI`

The body is the first public update. Use this prefix:

```
Investigating - We are aware of slower page loads on Diwa AI. We are investigating.
```

Later comments (newest shows first on https://status.diwa.ai):

```
Identified - Elevated latency is limited to the web app. A fix is being implemented.
Monitoring - A fix has been deployed. We are monitoring.
Resolved - Response times are back to normal. This incident has been resolved.
```

Close the issue after the Resolved comment.

Filled example (copy and replace the bracketed parts):

```
Investigating service degradation — Diwa AI

Investigating - We are aware of slower page loads on Diwa AI. We are investigating.
```
