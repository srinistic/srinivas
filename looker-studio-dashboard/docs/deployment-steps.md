# Deploying the Bing Ads → Sheets pipeline

Neither Microsoft Advertising Scripts nor Looker Studio's report editor are
reachable from this session (no API access to either), so these steps are
for you (or whoever holds the relevant account access) to run directly.

## 1. Create the target Sheet

- New Google Sheet, e.g. "Droidal — Bing Ads Feed"
- Leave it empty; `apps-script-webapp.gs` creates the `bing_ads_raw` tab
  and header row on first write
- Copy its Spreadsheet ID from the URL (`.../spreadsheets/d/<ID>/edit`)

## 2. Deploy the Apps Script Web App

1. From that Sheet: Extensions > Apps Script
2. Paste in `scripts/apps-script-webapp.gs`
3. Set `SHEET_ID` to the ID from step 1
4. Set `SHARED_SECRET` to any random string you generate (treat it like a
   password — it's what stops random internet POSTs from writing into your
   sheet)
5. Deploy > New deployment > type "Web app" > Execute as "Me" > Who has
   access "Anyone with the link"
6. Copy the deployment URL (ends in `/exec`)

## 3. Install the Microsoft Advertising Script

1. Microsoft Advertising UI > Automate > Scripts > + Script
2. Paste in `scripts/microsoft-ads-export.js`
3. Set `WEBAPP_URL` to the `/exec` URL from step 2
4. Set `SHARED_SECRET` to the same string used in step 2
5. Check `ACTIVE_CAMPAIGNS` at the top of the script — this is a manually
   maintained list of exact campaign names to export (Microsoft's own
   status API proved unreliable for this account during testing, so this
   list is the real filter). **Update it whenever a campaign is paused,
   ended, or a new one goes live** — otherwise stale/inactive campaigns
   will silently stop being dropped, or new ones silently won't appear.
5. Run once manually to verify — check the Sheet gets a `bing_ads_raw` tab
   with rows, and check the script's log for a `200` response
6. Schedule it to run daily (early morning, after Bing's stats finalize for
   the prior day)

## 4. Connect the Sheet in Looker Studio

1. Add Data Source > Google Sheets > select the Sheet from step 1 > tab
   `bing_ads_raw`
2. Set field types: `date` as Date, `impressions`/`clicks`/`conversions` as
   Number, `cost` as Currency
3. This becomes the source for Page 3 (Bing Ads performance) and one side
   of the blend for the Overview master campaign table

## 5. Connect Zoho CRM (MQL/SQL) — via Zoho Flow, free

Uses Zoho Flow's free plan (100 tasks/month — a daily sync uses ~30) instead
of a paid Looker Studio connector, writing into a Sheet the same way Bing
does.

1. Create a new tab called `zoho_funnel_raw` in the same Sheet used for
   `bing_ads_raw` (or a new Sheet, your call), with header row:
   `date, stage, count`
2. In Zoho Flow (flow.zoho.com), create a new Flow:
   - **Trigger:** Schedule — daily (pick a time after your day's Zoho
     activity settles, e.g. late evening or early next morning)
   - **Action 1:** Zoho CRM — search/list records — module **Leads**,
     criteria: `Created_Time` **is within that single day** — i.e.
     `Created_Time >= start of that day AND Created_Time < start of the
     next day`, then a **count** step (Flow's "Count records" or a custom
     function summing the search results)
   - **Action 2:** same for the **Contacts** module — Zoho's standard Lead
     Conversion creates a brand-new Contact record at the moment of
     conversion, so `Contacts.Created_Time` (same same-day window as above)
     is a valid SQL date — confirmed this matches your setup
   - **Action 3 & 4:** Google Sheets — Add Row — write `[date, "MQL", <lead count>]`
     and `[date, "SQL", <contact count>]` into `zoho_funnel_raw` (connect
     your Google account when prompted)

   **Critical:** the criteria must be a same-day window (today only), not
   "since account creation" or any fixed start date. This sheet is daily
   rows that Looker Studio *sums* over whatever range someone filters to —
   if a row's count is cumulative instead of that day's count alone,
   filtering to a date range would overcount by adding cumulative totals
   together.
3. Test-run the Flow manually once, confirm both rows land correctly in
   the Sheet
4. Turn the Flow on / activate the schedule

## 6. Connect the Zoho funnel sheet in Looker Studio

1. Add Data Source > Google Sheets > same Sheet, tab `zoho_funnel_raw`
2. Set field types: `date` as Date (mark as Date Range Dimension), `count`
   as Number
3. This becomes the source for the Overview funnel section

## 7. Deploy the Google Ads pipeline (both accounts) — via Scripts, same pattern as Bing

Google Ads' native Looker Studio connector locks `Cost` to "Auto"
aggregation, which cannot be changed — including inside a blend. This broke
every attempt to combine it with Bing's data in a blend (see build-spec.md
for what we tried). Routing Google Ads through Scripts → Sheets, like Bing,
avoids this permanently.

1. In the same Sheet as `bing_ads_raw`/`zoho_funnel_raw`, a new tab
   `google_ads_raw` will be created automatically on first write
2. Deploy a **new, separate** Apps Script Web App (don't reuse Bing's):
   - Extensions > Apps Script on the Sheet (or a new script project pointing
     at the same Sheet)
   - Paste in `scripts/google-ads-apps-script-webapp.gs`
   - Set `SHEET_ID` (same Sheet as before)
   - Set `SHARED_SECRET` to a new random string
   - Deploy > New deployment > Web app > Execute as "Me" > Who has access
     "Anyone" (not "Anyone within domain" — same gotcha as the Bing setup)
   - Copy the `/exec` URL
3. In **Google Ads Account A**: Tools & Settings > Bulk Actions > Scripts >
   + Script
   - Paste in `scripts/google-ads-export.js`
   - Set `WEBAPP_URL` to the `/exec` URL from step 2
   - Set `SHARED_SECRET` to match
   - Set `ACCOUNT_LABEL = 'Account A'`
   - Fill in `ACTIVE_CAMPAIGNS` with this account's exact, currently-active
     campaign names (check the account's Campaigns tab if unsure)
   - Run once manually, check the log for a `200` response and check the
     Sheet for a new `google_ads_raw` tab with rows
   - Schedule it daily
4. Repeat step 3 in **Google Ads Account LP** — same script, same
   `WEBAPP_URL`/`SHARED_SECRET`, but `ACCOUNT_LABEL = 'Account LP'` and that
   account's own `ACTIVE_CAMPAIGNS` list
5. Connect `google_ads_raw` in Looker Studio: Add Data Source > Google
   Sheets > same Sheet > tab `google_ads_raw`. Field types: `date` as Date,
   `impressions`/`clicks`/`conversions` as Number, `cost` as Currency
6. Add the `MonthKey` calculated field here too (`FORMAT_DATETIME("%Y-%m", date)`,
   type Text), same as every other source

## Rollback / off switch

Nothing here touches your live Bing Ads account beyond reading stats — to
stop it, just delete the scheduled trigger on the Microsoft Ads Script, or
revoke the Apps Script Web App deployment. No data already written to the
Sheet is affected either way.
