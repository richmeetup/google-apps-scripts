(function (host, expose) {
   var module = { exports: {} };
   var exports = module.exports;

/* START CODE */
  
if (module) {
  module.exports = {
    createApi: createApi
  };
}
  
var MEETUP_API_BASE = "https://api.meetup.com"

var MeetupAPI_ = function(accessToken) {
  this.accessToken_ = accessToken;
};

function createApi(accessToken) {
  return new MeetupAPI_(accessToken);
}

MeetupAPI_.prototype.call = function(path, queryStringParams) {
  var queryStringArray = [];
  for (key in queryStringParams) {
    queryStringArray.push(encodeURIComponent(key) + "=" + encodeURIComponent(queryStringParams[key]))
  }
  
  var response = UrlFetchApp.fetch(MEETUP_API_BASE 
                                   + path + "?" 
                                   + queryStringArray.join("&"), {
    headers: {
      "Authorization": "Bearer " + this.accessToken_
    }
  });

  return JSON.parse(response.getContentText());
}

MeetupAPI_.prototype.member = function(id) {
  return this.call("/2/member/" + id);
}

// fields is a comma-delimited list
MeetupAPI_.prototype.groups = function(fields) {
  return this.call("/self/groups", { "only": fields });
}

MeetupAPI_.prototype.events = function(fields, groupIds, time) {
  return this.call("/2/events", { 
    "fields": "event_hosts", 
    "status": "upcoming,past",
    "only": fields, 
    "group_id": groupIds, 
    "time": time });
}

/* END CODE */

;(
function copy(src, target, obj) {
    obj[target] = obj[target] || {};
    if (src && typeof src === 'object') {
        for (var k in src) {
            if (src.hasOwnProperty(k)) {
                obj[target][k] = src[k];
            }
        }
    } else {
        obj[target] = src;
    }
}  
  ).call(null, module.exports, expose, host);
}).call(this, this, "MeetupAPI");
