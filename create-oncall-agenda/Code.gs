// WIP: Create the on-call agenda by pulling incidents of the last week from PagerDuty and reference them
// with Slack discussion in #production-status. Agenda is outputted in Confluence Wiki Markup format.

// TODO:
// - highlight dates that are out of work hours (Sat, Sun too)
// - add who's on call next week
// - grab notes for who's on call
// - quick stats of when the issues were paged

var PAGERDUTY_API_BASE = "https://api.pagerduty.com/"

// https://api.slack.com/apps/A2EP1LBFA
var SLACK_API_BASE = "https://slack.com/api/"
var SLACK_CLIENT_ID = ""
var SLACK_CLIENT_SECRET = ""

function testStuff() {
  //PropertiesService.getUserProperties().setProperty("pagerdutyAuthToken", "");
}

function onOpen(e) {
  // XXX - if this document-specific, then just call createMenu 
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem("Insert Incidents from Last Week (Confluence Wiki Format)", "checkThenInsertIncidents")
    .addToUi();
}

var Incident = function(incident_num, created_at, responder, status, description, html_url, body, customDetails) {
  this.incident_num = incident_num;
  this.created_at = created_at;
  this.responder = responder;
  this.status = status;
  this.description = description;
  this.html_url = html_url;
  this.body = body;
  this.customDetails = customDetails;
}

var SlackMessage = function(incident_num, permalink) {
  this.incident_num = incident_num;
  this.permalink = permalink;
}

function checkThenInsertIncidents() {
  showSidebar(insertIncidentsFromLastWeekAsConfluenceWiki);
}

function insertIncidentsFromLastWeek() {
  var slackMessagesByIncidentNumber = getSlackMessagesByIncidentNumberFromLastWeek();
  var incidentsThisWeek = getIncidentsFromLastWeek();
  
  var document = DocumentApp.getActiveDocument();
  var body = document.getBody();
  var defaultStyle = body.getAttributes();
  
  var codeStyle = {};
  codeStyle[DocumentApp.Attribute.FONT_FAMILY] = "Courier New";
  codeStyle[DocumentApp.Attribute.FONT_SIZE] = 7;
  codeStyle[DocumentApp.Attribute.INDENT_FIRST_LINE] = 36;
  codeStyle[DocumentApp.Attribute.INDENT_START] = 36;
  
  var highlightStyle = {};
  highlightStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = "#FFFF00";
  highlightStyle[DocumentApp.Attribute.BOLD] = true;  
  
  document.setCursor(document.newPosition(body, 0));
  
  // parse list of incidents into repeating ones
  var incidentsByType = {};
  for (var i = 0; i < incidentsThisWeek.length; i++) {
    var incident = incidentsThisWeek[i];
    
    var incidentKey = incident.description.replace(/\d+/g, "*");
    if (incidentKey in incidentsByType) {
      incidentsByType[incidentKey].push(incident);
    }
    else {
      incidentsByType[incidentKey] = [incident];
    }
  }

  body.appendParagraph("Recurring incidents of the week:")
    .setHeading(DocumentApp.ParagraphHeading.HEADING5);

  // XXX - sort this list by incidents
  for (var incidentKey in incidentsByType) {
    var incidentsByKey = incidentsByType[incidentKey];
    if (incidentsByKey.length > 1) {
      body
        .appendListItem("")
        .setGlyphType(DocumentApp.GlyphType.BULLET)
        .appendText(incidentsByKey.length + " incidents of " + incidentKey)
        .setAttributes(defaultStyle)

      /*      
      for (var i = 0; i < incidentsByKey.length; i++) {
        var incident = incidentsByKey[i];
        
        body.editAsText().appendText(incident.description + "\n");
      }
      */
    }
  }

  var bodyParagraph = body
    .appendParagraph("")
    .setAttributes(defaultStyle);

  // actual incidents of the week
  var dateString = "";
  for (var i = 0; i < incidentsThisWeek.length; i++) {
    var incident = incidentsThisWeek[i];
    
    // possible header
    var incidentDateString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "EEE',' MM/dd/YYYY");
    if (dateString !== incidentDateString) {
      body.appendParagraph(incidentDateString + ":")
        .setHeading(DocumentApp.ParagraphHeading.HEADING5);
      dateString = incidentDateString;
    }
    
    // each incident chunk
    var timeString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "h:mma").toLowerCase();

    // slack url, based off the epoch time (in nanoseconds)
    // XXX - token for the api should just use oauth 2.0, the link isn't accurate to pinpoint the precise message
    // https://meetuphq.slack.com/archives/production-status/p1474497334001954
    // https://slack.com/api/search.messages?token=<token>&query=after%3A2016-09-15%20from%3APagerDuty%20Triggered%20in%3A%23production-status&count=100&pretty=1
    
