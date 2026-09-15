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

## MQL / SQL — via Zoho CRM (not a sheet)

No custom pipeline needed here. MQL/SQL live in Zoho CRM itself as the
system of record, so we connect to it directly:

- **Connector:** "Looker Studio Connector for Zoho CRM" (Jivrus Technologies,
  Zoho Marketplace) — free trial tier (200-transaction one-time quota, check
  paid pricing before/at rollout if volume needs it long-term)
- **MQL** = count of records in the Zoho **Leads** module (a record entering
  Zoho as a Lead is the MQL event)
- **SQL** = count of records in the Zoho **Contacts** module attributable to
  lead conversion (a Lead converting to Contact is the SQL event)
- **Grain:** aggregate only — confirmed no campaign/source breakdown is
  tracked on these records today, so the funnel section is 3 fixed numbers
  per date range, not filterable by campaign. (If Zoho Leads carry a "Lead
  Source" field, per-channel funnel breakdown becomes possible later — worth
  a quick check, but out of scope for V1.)
- **Date filtering:** use the Lead's Created Time / Contact's conversion
  date, so this responds to the report's date range control like everything
  else on Overview.

## Master campaign table (Overview page)

Built in Looker Studio as a **blended data source**:
- Google Ads connector (native, already connected) — filtered to `Campaign status = Enabled`
- `bing_ads_raw` Sheet — filtered to `status = Active`

Joined on `Campaign` (+ `Date` for time filtering), with `Cost`, `Clicks`,
`Impressions`, `Conversions` summed across both sources per campaign.
