# Droidal Marketing Dashboard — build spec (V1)

Apply this directly in Looker Studio.

## Filtering (V1: whole month only)

V1 filtering is deliberately narrow: pick **one whole month at a time** —
this month, previous month, or any other single month. No custom/partial
date ranges, no multi-month comparison — that's V2.

Rather than Looker Studio's native Date Range control (which allows
arbitrary day-level ranges and wouldn't actually enforce "one month only"),
use a **single-select Dropdown list control** bound to a `Month`
calculated field, defaulting to the current month:

1. On **every** data source used in the report (Google Ads, GA4,
   `bing_ads_raw`, `zoho_funnel_raw`), add a calculated field named
   exactly `Month`:
   ```
   FORMAT_DATE("%Y-%m", <that source's date field>)
   ```
   (e.g. `2026-09`) — using `%Y-%m` rather than a prettier "Sep 2026" format
   is deliberate, so the dropdown sorts chronologically instead of
   alphabetically.
2. Report level → Insert → **Control** → **Drop-down list**, bind it to
   `Month`, set **single select**, default value = current month
   (`2026-09` right now)
3. Add a text label near it reading `Data: {{Month}}` (or similar) so the
   selected month is always visible on screen
4. Because the field name `Month` matches across every source, this one
   control filters all pages/charts at once — no need to duplicate it per
   page

## Global theme

Extracted to match the existing Droidal report (dark UI, teal/cyan accent):

- Background: `#0F1117` (page), `#181B24` (card/table backgrounds)
- Text: `#F5F6F8` (primary), `#9AA1AC` (secondary/labels)
- Accent: `#2DD4C4` (teal — headers, active filter chips, positive trend)
- Negative/alert (used sparingly, e.g. a metric down): `#EF6C6C`
- Font: Roboto or Lato (Looker Studio default set) — match whichever the
  current report already uses; check via "Extract theme from image" on the
  Droidal logo for the exact accent hex before finalizing.

Set this once under **Theme and Layout > Customize**, save as a report
theme so every new page inherits it automatically.

---

## Page 1 — Overview

**Scorecards (row 1):**
- Total Spend — sum of `Cost` across the blended campaign source
- Total Leads — sum of leads (from funnel `Raw Lead` stage once connected)
- Blended CPL — calculated field: `Total Spend / Total Leads`
- Total Traffic — GA4 sessions, all channels
- Organic Traffic — GA4 sessions, channel grouping = Organic Search
- Paid Traffic — GA4 sessions, channel grouping = Paid Search/Paid Social/Paid Other (includes ChatGPT Ads CPC per the "AI = organic referral only" rule)
- AI Traffic — GA4 sessions matching the AI-referral calculated field (see below)

**Master campaign table:**
Blended source (Google Ads + `bing_ads_raw`), filtered to active/enabled
campaigns only. Columns: Campaign, Channel, Spend, Leads, CPL. No budget,
no pacing, no kill-criteria columns — this table is board-facing only.

**Funnel section:**
A funnel chart (or 3 scorecards side by side if funnel chart styling looks
too sparse with only 3 stages): Raw Leads → MQL → SQL.
- Raw Leads: Google Ads conversions + `bing_ads_raw` conversions + Zoho CRM Leads (Lead Source = "Direct")
- MQL: `zoho_funnel_raw` where stage = "MQL" (synced from Zoho via Zoho Flow)
- SQL: `zoho_funnel_raw` where stage = "SQL"
Aggregate only, not filterable by campaign (see sheet-schema.md).

---

## Page 2 — Google Ads performance

Data source: native Google Ads connector, filtered `Campaign status =
Enabled`, segmented by the 4 known campaigns (Insurance, Prior
Authorization, Denials Management, Claims Processing — names to be
confirmed exactly as they appear in the account).

- Scorecards: Spend, Impressions, Clicks, CTR, Conversions, Cost/Conv, Conv. rate (report-level totals)
- Table: one row per campaign, same metrics, sortable
- Time series: daily spend trend across the selected month

## Page 3 — Bing Ads performance

Same layout as Page 2, sourced from `bing_ads_raw`. Confirmed active
campaigns (see `ACTIVE_CAMPAIGNS` in `microsoft-ads-export.js`): Insurance
Verification AI, Claims Processing AI, Voice AI Agent.

## Page 4 — Organic performance

Data source: GA4 connector (already connected).

- Scorecards: Organic Sessions, Organic Users, Organic Leads (if trackable via GA4 conversion event — confirm event name), Avg. engagement time
- Table: top landing pages by organic sessions
- Time series: organic sessions trend across the selected month

---

## Calculated fields

**AI-referral traffic** (Overview scorecard + usable as a segment elsewhere):
```
CASE
  WHEN REGEXP_MATCH(Session source, "chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai")
    AND Session medium != "cpc"
  THEN "AI"
  ELSE "Other"
END
```
Filter Overview's "AI Traffic" scorecard to this field = "AI". The
`Session medium != "cpc"` clause is what keeps ChatGPT Ads (paid) out of
this bucket per your call that AI = organic referral only. Extend the
regex list as you identify more AI referrers in the data.

**Blended CPL:**
```
Total Spend / Total Leads
```
(Guard against divide-by-zero in Looker Studio's field editor if a filtered
period has 0 leads — use a `CASE WHEN Total Leads = 0 THEN 0 ELSE ... END`
wrapper.)

---

## Open items before this can be built end-to-end in the UI

1. Exact active campaign names in Google Ads & Bing Ads (not blocking, send whenever)
2. GA4 conversion event name for "lead" — only needed if Page 4 (Organic
   performance) should show an "Organic Leads" number pulled straight from GA4
   as well; not required for the Overview Raw Leads total (that's Zoho-sourced now)
