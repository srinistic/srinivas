# Data schema

One consistent "tidy" row shape across every non-native data source, so Looker
Studio can blend them by `date` + `campaign` without per-source special-casing.

## `bing_ads_raw` (written by scripts/apps-script-webapp.gs)

| column        | type   | notes                                      |
|---------------|--------|---------------------------------------------|
| date          | date   | `YYYY-MM-DD`, stat date (not report-run date) |
| channel       | text   | always `Bing Ads`                          |
| campaign      | text   | exact Microsoft Advertising campaign name  |
| status        | text   | `Active` (paused campaigns are never sent) |
| impressions   | number |                                             |
| clicks        | number |                                             |
| cost          | number | account currency                           |
| conversions   | number |                                             |
| last_updated  | datetime | when this row was last written by the web app |

Grain: one row per campaign per day. Re-runs upsert by `date + campaign`, so
this sheet is safe to backfill or re-trigger without creating duplicates.

## `funnel_raw` (to be defined once you share the funnel sheet)

Placeholder shape — will confirm/adjust against your actual sheet:

| column     | type   | notes                                          |
|------------|--------|--------------------------------------------------|
| date       | date   | date the lead was created / stage changed      |
| campaign   | text   | campaign name, **must match the platform's exact name** so it joins to `bing_ads_raw` / Google Ads data — only fill this in if the funnel is tracked per-campaign; leave blank/omit if it's aggregate-only |
| stage      | text   | `Raw Lead` / `MQL` / `SQL`                     |
| count      | number | if the sheet is already aggregated, or omit and count rows if it's one-row-per-lead |

Open question (from the roadmap): confirm whether your funnel sheet is
per-campaign or aggregate-only — that determines whether the Overview funnel
can be filtered by campaign or is always the same three numbers.

## Master campaign table (Overview page)

Built in Looker Studio as a **blended data source**:
- Google Ads connector (native, already connected) — filtered to `Campaign status = Enabled`
- `bing_ads_raw` Sheet — filtered to `status = Active`

Joined on `Campaign` (+ `Date` for time filtering), with `Cost`, `Clicks`,
`Impressions`, `Conversions` summed across both sources per campaign.
