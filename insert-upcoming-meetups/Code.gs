// Please check the README.md for details on how to run this.

// Register a new Meetup consumer here:
// https://secure.meetup.com/meetup_api/oauth_consumers/create
//
// Add the consumer's key and secret as a CLIENT_ID and CLIENT_SECRET in
// "File > Project properties > Script properties".

function debugProjectKey() {
  var projectKey = ScriptApp.getProjectKey();
  Logger.log("projectKey = %s", projectKey);
}

function resetAccessToken() {
  var service = getMeetupService();
  service.reset();
  Logger.log("Reset OAuth2 token for Meetup service.");
}

function showError(errorMessage) {
  DocumentApp.getUi().alert(errorMessage);
}

function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  // XXX - if this document-specific, then just call createMenu 
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem("Insert Upcoming Meetups", "insertUpcomingMeetups")
    .addItem("Configure Filters", "showSidebar")
    .addItem("Reset User", "resetAccessToken")
    .addToUi();
}

var MeetupEvent = function(id, title, time, eventHosts, groupName, url) {
  this.id = id;
  this.title = title;
  this.time = time;
  this.eventHosts = eventHosts;
  this.groupName = groupName;
  this.url = url;
};

var MeetupGroup = function(id, name, url) {
  this.id = id;
  this.name = name;
  this.url = url;
};

// array of event objects
function getMeetupsThisWeek() {
  var service = getMeetupService();
  showAuthorizationSidebarIfNecessary(service);
  
  if (service.hasAccess()) {
    api = MeetupAPI.createApi(service.getAccessToken());
    
    var preferences = getPreferences();
    var jsonResponse = api.events("id,name,time,event_hosts.member_name,group.name,event_url", 
                                  preferences.groupIds, 
                                  preferences.timeRange);
    
    var meetupsThisWeek = [];
    for (var i = 0; i < jsonResponse.results.length; i++) {
      var eventJson = jsonResponse.results[i];
      
      var eventHosts = [];
      if (!!eventJson.event_hosts) {
        for (var j = 0; j < eventJson.event_hosts.length; j++) {
          eventHosts.push(eventJson.event_hosts[j].member_name.trim());
        }
      }
      
      var meetupEvent = new MeetupEvent(
        eventJson.id,
        eventJson.name,
        new Date(eventJson.time), // XXX - convert from epoch time
        eventHosts,
        eventJson.group.name,
        eventJson.event_url
      );
            
      meetupsThisWeek.push(meetupEvent);
    }

    Logger.log("meetupsThisWeek = %s", meetupsThisWeek);
    return meetupsThisWeek;    
  }
}

function getFormattedDateString(date) {
  var now = new Date();
  var todayString = now.toLocaleDateString();
  var tomorrow = now;
  tomorrow.setDate(now.getDate() + 1);
  var tomorrowString = tomorrow.toLocaleDateString();
      
  var dateString = "";
  if (date.toLocaleDateString() == todayString) {
    dateString = "Today, " + Utilities.formatDate(date, Session.getScriptTimeZone(), "h:mma");
  }
  else if (date.toLocaleDateString() == tomorrowString) {
    dateString = "Tomorrow, " + Utilities.formatDate(date, Session.getScriptTimeZone(), "h:mma");
  }
  else if (date.getTime() - now.getTime() < 0) {
    dateString = "[PAST] " + Utilities.formatDate(date, Session.getScriptTimeZone(), "EEE MMM dd',' h:mma");
  }
  else if (date.getTime() - now.getTime() > 604800000) {
    dateString = Utilities.formatDate(date, Session.getScriptTimeZone(), "EEE MMM dd',' h:mma");
  }
  else {
    dateString = Utilities.formatDate(date, Session.getScriptTimeZone(), "EEE',' h:mma");
  }

  return dateString;
}

