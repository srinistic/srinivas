// Google Apps Script Web App — receiver for Google Ads Script data
// Deploy inside: script.google.com (bind to, or point at, the target Sheet)
// Deploy as: Web App — Execute as "Me", Access "Anyone with the link"
// Purpose: receive POSTed campaign rows from google-ads-export.js (deployed
// once per Google Ads account) and upsert them into a Sheet that Looker
// Studio reads via the native Sheets connector.
//
// This is a separate receiver from apps-script-webapp.gs (the Bing one) so
// the already-working Bing pipeline is never touched by changes here.

var SHEET_ID = 'PASTE_TARGET_SPREADSHEET_ID_HERE';
var SHEET_NAME = 'google_ads_raw';
var SHARED_SECRET = 'PASTE_SHARED_SECRET_HERE'; // must match google-ads-export.js on BOTH accounts

var HEADERS = ['date', 'account', 'channel', 'campaign', 'status', 'impressions', 'clicks', 'cost', 'conversions', 'last_updated'];

function doPost(e) {
  var result = { ok: false };
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }

    var sheet = getOrCreateSheet();
    upsertRows(sheet, body.rows || []);

    result.ok = true;
    result.rowsWritten = (body.rows || []).length;
  } catch (err) {
    result.error = err.message;
  }
  return jsonResponse(result);
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

// Keyed on date+account+campaign - the account is part of the key because
// two different Google Ads accounts could in principle have campaigns with
// the same name, and we don't want those colliding.
function upsertRows(sheet, rows) {
  var data = sheet.getDataRange().getValues();
  var keyIndex = {};

  for (var i = 1; i < data.length; i++) {
    var key = data[i][0] + '|' + data[i][1] + '|' + data[i][3];
    keyIndex[key] = i + 1;
  }

  var now = new Date();

  rows.forEach(function (row) {
    var key = row.date + '|' + row.account + '|' + row.campaign;
    var values = [
      row.date, row.account, row.channel, row.campaign, row.status,
      row.impressions, row.clicks, row.cost, row.conversions,
      now
    ];

    if (keyIndex[key]) {
      sheet.getRange(keyIndex[key], 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
