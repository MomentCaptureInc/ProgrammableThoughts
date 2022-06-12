//////////////////////////////////////////////////////////////////////////
// WELCOME TO THE V1 BAREBONES PROGRAMMABLE THOUGHTS GOOGLE APPS SCRIPT //
/////////////////////////////////////////////////////////////////////////

// This script is just a test with minimal permissions to show you how things work. But before running initialize, if you'd like to reduce the permissions even further, click the settings icon on the left, and enable the 'Show "appsscript.json" manifest file in editor' checkbox. Then replace the contents of that file (visible on the top left) with the contents below. Now click the 'Run' button and you should receive an email after going through the authorization flow. Note that you're only granting permissions to your own personal account (and no one else). Once you feel comfortable, you can upgrade to the 'Default' script which provides a full featured experience.


/*


{
  "timeZone": "America/Los_Angeles",
  "dependencies": {
  },
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": ["https://www.googleapis.com/auth/gmail.compose","https://www.googleapis.com/auth/userinfo.email"],
  "runtimeVersion": "V8"
}



*/


function initialize() {
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Hello World", "We're just getting started.");
}