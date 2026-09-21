# Incident runbook for status.diwa.ai

This repository (`Diwa-AI/upptime`) is the **single source of truth** for [status.diwa.ai](https://status.diwa.ai). There is no separate status-page repo.

Checks run every 5 minutes against:

| Service | Slug | URL |
| --- | --- | --- |
| Diwa AI | `diwa-ai` | https://www.diwa.ai |
| Diwa API | `diwa-api` | https://www.diwa.ai/api/v1/health |

## Who can post

Repo admins with write access:

- [`jasper-diwa-ai`](https://github.com/jasper-diwa-ai)
- [`rey-lee-diwa-ai`](https://github.com/rey-lee-diwa-ai)

Write access is required because Upptime **locks** auto-opened issues. Only collaborators can comment updates. The repo is public; issue templates are the only create path (`blank_issues_enabled: false`).

## Planned maintenance

1. Open [New Issue](https://github.com/Diwa-AI/upptime/issues/new/choose) → **Maintenance Event**.
2. Keep the `maintenance` label.
3. Set the UTC window in the HTML comment. Use slugs `diwa-ai` and/or `diwa-api` in `expectedDown` so checks during the window do not open a duplicate incident:

   ```
   <!--
   start: 2026-09-21T13:00:00.000Z
   end: 2026-09-21T14:00:00.000Z
   expectedDown: diwa-ai
   -->
   ```

4. Describe impact in the body. Comment with updates as the window progresses.
5. Upptime closes the issue when `end` is reached. It then moves into **Past incidents**.

The status page rebuilds automatically when the issue is opened, edited, or closed. If it does not, run **Actions → Static Site CI → Run workflow**.

## Unplanned issue not caught by checks

Use this for degraded performance, partial outages, or anything the HTTP check still sees as “up”.

1. Open [New Issue](https://github.com/Diwa-AI/upptime/issues/new/choose) → **Incident**.
2. Keep the `status` label and add `diwa-ai` and/or `diwa-api`.
3. Post timeline updates as comments. Close the issue when resolved.

## Real outage (automated)

No action needed. When a check fails, Uptime CI opens a locked issue titled like `🛑 Diwa AI is down`, assigns the admins above, and posts to Slack. When the check recovers:

- **Under 15 minutes:** the issue is **deleted**. It does not appear in Past incidents. This is intentional so short flaps stay out of public history. File a manual Incident if a short event still needs to be public.
- **15 minutes or longer:** the issue is **closed**, shown under Past incidents, and the day’s uptime bar is colored with a hover tooltip.

Do not take production down to test this path.

## After posting

- Public page: [status.diwa.ai](https://status.diwa.ai)
- Issue RSS: https://github.com/Diwa-AI/upptime/issues.atom
- Hover a day on the 90-day bar to see related incident titles.

If the page is stale, dispatch Static Site CI. Site rebuilds also run daily at 01:00 UTC.

## Slack alerts

Uptime CI sends a Slack message when a monitored endpoint goes down or comes back up.

Required Actions secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `NOTIFICATION_SLACK` | `true` |
| `NOTIFICATION_SLACK_WEBHOOK_URL` | Incoming webhook URL for the on-call channel |

Rotate the webhook by replacing `NOTIFICATION_SLACK_WEBHOOK_URL`. Manual maintenance/incident issues do **not** send Slack; only automated down/up events do.

```bash
gh secret set NOTIFICATION_SLACK -R Diwa-AI/upptime --body true
gh secret set NOTIFICATION_SLACK_WEBHOOK_URL -R Diwa-AI/upptime
```

## GH_PAT

Workflows use the `GH_PAT` repository secret (classic PAT with `repo` and `workflow` scopes) to open issues, commit history, and deploy GitHub Pages.

If scheduled checks stop committing or cannot open issues:

1. Create a new classic PAT with `repo` + `workflow`.
2. Replace the `GH_PAT` secret.
3. Dispatch **Uptime CI** once to confirm it can check endpoints and (on a failure) open an issue.