//    var slackUrl = "https://meetuphq.slack.com/archives/production-status/p" + incident.created_at.getTime() + "000" 
  
    var titleListItem = body
      .appendListItem("")
      .setGlyphType(DocumentApp.GlyphType.BULLET)
      .appendText(timeString + ": [#" + incident.incident_num + "] " + incident.description + " [" + incident.responder + "]")
      .setAttributes(defaultStyle)
      .setLinkUrl(timeString.length + 3, timeString.length + incident.incident_num.toString().length + 3, incident.html_url);

    var slackMessage = slackMessagesByIncidentNumber[incident.incident_num];
    if (slackMessage) {
      titleListItem.setLinkUrl(0, timeString.length - 1, slackMessage.permalink);
    }
    
    // there's probably a better way to do this
    var hourOfIncident = parseInt(Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "H"));
    if (hourOfIncident < 10 || hourOfIncident >= 19) {
      titleListItem.setAttributes(0, timeString.length - 1, highlightStyle);
    }
    
    var incidentBody = "";
    if (incident.body) {
      incidentBody = incident.body
        .replace(/Please see\:.*[.\r\n]*.*minutes without page/m, "")
        .replace(/\n[\n]+/g, "\n\n")
    }
    incidentBody = "\n" + incidentBody.trim() + "\n";
    var bodyParagraph = body
      .appendParagraph(incidentBody)
      .editAsText()
      .setAttributes(codeStyle);
  }
}

/*
function insertIncidentsFromLastWeekAsTable() {
  var slackMessagesByIncidentNumber = getSlackMessagesByIncidentNumberFromLastWeek();
  var incidentsThisWeek = getIncidentsFromLastWeek();
  
  var document = DocumentApp.getActiveDocument();
  var body = document.getBody();
  var defaultStyle = body.getAttributes();
  
  var codeStyle = {};
  codeStyle[DocumentApp.Attribute.FONT_FAMILY] = "Courier New";
  codeStyle[DocumentApp.Attribute.FONT_SIZE] = 7;
  codeStyle[DocumentApp.Attribute.INDENT_FIRST_LINE] = 36;
  codeStyle[DocumentApp.Attribute.INDENT_START] = 36;
  
  var highlightStyle = {};
  highlightStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = "#FFFF00";
  highlightStyle[DocumentApp.Attribute.BOLD] = true;  
  
  document.setCursor(document.newPosition(body, 0));
  
  // actual incidents of the week
  var dateString = "";

  var incidentTable = body.appendTable();
  
  for (var i = 0; i < incidentsThisWeek.length; i++) {
    var tableRow = incidentTable.appendTableRow();
    var incident = incidentsThisWeek[i];
    
    // date
    var incidentDateString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "EEE',' MM/dd/YYYY");
    if (dateString !== incidentDateString) {
      tableRow.appendTableCell(incidentDateString).setAttributes(defaultStyle);
      dateString = incidentDateString;
    }
    else {
      tableRow.appendTableCell("").setAttributes(defaultStyle);
    }
    
    // time
    var timeString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "h:mma").toLowerCase();
    var timeCell = tableRow.appendTableCell(timeString);

    // highlight the incident if it happened off-hours; there's probably a better way to do this
    var hourOfIncident = parseInt(Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "H"));
    if (hourOfIncident < 10 || hourOfIncident >= 19) {
      timeCell.setAttributes(highlightStyle);
    }
    else {
      timeCell.setAttributes(defaultStyle);
    }

    var slackMessage = slackMessagesByIncidentNumber[incident.incident_num];
    if (slackMessage) {
      timeCell.setLinkUrl(slackMessage.permalink);
    }

    // pagerduty incident
    var pagerDutyCell = tableRow.appendTableCell("#" + incident.incident_num);
    pagerDutyCell.setAttributes(defaultStyle);
    pagerDutyCell.setLinkUrl(incident.html_url);

    // description
    tableRow.appendTableCell(incident.description);

    // XXX - status
    
    // responder
    tableRow.appendTableCell(incident.responder);
    
    // details
    var incidentDetails = incident.body
      .replace(/Please see\:.*[.\r\n]*.*minutes without page/m, "")
      .replace(/\n[\n]+/g, "\n\n")
      .trim();
    var detailsCell = tableRow.appendTableCell(incidentDetails);
    detailsCell.setAttributes(codeStyle);
  }  
}
*/

