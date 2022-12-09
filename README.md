# Programmable Thoughts
Welcome to the Programmable Thoughts GitHub repo. We're just getting started ourselves, but the information below should be enough to get you going. We hope to soon expand both the functionality of the currently offered Apps Scripts, as well as increase the number of scripts through outside contributions. Note that all contributions will be thoroughly tested and validated before being added to the `master` branch's [Apps Script Catalog](Apps%20Scripts%20Catalog). See the [Trust and Validation](README.md#trust-and-validation) section below for more info.

### How Everything Fits Together
There are two main pieces that make up "Programmable Thoughts". First, the [iOS](https://apps.apple.com/app/programmable-thoughts/id1627115569) / [Android](https://play.google.com/store/apps/details?id=com.momentcaptureinc.programmablethoughts) apps which are simply a voice recorder + tagger that uploads to Google Drive. And second, the backend Google Apps Script (owned, operated, editable by your Google Account—minimizing privacy / security concerns) which handles the transcription, tag logic, email sending, etc. Below is a simplified overview of the app and script flow based on the [Default v1](Apps%20Scripts%20Catalog/Default%20v1/) script:

1. You record a voice note (ie. a Thought) up to 60 seconds in length
    * Before / during recording, you can tag the Thought with one or more user-defined strings
3. The audio file (with the tags written into the filename) are uploaded to your Google Drive in a new folder called "Programmable Thoughts"
4. Every 60 seconds the script checks for new uploads to the "Programmable Thoughts" folder
5. Audio is transcribed via Google Cloud Speech-to-Text (if configured)
6. Tag Commands are parsed
    * Currently the only functionality built-in is to send an email report for the sent Tag Command
8. Regular Tags are parsed
    * Some tag names ("p1,p2,p3,task") have pre-defined logic
    * All others tags just get written into the email and spreadsheet
10. Row is inserted into the "Programmable Thoughts Data" spreadsheet which has a record and metadata for each Thought
11. Email is sent from/to your Gmail address that contains the audio file, transcription, tags, and special links that allow you to take specific actions (ie. add a task, favorite, trash)


## Getting Started
### Step 1. Download the App
After downloading either the [iOS](https://apps.apple.com/app/programmable-thoughts/id1627115569) or [Android](https://play.google.com/store/apps/details?id=com.momentcaptureinc.programmablethoughts) apps and authorizing Google Drive access to "See, edit, create, and delete only the specific Google Drive files you use with this app" provided by the [https://www.googleapis.com/auth/drive.file](https://developers.google.com/identity/protocols/oauth2/scopes#drive) OAuth scope, proceed to Step 2. Note that you can actually use any voice recording app that can sync to Google Drive, but the official apps are built from the ground up with this use-case in mind and will likely grow to support additional features of the Apps Scripts.

### Step 2. Create Apps Script Project
Make sure you're logged into the same Google account that you used when you authorized the app, and go to https://script.google.com/home/projects/create - and erase the placeholder code:
```
function myFunction() {
  
}
```
### Step 3. Choose a Programmable Thoughts Apps Script
Choose one of the following Apps Scripts in the [Apps Scripts Catalog](Apps%20Scripts%20Catalog). You'll most likely want to start with [Default v1](Apps%20Scripts%20Catalog/Default%20v1/), but if you are feeling a bit hesitant regarding Google OAuth permissions, try [Barebones v1](Apps%20Scripts%20Catalog/Barebones%20v1/Code.gs) to get a better idea of how this all fits together. Note that the latter script only sends a "Hello World" test email with a single scope permission.

|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| Transcription | Emailed Thoughts | Tagging | API Integrations | Google Doc per Thought | Push Notifications | Master Thought Spreadsheet |
|------------------------------------------|:-------------:|:----------------:|:-------:|:---------------------------------:|:----------------------:|:--------------------------:|:------------------:|
| **[Default v1](Apps%20Scripts%20Catalog/Default%20v1/)**                               |       ✓       |         ✓        |    ✓    |                 Todoist, Notion, Airtable                 |            ✓           |              ✓             |          ✓         |
| **[Barebones v1](Apps%20Scripts%20Catalog/Barebones%20v1/Code.gs)**                             |       -       |         -        |    -    |                 -                 |            -           |              -             |          -         |
| ...                                      |               |                  |         |                                   |                        |                            |                    |

### Step 4. Save, Authorize, and Run the Apps Script
Once you've chosen a script, click the 'Copy raw contents' icon 
<img width="29" alt="image" src="https://user-images.githubusercontent.com/7659306/172484479-d86e923c-122b-4400-a2e0-7376df1989d3.png"> for the 'Code.gs' file, and then paste the contents into your newly created empty Google Apps Script project. If there is another file beyond 'Code.gs' in the Script Catalog script's directory, copy its content like you did for 'Code.gs', and then back in the Google Apps Script project, click the + icon and select either 'HTML' or 'Script' depending on the source file's extension (ie. 'Script' for '.gs' or 'HTML' for '.html'), and then paste the contents of the file and name the file 'index'. Now go back to the 'Code.gs' in the Google Apps Script project file by clicking its name on the top left and save the project. Then hit 'Run' to execute the currently selected 'initialize' function. There will be a pop-up asking you to 'Review Permissions'. Click that, and select the same Google account you signed into this app with. At this point you'll encounter a rather unfriendly looking "Google hasn’t verified this app" message. This is because the script utilizes 'restricted' permissions (ie. sending email on your behalf, moving files, etc.) **But it's important to understand you're only granting permissions to you, and not to anyone else.** When you're ready, hit the 'Advanced' link, and then click on the 'Go to XYZ (unsafe)' link. On the next screen click 'Allow' and you'll be ready to go. Once you're authorized and the script's initialization finishes, head back to the app to test things out. 

### Step 5. [Optional] Enable Audio Transcription
The [Default v1](Apps%20Scripts%20Catalog/Default%20v1/) Apps Script is configured to use the Google Cloud Speech-to-Text API (though you're welcome to implement a different one). Click the links below and follow each step to get the necessary API key (the following assumes you don't already have a Google Cloud Project you can use - but you're welcome to do so).

1. https://console.cloud.google.com/projectcreate and create a new Google Cloud Project (name it however you please)
2. https://console.cloud.google.com/billing to add billing information (enabling certain APIs requires a billing account)
3. https://console.developers.google.com/start/api?id=speech.googleapis.com to enable the [Google Cloud Speech-to-Text API](https://cloud.google.com/speech-to-text/pricing) (which provides 60 transcribed minutes per month for free, and is as low as $0.004 per 15 seconds after)
4. https://console.cloud.google.com/apis/credentials and create an API key, and then click 'Edit API key' under the 'Action' menu and give the key a friendly name like 'Cloud Speech-to-Text API Key' and then also enable API restrictions to just 'Cloud Speech-to-Text API'
5. Finally, copy and paste that API Key into the `googleCloudSpeechToTextAPIKey` variable in your private copy of the [Default v1's Code.gs](Apps%20Scripts%20Catalog/Default%20v1/Code.gs) file

## How to Use Programmable Thoughts
There's no single answer to this, but the core concept relies on the ability to quickly offload thoughts so you can process them later. Your email inbox is where the 'processing' is done. This can create a bit of a challenge if you have 1000 unread emails and spam funneling in throughout the day. Below you'll find a growing list of tips on how to best use and tailor Programmable Thoughts for your own unique way of thinking.

**Email Filters**<br>
If you're not an ardent 'Inbox Zero' follower, you'll likely want to create an email filter that adds a 'Thought' label, and also consider automatically marking the emails as read. That will quiet things down a bit.

**Tags**<br>
There is built-in support for 'p1, p2, p3' for priority level, and 'task' for connecting to [Todoist](https://todoist.com/), [Notion](https://www.notion.so/), or [Airtable](https://airtable.com/). But you should try creating your own. You can even program your tags to act as buttons (long hold to send just the tag with no audio), enabling programmatic control of just about anything, anywhere. 

**Canceling Recordings**<br>
If you've already hit the record button (or are using auto record) and you want to cancel, just hold the square stop button down for 1 second. Note canceling means the recording will be discarded from your local device and not synced to Google Drive.

**Push Notifications**<br>
Both the [iOS](https://apps.apple.com/app/programmable-thoughts/id1627115569) or [Android](https://play.google.com/store/apps/details?id=com.momentcaptureinc.programmablethoughts) apps support custom push notifications when using the [Default v1](Apps%20Scripts%20Catalog/Default%20v1/) script. Just copy the "Push Key" from the app into the script, and you'll be able to send push notifications with `sendPush("Title", "Message")`. The default behavior for adding tasks uses a push notification to signal success rather than sending an email, but you can easily customize the behavior.

## Going Further
Programmable Thoughts was originally conceived as a quick-entry thought organizer that could be tweaked to personal needs. But being essentially a simple voice/touch interface to Google Apps Script, it could really be a lot of things:

  - Writing organizer
  - Home automation controller
  - Thought and mood journal
  - Task manager
  - Cognitive behavioral therapy tool
  - Integrated with [IFTTT](https://ifttt.com) or [Zapier](https://zapier.com)
  - etc.

## Trust and Validation
With the incredible flexibility and power of Google Apps Script, you need to be able to trust the code you're executing. That's why we've created an open source catalog of <b>Trusted Programmable Thoughts Apps Scripts</b>. Each script available here will have been transparently reviewed by multiple team members and automatically scanned for potential vulnerabilities. We will soon be building a list of minimum requirements to be eligible for inclusion in the catalog (ie. no delete actions, bulk email spamming, etc.) We want to see the functionality of Programmable Thoughts grow, but security and trust will always be our number one priority.

## Contributing
If you'd like to have your own Programmable Thoughts compatible Apps Script listed in the [Apps Script Catalog](Apps%20Scripts%20Catalog), or would like to extend an existing script, just submit a PR and we'll work with you on making that happen. And feel free to [post an issue](https://github.com/MomentCaptureInc/ProgrammableThoughts/issues/new) if you run into any issues or post a [discussion topic](https://github.com/MomentCaptureInc/ProgrammableThoughts/discussions/new) for discussing more general things.
