# Droidal Marketing Dashboard — build spec (V1)

Apply this directly in Looker Studio.

## Filtering (V1: whole month only)

V1 filtering is deliberately narrow: pick **one whole month at a time** —
this month, previous month, or any other single month. No custom/partial
date ranges, no multi-month comparison — that's V2.

Rather than Looker Studio's native Date Range control (which allows
arbitrary day-level ranges and wouldn't actually enforce "one month only"),
use a **single-select Dropdown list control** bound to a `MonthKey`
calculated field, defaulting to the current month. (Named `MonthKey`, not
`Month` — GA4 and Google Ads both have a *native* system field literally
called "Month" that shows different, incompatible formats — GA4's is
month-only with no year, Google Ads' is "Year Month" in its own format —
so our own field needs a distinct name.)

1. On **every** data source used in the report (`google_ads_raw`, GA4,
   `bing_ads_raw`, `zoho_funnel_raw`), add a calculated field named
   exactly `MonthKey`:
   ```
   FORMAT_DATETIME("%Y-%m", <that source's date field>)
   ```
   (e.g. `2026-09`) — set the field's Type to **Text** explicitly after
   saving (Looker Studio can silently convert a date-like string into a
   compatibility-mode Date type otherwise). Reference the date field by
   **clicking it from the field picker**, not typing it — typed field names
   with spaces/special characters can silently fail to parse.
2. Report level → Insert → **Control** → **Drop-down list**, bind it to
   `MonthKey`, set **single select**, default value = current month
   (`2026-09` right now)
3. Add a text label near it reading `Data: {{MonthKey}}` (or similar) so the
   selected month is always visible on screen
4. Because the field name `MonthKey` matches across every source, this one
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
- Total Spend — sum of `Cost` across the "All Campaigns Blend" (`google_ads_raw` + `bing_ads_raw` — see Blend setup below)
- Total Leads — sum of leads (from funnel Raw Leads term, see sheet-schema.md)
- Blended CPL — calculated field: `Total Spend / Total Leads`
- Total Traffic — GA4 sessions, all channels
- Organic Traffic — GA4 sessions, channel grouping = Organic Search
- Paid Traffic — GA4 sessions, channel grouping = Paid Search/Paid Social/Paid Other (includes ChatGPT Ads CPC per the "AI = organic referral only" rule)
- AI Traffic — GA4 sessions matching the AI-referral calculated field (see below)

**Master campaign table:**
`google_ads_raw` + `bing_ads_raw` (both already active-campaign-filtered at
the script level). Columns: Campaign, Channel, Spend, Leads, CPL. No
budget, no pacing, no kill-criteria columns — this table is board-facing
only. Build this as **separate small tables, one per source/account**
(matching the current live report's existing pattern) rather than one
unified blended table — see the Blend troubleshooting notes below for why.

**Funnel section:**
A funnel chart (or 3 scorecards side by side if funnel chart styling looks
too sparse with only 3 stages): Raw Leads → MQL → SQL.
- Raw Leads: `google_ads_raw` conversions + `bing_ads_raw` conversions + Zoho CRM Leads (Lead Source = "Direct")
- MQL: `zoho_funnel_raw` where stage = "MQL" (synced from Zoho via Zoho Flow)
- SQL: `zoho_funnel_raw` where stage = "SQL"
Aggregate only, not filterable by campaign (see sheet-schema.md).

---

## Page 2 — Google Ads performance

Data source: `google_ads_raw` (both accounts — not the native Google Ads
connector, see Blend troubleshooting notes). Filter/segment by `account`
and `campaign`.

- Scorecards: Spend, Impressions, Clicks, CTR, Conversions, Cost/Conv, Conv. rate (report-level totals)
- Table: one row per campaign (both accounts), same metrics, sortable
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

## Blend setup: "All Campaigns Blend" (Total Spend / Total Leads / Blended CPL)

Combines `google_ads_raw` + `bing_ads_raw` into the totals used on
Overview's scorecard row. **Do not add the native Google Ads connector to
any blend** — see troubleshooting notes below for why.

1. **Resource → Manage blends** → new blend
2. Table 1: `google_ads_raw` — bring in `Campaign`, `Cost`, `Conversions`
   as **Metrics** (not Dimensions — double check this explicitly, see notes
   below), `MonthKey` as a field
3. Table 2: `bing_ads_raw` — same fields, same Metric/Dimension placement
4. **Merge operator:** Full outer
5. **Merge condition:** join on `campaign` (Google) ↔ `campaign` (Bing) —
   full outer means every campaign from both sources shows up as its own
   row (names never collide across platforms, so nothing merges together)
6. **Date range** on each table: set to **Auto**, not a custom fixed range
   like "Last 28 days" — a fixed range silently excludes older months from
   ever appearing regardless of what the `MonthKey` dropdown selects
7. Combined fields (COALESCE handles nulls from the non-matching side of
   the outer join) — build by **clicking** each field from the picker, not
   typing it:
   ```
   Total Spend = COALESCE(Cost (google_ads_raw),0) + COALESCE(Cost (bing_ads_raw),0)
   ```
   Same pattern for a combined Conversions field, and a combined `MonthKey`:
   ```
   COALESCE(MonthKey (google_ads_raw), MonthKey (bing_ads_raw))
   ```

## Blend troubleshooting notes (why the approach above)

Several things went wrong building this, worth recording so they aren't
re-discovered the hard way:

1. **Never blend the native Google Ads connector.** Its metrics (`Cost`,
   `Conversions`, etc.) are locked to "Auto" aggregation — this cannot be
   changed, including inside a blend, and any attempt to combine it with
   another source (regardless of join key) threw "Unable to aggregate ratio
   metrics." This is a hard platform limitation, not a config mistake. The
   fix was routing Google Ads through Scripts → Sheets (`google_ads_raw`),
   exactly like Bing — plain Sheet numbers have no Auto-lock and blend
   cleanly.
2. **Double-check every field lands in Metrics, not Dimensions**, when
   adding a Sheets source to a blend. This was the actual root cause of a
   long debugging session: `cost`/`conversions` from a Sheet had been added
   under "Dimensions" instead of "Metrics" in the blend editor, which
   silently breaks aggregation for that field. Looker Studio doesn't flag
   this clearly — check the field's section placement directly.
3. **Join on `campaign`, not `date`,** if the goal is a per-campaign table
   (one row per campaign) — a date-based join collapses everything to one
   row per day instead. Join on `date` only if you specifically need daily
   granularity and don't need distinct campaign rows out of that same blend.
4. Each table's own **Date range setting** (Auto vs a fixed window like
   "Last 28 days") applies *before* the blend — a fixed window silently
   caps what the blend can ever show, independent of any report-level
   filter control.

## Open items before this can be built end-to-end in the UI

1. Exact active campaign names in Google Ads & Bing Ads (not blocking, send whenever)
2. GA4 conversion event name for "lead" — only needed if Page 4 (Organic
   performance) should show an "Organic Leads" number pulled straight from GA4
   as well; not required for the Overview Raw Leads total (that's Zoho-sourced now)