function insertIncidentsFromLastWeekAsConfluenceWiki() {
  var document = DocumentApp.getActiveDocument();
  var body = document.getBody();
  
  document.setCursor(document.newPosition(body, 0));
  
  body.editAsText().appendText("h1. Discussion\n");
  body.editAsText().appendText("* Announcements\n");
  body.editAsText().appendText("* Last week's agenda tasks\n");
  body.editAsText().appendText("* Upcoming production changes\n");
  body.editAsText().appendText("* Non-paging events\n\n");

  body.editAsText().appendText("h1. Issues from Last Week\n" +
                               "If any issues have recurred, can we assign someone to look into this issue? " +
                               "If an issue hasn't been updated in a while, why not? (Comments should live in each JIRA issue.)\n\n");

  body.editAsText().appendText("h1. Active Issues\n" +
                               "Put issues here that the next on-call shift should be aware of. Add a playbook if it doesn't exist yet.\n" +
                               "||JIRA Issue||Playbook||\n" +
                               "| | |\n\n");
  
  body.editAsText().appendText("h1. Who's On-call Next Week\n" +
                               "||Team||Engineer On-call||\n" +
                               "|*Systems*|@systems_on_call|\n" +
                               "|*Dev*|@dev_on_call|\n");
  
  body.editAsText().appendText("h1. Events of the Week\n" +
                               "@systems_oncall & @dev_oncall were on-call. Any insights?\n" );

  var slackMessagesByIncidentNumber = getSlackMessagesByIncidentNumberFromLastWeek();
  var incidentsThisWeek = getIncidentsFromLastWeek();
  
  // parse list of incidents into repeating ones
  var incidentsByType = {};
  for (var i = 0; i < incidentsThisWeek.length; i++) {
    var incident = incidentsThisWeek[i];
    
    var incidentKey = incident.description.replace(/\d+/g, "*");
    if (incidentKey in incidentsByType) {
      incidentsByType[incidentKey].push(incident);
    }
    else {
      incidentsByType[incidentKey] = [incident];
    }
  }
  
  body.editAsText().appendText("h2. Repeating Issues\n" +
                               "||Description||#s||Process||JIRA Issue||Notes||\n");

  var repeatingIncidents = [];
  for (var incidentKey in incidentsByType) {
    var incidentsByKey = incidentsByType[incidentKey];
    if (incidentsByKey.length > 1) {
      repeatingIncidents.push({
        "key": incidentKey,
        "occurrences": incidentsByKey.length
      });
    }
  }
  repeatingIncidents.sort(function(a, b) { return b["occurrences"] - a["occurrences"]; });

  for (var i = 0; i < repeatingIncidents.length; i++) {
    var repeatingIncident = repeatingIncidents[i];
    body.editAsText().appendText("|" + repeatingIncident["key"] + 
                                 "|" + repeatingIncident["occurrences"] + 
                                 "| " +
                                 "| " +
                                 "| " +
                                 "|\n");
  }

  // actual incidents of the week
  body.editAsText().appendText("\n\nh2. Tasks\n\n");
  body.editAsText().appendText("\n\nh2. Alerts\n");
  
  var dateString = "";
  for (var i = 0; i < incidentsThisWeek.length; i++) {
    var incident = incidentsThisWeek[i];
    
    // date
    var incidentDateString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "EEE',' MM/dd/YYYY");
    if (dateString !== incidentDateString) {
      body.editAsText().appendText("h3. " + incidentDateString + "\n" +
                                   "||Time||PagerDuty||Description/Notes||Resolver||Details||\n");
      dateString = incidentDateString;
    }
    
    // time
    var timeString = Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "h:mma").toLowerCase();

    var slackMessage = slackMessagesByIncidentNumber[incident.incident_num];
    if (slackMessage) {
      timeString = "[" + timeString + "|" + slackMessage.permalink + "]";
    }
    
    // highlight the incident if it happened off-hours; there's probably a better way to do this
    var hourOfIncident = parseInt(Utilities.formatDate(incident.created_at, Session.getScriptTimeZone(), "H"));
    if (hourOfIncident < 10 || hourOfIncident >= 19) {
      timeString = timeString + " (*r)";
    }

    // pagerduty incident
    var pagerDutyString = "[#" + incident.incident_num + "|" + incident.html_url + "]";
    
    // description
    var description = incident.description;

    
    // XXX - status
    
    // responder
    var responder = incident.responder;
    
    // details
    var incidentDetails = " ";
    if (incident.body) {
      incidentDetails = incident.body
        .replace(/Please see\:.*[.\r\n]*.*minutes without page/m, "")
        .replace(/\n[\n]+/g, "\n\n")
        .trim();
      incidentDetails = "{code}" + incidentDetails + "{code}";
    }
    else if (incident.customDetails) {
      incidentDetails = incident.customDetails
        .replace(/\n[\n]+/g, "\n\n")
        .trim();
      incidentDetails = "{code}" + incidentDetails + "{code}";
    }

    body.editAsText().appendText("|" + timeString + 
                                 "|" + pagerDutyString + 
                                 "|" + description + 
                                 "|" + responder + 
                                 "|" + incidentDetails + "|\n");
  }  
}

