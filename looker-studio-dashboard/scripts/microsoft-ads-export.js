// Microsoft Advertising Script
// Deploy inside: Microsoft Advertising UI > Automate > Scripts
// Purpose: push active campaign performance to a Google Sheet (via the companion
// Apps Script Web App in apps-script-webapp.gs) so Looker Studio can read it
// through the native Google Sheets connector.
//
// Schedule this to run daily (Microsoft Advertising > Scripts > schedule).

var WEBAPP_URL = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';
var SHARED_SECRET = 'PASTE_SHARED_SECRET_HERE'; // must match apps-script-webapp.gs
var DATE_RANGE = 'YESTERDAY'; // Microsoft Ads stats aren't final same-day; pull T-1

function main() {
  var rows = [];
  var runDate = statDate(DATE_RANGE);

  // NOTE: not filtering by status here. Microsoft's isEnabled()/isPaused()
  // methods returned false for every campaign in testing (a known mismatch
  // with their docs, not a bug in this script), so a status filter can't be
  // trusted right now. As of this writing the account has exactly 3
  // campaigns total (Insurance Verification AI, Claims Processing AI, Voice
  // AI Agent), all of which are the real active set per the budget sheet -
  // if paused/ended campaigns get added to this account later, revisit this.
  var campaignIterator = AdsApp.campaigns()
    .forDateRange(DATE_RANGE)
    .get();

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var stats = campaign.getStats();

    rows.push({
      date: runDate,
      channel: 'Bing Ads',
      campaign: campaign.getName(),
      status: 'Active',
      impressions: stats.getImpressions(),
      clicks: stats.getClicks(),
      cost: stats.getCost(),
      conversions: stats.getConversions()
    });
  }

  if (rows.length === 0) {
    Logger.log('No enabled campaigns with stats for ' + runDate + '. Nothing sent.');
    return;
  }

  var response = UrlFetchApp.fetch(WEBAPP_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: SHARED_SECRET, rows: rows }),
    muteHttpExceptions: true
  });

  Logger.log('POST status ' + response.getResponseCode() + ': ' + response.getContentText());
}

function statDate(dateRange) {
  var d = new Date();
  if (dateRange === 'YESTERDAY') {
    d.setDate(d.getDate() - 1);
  }
  var yyyy = d.getFullYear();
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var dd = ('0' + d.getDate()).slice(-2);
  return yyyy + '-' + mm + '-' + dd;
}
