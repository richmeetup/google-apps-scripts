# google-apps-scripts

Google Apps Scripts for use with Google Docs.

### Setup

* Go to the [Google Apps Script dashboard](http://script.google.com/) and create a New Project.

* Copy the files in `/insert-upcoming-meetups` to your project.

* This project requires the [OAuth2 Google Apps Script library](https://github.com/googlesamples/apps-script-oauth2). To add it:
  * Click on the menu item "Resources > Libraries..."
  * In the "Find a Library" text box, enter the project key `MswhXl8fVhTFUH_Q3UOJbXvxhMjh3Sh48` and click the "Select" button
  * You can pick the latest Version, but project has been built using Version 19

* Associate the project with a Meetup OAuth Consumer. You can add a new new OAuth Consumer [here](https://secure.meetup.com/meetup_api/oauth_consumers/create).
  * Consumer name: `(whatever you wish)`
  * Application website: `(whatever you wish)`
  * Redirect URI: `https://script.google.com/macros/d/PROJECT_KEY/usercallback`
    * The `PROJECT_KEY` can be obtained in two ways:
      * "File > Project properties > Info > Project key" 
        * ***NOTE: This is incorrect because of [an Apps Script issue](https://code.google.com/p/google-apps-script-issues/issues/detail?id=6098)!***
      * "Run > debugProjectKey" then "View > Logs"
  * On [Your OAuth Consumers](https://secure.meetup.com/meetup_api/oauth_consumers/), copy over the "Key" and "Secret" to `CLIENT_ID` and `CLIENT_SECRET`
  
* Add this add-on as a Custom Menu item in "Add-ons"
  * Click on the menu item "Publish > Test as add-on..."
  * Under "Configure New Test":
    * Select Version: `Test with latest code`
    * Installation Config: `Installed for current user`
    * Click on "Select Doc" and select your test document
    * Click "Save"

* That's it! You're ready to run this Google Apps Script!
     
### Testing

* Add this script as an add-on to a the document you specified above
  * Click on the menu item "Publish > Test as add-on..."
  * Under "Execute Saved Test", select your Test and click on "Test". This should open up your document.
* In your document, click on the menu item "Add-ons > (Your project) > Configure Filters"
  * ***Note: The first time you run this, you will be requested to authorize this Apps Script to make API calls on behalf of a Meetup user. A pop-up should display with an authorization link to complete the authorization process.***
     * If you're in a Apps domain (ie. meetup.com), you may hit a page that says:
     <pre>The state token is invalid or has expired. Please try again.</pre> 
     To resolve this issue, copy the URL in the browser, replace the `+` in the `state` query parameter with `-`'s. This appears to be a redirect issue from Meetup's OAuth2 implementation. 
     * If you see `Success!` you can close this window. The access token will be stored as a `UserProperties` property in [the user scope](https://developers.google.com/apps-script/guides/properties).
  * Here you can select which groups to pull Meetups from:
     * Time range: This can be a relative range as explained on [the /2/events doc](http://www.meetup.com/meetup_api/docs/2/events/):
     <pre>
     Return events scheduled within the given time range, defined by two times separated with a single comma. Each end of the range may be specified with relative dates, such as "1m" for one month from now, or by absolute time in milliseconds since the epoch. If an endpoint is omitted, the range is unbounded on that end. The default value is unbounded on both ends (though restricted to the search window described above). Note: to retrieve past events you must also update status value
     </pre> 
     * Groups: `(check off groups)`
     * Click on "Update"
* To insert Meetups based on the parameters you specified in "Configure Filters", click on the menu item "Add-ons > (Your project) > Insert Upcoming Meetups"


### Todos

* Make this an actual add-on in the Google Apps Script Marketplace
* Handle the `state` issue for performing an OAuth2 authorization to a script hosted on a Google Apps domain (ie. a/meetup.com) causing the `state` string to convert underscores to "_+" in the redirect back from Meetup to the script