function getSlackMessagesByIncidentNumberFromLastWeek() {
  var sinceDate = new Date(new Date().getTime() - 8 * (24 * 3600 * 1000));

  var slackService = getSlackService();
  var pagerDutySlackMessages = slackApiCall("search.messages", {
    "query": "Triggered in:production-status from:PagerDuty Trigger after:" + Utilities.formatDate(sinceDate, Session.getScriptTimeZone(), "YYYY-MM-dd"),
    "count": "100"
  });
  
  var slackMessagesByIncidentNumber = {};
  var incidentNumberRegex = /#(\d+)/;
  for (var i = 0; i < pagerDutySlackMessages.messages.matches.length; i++) {
    var slackMessage = pagerDutySlackMessages.messages.matches[i]; 

    var incidentNumber = slackMessage.attachments[0].text.match(incidentNumberRegex)[1];
    
    slackMessagesByIncidentNumber[incidentNumber] = new SlackMessage(
      incidentNumber,
      slackMessage.permalink
    );
  }
  
  //Logger.log("slackMessagesByIncidentNumber = %s", slackMessagesByIncidentNumber);
  return slackMessagesByIncidentNumber;
}

function getIncidentsFromLastWeek() {
  var sinceDate = new Date(new Date().getTime() - 7 * (24 * 3600 * 1000));
  

  // XXX - pagination on "more" https://v2.developer.pagerduty.com/docs/pagination
  
  var incidentsFromLastWeek = []
  var more = true
  var limit = 100
  
  for (var offset = 0; more; offset = offset + 100) {

    var jsonResponse = pagerDutyApiCall("incidents", {
      "since": Utilities.formatDate(sinceDate, Session.getScriptTimeZone(), "YYYY-MM-dd"),
      "timezone": "UTC",
      "include[]": "first_trigger_log_entries",
//    "include[]": "acknowledgers", // XXX - cannot for the life of me figure out how to get ack'rs to show up in the response
      "limit": limit,
      "offset": offset
    });

    for (var i = 0; i < jsonResponse.incidents.length; i++) {
      var incidentJson = jsonResponse.incidents[i];
    
      var incident = new Incident(
        incidentJson.incident_number,
        parseUTCDate(incidentJson.created_at), // "2016-09-01T10:12:25Z"
        incidentJson.last_status_change_by.summary, // "Brandon Price"
        incidentJson.status, // "resolved", "acknowledged"
        incidentJson.first_trigger_log_entry.event_details.description, // "!BB: 2295010 red! -- deploy1.meetup.com.graphite"
        incidentJson.html_url, // "https://meetup.pagerduty.com/services/P8LP147"
        incidentJson.first_trigger_log_entry.channel.body,
        (incidentJson.first_trigger_log_entry.channel.details) ? incidentJson.first_trigger_log_entry.channel.details.description : null
      );
    
      incidentsFromLastWeek.push(incident);
    }
    
    more = jsonResponse.more
  }
  
  //Logger.log("incidentsFromLastWeek = %s", incidentsFromLastWeek);
  return incidentsFromLastWeek;  
}

