// Google Ads Script
// Deploy inside: Google Ads UI > Tools & Settings > Bulk Actions > Scripts
// Deploy this SAME script separately in BOTH Google Ads accounts (Account A
// and Account LP) - just change ACCOUNT_LABEL below for each deployment.
// Purpose: push active campaign performance to a Google Sheet (via the
// companion Apps Script Web App in google-ads-apps-script-webapp.gs) so
// Looker Studio can read it through the native Sheets connector, sidestepping
// the "Auto" aggregation lock on Google Ads' native connector metrics.
//
// Schedule this to run daily (Google Ads > Scripts > schedule).

var WEBAPP_URL = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE'; // same URL for both accounts
var SHARED_SECRET = 'PASTE_SHARED_SECRET_HERE'; // same secret for both accounts
var DATE_RANGE = 'YESTERDAY';

// CHANGE THIS per account when deploying - "Account A" in one account's
// script, "Account LP" in the other's.
var ACCOUNT_LABEL = 'Account A';

// Maintained list of active campaign names for THIS account, same reasoning
// as Bing's ACTIVE_CAMPAIGNS: update this whenever a campaign is paused,
// ended, or a new one goes live in this account.
var ACTIVE_CAMPAIGNS = [
  'PASTE_EXACT_CAMPAIGN_NAME_1',
  'PASTE_EXACT_CAMPAIGN_NAME_2'
];

function main() {
  var rows = [];
  var runDate = statDate(DATE_RANGE);

  var campaignIterator = AdsApp.campaigns()
    .forDateRange(DATE_RANGE)
    .get();

  while (campaignIterator.hasNext()) {
    var campaign = campaignIterator.next();
    var name = campaign.getName();

    if (ACTIVE_CAMPAIGNS.indexOf(name) === -1) {
      continue; // not in the maintained active list - skip
    }

    var stats = campaign.getStatsFor(DATE_RANGE);

    rows.push({
      date: runDate,
      account: ACCOUNT_LABEL,
      channel: 'Google Ads',
      campaign: name,
      status: 'Active',
      impressions: stats.getImpressions(),
      clicks: stats.getClicks(),
      cost: stats.getCost(),
      conversions: stats.getConversions()
    });
  }

  if (rows.length === 0) {
    Logger.log('No campaigns from ACTIVE_CAMPAIGNS matched for ' + runDate + '. Nothing sent.');
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
