// Google Apps Script Web App
// Deploy inside: script.google.com (bind to, or point at, the target Sheet)
// Deploy as: Web App — Execute as "Me", Access "Anyone with the link"
// Purpose: receive POSTed campaign rows from microsoft-ads-export.js and
// upsert them into a Sheet that Looker Studio reads via the native Sheets
// connector.

var SHEET_ID = 'PASTE_TARGET_SPREADSHEET_ID_HERE';
var SHEET_NAME = 'bing_ads_raw';
var SHARED_SECRET = 'PASTE_SHARED_SECRET_HERE'; // must match microsoft-ads-export.js

var HEADERS = ['date', 'channel', 'campaign', 'status', 'impressions', 'clicks', 'cost', 'conversions', 'last_updated'];

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

// Keyed on date+campaign so a re-run (or Microsoft Ads stat corrections a
// day later) overwrites the existing row instead of duplicating it.
function upsertRows(sheet, rows) {
  var data = sheet.getDataRange().getValues();
  var keyIndex = {};

  for (var i = 1; i < data.length; i++) {
    var key = data[i][0] + '|' + data[i][2];
    keyIndex[key] = i + 1;
  }

  var now = new Date();

  rows.forEach(function (row) {
    var key = row.date + '|' + row.campaign;
    var values = [
      row.date, row.channel, row.campaign, row.status,
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