function pagerDutyApiCall(path, queryStringParams) {
  var queryStringArray = [];
  for (key in queryStringParams) {
    queryStringArray.push(encodeURIComponent(key) + "=" + encodeURIComponent(queryStringParams[key]));
  }
  
  var authToken = PropertiesService.getScriptProperties().getProperty("pagerdutyAuthToken");
    
  var params = {
    headers: {
      "Authorization": "Token token=" + authToken,
      "Accept": "application/vnd.pagerduty+json;version=2"
    }
  };
  
  try {
    var response = UrlFetchApp.fetch(PAGERDUTY_API_BASE 
                                     + path + "?" 
                                     + queryStringArray.join("&"), params);
    return JSON.parse(response.getContentText());
  }
  catch(err) {
    Logger.log(err);
  }
}

// https://code.google.com/p/google-apps-script-issues/issues/detail?id=2426
function parseUTCDate(dateString) {
  return new Date(dateString.replace("Z", ".000Z"));
}

// oauth2 for slack
function getSlackService() {
  return OAuth2.createService("slack")
    .setAuthorizationBaseUrl("https://slack.com/oauth/authorize")
    .setTokenUrl("https://slack.com/api/oauth.access")
    .setClientId(SLACK_CLIENT_ID)
    .setClientSecret(SLACK_CLIENT_SECRET)
    .setCallbackFunction("authCallback")
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope("search:read");
}

function showSidebar(postAuthCallback) {
  var slackService = getSlackService();
  Logger.log("slackService.hasAccess() = " + slackService.hasAccess());
  if (!slackService.hasAccess()) {
    var authorizationUrl = slackService.getAuthorizationUrl();
    var template = HtmlService.createTemplate(
        '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>. ' +
        'Reopen the sidebar when the authorization is complete.');
    template.authorizationUrl = authorizationUrl;
    var page = template.evaluate();
    DocumentApp.getUi().showSidebar(page);
  }
  else {
    postAuthCallback();
  }
}

function slackApiCall(path, queryStringParams) {
  var slackService = getSlackService();
  var authToken = slackService.getAccessToken();

  var queryStringArray = ["token=" + authToken];
  for (key in queryStringParams) {
    queryStringArray.push(encodeURIComponent(key) + "=" + encodeURIComponent(queryStringParams[key]));
  }
  
  try {
    var response = UrlFetchApp.fetch(SLACK_API_BASE 
                                     + path + "?" 
                                     + queryStringArray.join("&"));
    return JSON.parse(response.getContentText());
  }
  catch(err) {
    Logger.log(err);
  }
}

function authCallback(request) {
  var slackService = getSlackService();
  var isAuthorized = slackService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

function logRedirectUri() {
  var service = getSlackService();
  Logger.log(service.getRedirectUri());
}
