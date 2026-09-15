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

## Rollback / off switch

Nothing here touches your live Bing Ads account beyond reading stats — to
stop it, just delete the scheduled trigger on the Microsoft Ads Script, or
revoke the Apps Script Web App deployment. No data already written to the
Sheet is affected either way.
