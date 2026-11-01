# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Browser suite | `browser-e2e.yml` | every day 02:17 CT | `17 2 * * *` |

## Notes
- The nightly browser suite keeps 02:17 Central, now pinned all year.