function insertUpcomingMeetups() {
  var preferences = getPreferences();
  Logger.log("preferences = %s", preferences);
  if (preferences.groupIds == null || preferences.groupIds.length == 0) {
    showError("No groups selected! Please \"Configure Filters\".");
    return;
  }

  var service = getMeetupService();
  showAuthorizationSidebarIfNecessary(service);
  
  if (service.hasAccess()) {
    var meetupsThisWeek = getMeetupsThisWeek();

    var groupsMap = {};
    for (var i = 0; i < meetupsThisWeek.length; i++) {
      var groupName = meetupsThisWeek[i].groupName;
      if (!(groupName in groupsMap)) {
        groupsMap[groupName] = 1;
      }
    }
    var groupsArray = Object.keys(groupsMap)
    
    var document = DocumentApp.getActiveDocument();
    var body = document.getBody();

    // XXX - cursor stays put?
    document.setCursor(document.newPosition(body, 0));

    for (var i = 0; i < groupsArray.length; i++) {
      var groupName = groupsArray[i];

      body.appendListItem(groupName)
        .setNestingLevel(0);
        
      for (var j = 0; j < meetupsThisWeek.length; j++) {
        var meetupEvent = meetupsThisWeek[j];
        
        if (meetupEvent.groupName != groupName) {
          continue;
        }
      
        var dateString = getFormattedDateString(meetupEvent.time);
        
        var listItem = body.appendListItem("")
          // XXX - not sure why i have to setGlyphType twice
          .setGlyphType(DocumentApp.GlyphType.BULLET)
          .setNestingLevel(1)
          .setGlyphType(DocumentApp.GlyphType.BULLET)
          .appendText(dateString + ":")
          .appendText(" " + meetupEvent.title + " ")
          //.setBold(0, dateString.length + 1, true)
          .setLinkUrl(dateString.length + 2, dateString.length + 1 + meetupEvent.title.length, meetupEvent.url);
        
        if (meetupEvent.eventHosts.length > 0) {
          listItem.appendText("[" + meetupEvent.eventHosts.join("/") + "]")
        }
      }
    }
  }
}

function getMemberGroups() {
  var service = getMeetupService();
  showAuthorizationSidebarIfNecessary(service);
  
  if (service.hasAccess()) {
    api = MeetupAPI.createApi(service.getAccessToken());
    
    var jsonResponse = api.groups("id,name,link");
    
    var memberGroups = [];
    for (var i = 0; i < jsonResponse.length; i++) {
      var groupJson = jsonResponse[i];
      
      var meetupGroup = new MeetupGroup(
        groupJson.id,
        groupJson.name,
        groupJson.link
      );
            
      memberGroups.push(meetupGroup);
    }

    //Logger.log("memberGroups = %s", memberGroups);
    return memberGroups;
  }
}

function showSidebar() {
  var service = getMeetupService();
  showAuthorizationSidebarIfNecessary(service);
  
  if (service.hasAccess()) {
    var template = HtmlService.createTemplateFromFile("Sidebar");
    template.memberGroups = getMemberGroups();
    
    var groupIdsMap = {};
    var preferences = getPreferences();
    for (var i = 0; i < preferences.groupIds.length; i++) {
      groupIdsMap[preferences.groupIds[i]] = 1;
    }
    template.groupIds = groupIdsMap;
    template.timeRange = preferences.timeRange;
    
    Logger.log("preferences = %s", preferences);
    
    var html = template.evaluate()
      .setTitle("Configure Filters");
    DocumentApp.getUi().showSidebar(html);
  }
}

function getPreferences() {
  var userProperties = PropertiesService.getUserProperties();
  var groupIds = [];
  if (!!userProperties.getProperty("groupIds")) {
    groupIds = userProperties.getProperty("groupIds").split(',');
  }

  var timeRange = "-1d,1w";
  if (!!userProperties.getProperty("timeRange")) {
    timeRange = userProperties.getProperty("timeRange");
  }

  return {
    groupIds: groupIds,
    timeRange: timeRange
  };
}

function savePreferences(groupIds, timeRange) {
  Logger.log("groupIds = %s", groupIds);
  Logger.log("timeRange = %s", timeRange);
  
  var userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("groupIds", groupIds.join(','));
  userProperties.setProperty("timeRange", timeRange);
}

function logRedirectUri() {
  var service = getService();
  Logger.log(service.getRedirectUri());
}

function getMeetupService() {
  return OAuth2.createService("meetup")
    .setAuthorizationBaseUrl("https://secure.meetup.com/oauth2/authorize")
    .setTokenUrl("https://secure.meetup.com/oauth2/access")
    .setClientId(PropertiesService.getScriptProperties().getProperty("CLIENT_ID"))
    .setClientSecret(PropertiesService.getScriptProperties().getProperty("CLIENT_SECRET"))
    .setCallbackFunction("authCallback")
    .setPropertyStore(PropertiesService.getUserProperties())
}

function showAuthorizationSidebarIfNecessary(service) {
  if (!service.hasAccess()) {
    var authorizationUrl = service.getAuthorizationUrl();
    //Logger.log("authorizationUrl = %s", authorizationUrl);

    var template = HtmlService.createTemplate(
      "<a href=\"<?= authorizationUrl ?>\" target=\"_blank\">Authorize</a>. " +
      "Reopen the sidebar when the authorization is complete.");
    template.authorizationUrl = authorizationUrl;

    var html = template.evaluate();
    DocumentApp.getUi().showSidebar(html);
  }
}

function authCallback(request) {
  var service = getMeetupService();
  var isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("Success!")
  } else {
    return HtmlService.createHtmlOutput("Failed")
  }
}
