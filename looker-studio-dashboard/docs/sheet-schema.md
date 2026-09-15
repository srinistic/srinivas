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

## Raw Leads (funnel stage 1)

`Raw Leads = Google Ads conversions + bing_ads_raw conversions + Zoho CRM Leads (Lead Source = "Direct")`

The organic term comes from Zoho, not GA4: GA4's conversion event fires on
every form submission including internal test submissions, which would
inflate the count. Zoho's Lead Source field is curated at lead-creation/
qualification time, so it doesn't carry that noise. Confirmed: organic
leads are tagged `Lead Source = "Direct"` in your Zoho instance (not
literally "Organic" — filter on this exact value).

Note: this is separate from the **Organic Traffic** scorecard (GA4
sessions, Organic Search channel) on Overview/Page 4 — that's a volume
metric, not a lead count, and is unaffected by this change.

## `zoho_funnel_raw` (written by a Zoho Flow, MQL/SQL)

Rather than a paid Looker Studio connector (Jivrus's free tier is a
one-time 200-transaction trial, not ongoing), this uses **Zoho Flow**
(Zoho's own automation tool) on a free plan — 100 tasks/month, well within
what a daily sync needs (~30/month). A scheduled Flow reads Zoho CRM and
writes counts into a Sheet using Zoho Flow's native Google Sheets action;
Looker Studio reads that Sheet exactly like `bing_ads_raw`.

| column  | type   | notes                                             |
|---------|--------|-----------------------------------------------------|
| date    | date   | the day these counts are for                       |
| stage   | text   | `MQL` or `SQL`                                     |
| count   | number | count of Leads created that day (MQL) / Contacts converted that day (SQL) |

- **MQL** = count of records entering Zoho's **Leads** module that day
- **SQL** = count of Leads converting to **Contacts** that day
- **Grain:** aggregate only — confirmed no campaign/source breakdown is
  tracked on these records today, so the funnel section is 3 fixed numbers
  per date range, not filterable by campaign. (If Zoho Leads carry a "Lead
  Source" field, per-channel funnel breakdown becomes possible later — worth
  a quick check, but out of scope for V1.)
- **Date filtering:** set `date` as this source's Date Range Dimension in
  Looker Studio, same as `bing_ads_raw`.

## Master campaign table (Overview page)

Built in Looker Studio as a **blended data source**:
- Google Ads connector (native, already connected) — filtered to `Campaign status = Enabled`
- `bing_ads_raw` Sheet — filtered to `status = Active`

Joined on `Campaign` (+ `Date` for time filtering), with `Cost`, `Clicks`,
`Impressions`, `Conversions` summed across both sources per campaign.
