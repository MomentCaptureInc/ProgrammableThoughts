////////////////////////////////////////////////////////////////////////
// WELCOME TO THE V1 DEFAULT PROGRAMMABLE THOUGHTS GOOGLE APPS SCRIPT //
///////////////////////////////////////////////////////////////////////

// If this is your first time here, you need to run the 'initialize' function.
// Hit the 'run' button in the top menu and go through the authorization flow.
// Note that these somewhat scary looking permissions are only being granted to your own personal account (and no one else).
// After that, you're free to tinker away. But it might be a good idea to just get a feel for the operational flow before digging into code modifications.

/////////////////////////
// OPTIONAL PARAMETERS //
/////////////////////////

// Replace with your own Google Cloud API Key
// Follow the instructions here - https://github.com/MomentCaptureInc/ProgrammableThoughts#step-5-optional-enable-audio-transcription
const googleCloudSpeechToTextAPIKey = "";
// The 'pushKey' allows you to send push notifications to the Programmable Thoughts app.
// It can be copied from the About page in the app. Click the hamburger menu on the top left and you'll see "Copy Push Key" on the bottom right.
const pushKey = "";
// Replace with your own Todoist Test API Key
const todoistTestKey = ""; 
// Replace with your own Todoist Project ID
const todoistProjectID = ""; 
// Create a new Notion Internal Integration Token and paste it here
const notionInternalIntegrationToken = ""; 
// Replace with your own Notion Page ID and make sure to share this page with your API Integration via the Share Button in Notion on this new page
const notionPageID = "";
// Replace with your Airtable Base ID
const airtableBaseID = "";
// Replace with your Airtable API Key
const airtableKey = "";
// Replace with your Airtable endpoint
const airtableTaskEndpoint = "";
// 1 = Todoist, 2 = Notion, 3 = Airtable
const taskIntegrationProvider = 1;
// Replace with deployed web app 'dev' url
// Using the 'dev' url is okay as you only need the url to work for your own Google account
// The reason for using the 'dev' url rather than 'exec', is that the former url always points to HEAD
// This means you won't need to constantly redeploy when you change the code. 
// Hit the 'Deploy' button on the top right. Then select 'New Deployment', and under 'Select Type' choose web app, and then hit deploy (leave all config at defaults). 
// Now hit the 'Deploy' button again, and select 'Test deployments'. Copy that url (ending with /dev) into the publishedUrl variable.
const publishedUrl = ""; // Unfortunatley can't reliably use ScriptApp.getService().getUrl() due to https://issuetracker.google.com/issues/170799249?pli=1

const speechUrl = "https://speech.googleapis.com/v1p1beta1/"; // Google Cloud Speech-to-Text API endpoint https://cloud.google.com/speech-to-text/docs/reference/rest/v1p1beta1/speech/recognize
const scriptProperties = PropertiesService.getScriptProperties(); // Script properties are scoped to this script 
// Get the Google Drive File IDs of various folders / documents the script needs
const processedFolderID = scriptProperties.getProperty("processedFolderID");
// const docFolderID = scriptProperties.getProperty("docFolderID");
// const tagFolderID = scriptProperties.getProperty("tagFolderID");
const thoughtFolderID = scriptProperties.getProperty("thoughtFolderID");
const masterSpreadsheetFileID = scriptProperties.getProperty("masterSpreadsheetFileID");
const masterSpreadsheetThoughtSheetID = scriptProperties.getProperty("masterSpreadsheetThoughtSheetID");
const masterSpreadsheetTagSheetID = scriptProperties.getProperty("masterSpreadsheetTagSheetID");
const indexHtmlFilename = "index";

// This is the first function that that needs to be run and serves three main purposes: 
// 1. Approve the Oauth permissions request
// 2. Create the necessary files and folder structure for the other functions in the script
// 3. Create an Apps Script Trigger which runs the rollingProcess() function every minute
// Before actually running, you'll be presented with an OAuth permissions request. This request covers all of the code in the script, not just the APIs used in the 'initialize' function
function initialize() {
  // if (!processedFolderID || !docFolderID || !tagFolderID || !thoughtFolderID || !masterSpreadsheetFileID) {  // Only run if this function hasn't been yet as these IDs are set inside this function
  if (!processedFolderID || !thoughtFolderID || !masterSpreadsheetFileID) {  // Only run if this function hasn't been yet as these IDs are set inside this function
    Logger.log("Initializing");
    const scriptFile = DriveApp.getFileById(ScriptApp.getScriptId()); // Get a file reference to this script
    scriptFile.setName("Programmable Thoughts Script"); // Rename it from the default 'Untitled'
    const foldersArrayIDs = [];
    // The Programmable Thoughts app creates a folder with the name 'Programmable Thoughts'
    // Because we don't know the ID of this folder, we find all matching folders by name
    const folders = DriveApp.getFoldersByName("Programmable Thoughts");
    while (folders.hasNext()) foldersArrayIDs.push(folders.next().getId());
    if (!foldersArrayIDs || (foldersArrayIDs && foldersArrayIDs.length == 0)) {
      Logger.log("Programmable Thoughts folder not found. Did you go through the app's setup process?");
      return;
    }
    Logger.log("Folders found: " + foldersArrayIDs.length);
    const thoughtFolder = DriveApp.getFolderById(foldersArrayIDs[0]); // Arbitrarily use the first folder found (most recently created). We'll be looking to improve this.
    thoughtFolder.addFile(scriptFile); // Move this Apps Script file into the folder
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(scriptFile); // Folders in Google Drive act more like tags, so you need to remove the 'Root Folder' tag
    scriptProperties.setProperty("thoughtFolderID", thoughtFolder.getId()); // Save the parent folder ID in a Script Property
    scriptProperties.setProperty("processedFolderID", thoughtFolder.createFolder("Processed").getId()); // Create a 'Processed' folder and store the ID in a Script Property
    // scriptProperties.setProperty("docFolderID", thoughtFolder.createFolder("Docs").getId()); // Create a 'Docs' folder and store the ID in a Script Property
    // scriptProperties.setProperty("tagFolderID", thoughtFolder.createFolder("Tags").getId()); // Create a 'Tags' folder and store the ID in a Script Property
    // Create a new Google Spreadsheet which will act as a database of all Thoughts
    // Configure the formatting and add a header
    const masterSheet = SpreadsheetApp.create("Programmable Thoughts Data", 2, 11);
    const entireSheetRange = masterSheet.getRange("A1:K2");
    const headerRange = masterSheet.getRange("A1:K1");
    const transcribedRange = masterSheet.getRange("E1:E");
    masterSheet.setFrozenRows(1);
    masterSheet.getActiveSheet().setName("Thoughts");
    scriptProperties.setProperty("masterSpreadsheetThoughtSheetID", masterSheet.getActiveSheet().getSheetId());
    entireSheetRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    entireSheetRange.setHorizontalAlignment("left");
    transcribedRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    transcribedRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setHorizontalAlignment("center");
    headerRange.setFontSize("14");
    headerRange.setFontWeight("bold");
    headerRange.setValues([[
      "ID",
      "Name",
      "Created Date",
      "Audio",
      "Text",
      "Doc",
      "Flagged",
      "Tags",
      "Unread",
      "Notes",
      "Copied"
    ]]);
    const masterTagSheet = masterSheet.insertSheet("Tags");
    masterTagSheet.deleteColumns(4, masterTagSheet.getMaxColumns() - 3);
    masterTagSheet.deleteRows(4, masterTagSheet.getMaxRows() - 3);
    const entireTagSheetRange = masterTagSheet.getRange("A1:C2");
    entireTagSheetRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    entireTagSheetRange.setHorizontalAlignment("left");
    masterTagSheet.setFrozenRows(1);
    scriptProperties.setProperty("masterSpreadsheetTagSheetID", masterTagSheet.getSheetId());
    const tagsHeaderRange = masterTagSheet.getRange("A1:C1");
    tagsHeaderRange.setVerticalAlignment("middle");
    tagsHeaderRange.setHorizontalAlignment("center");
    tagsHeaderRange.setFontSize("14");
    tagsHeaderRange.setFontWeight("bold");
    tagsHeaderRange.setValues([[
      "Tag",
      "ID",
      "Doc"
    ]]);
    const now = new Date();
    // Create a Script Property that keeps track of whether the 'rollingProcess' function is running
    // Also add a millisecond timestamp counted from the ECMAScript epoch (January 1, 1970, UTC)
    // This timestamp is used to rescue the 'rollingProcess' trigger if it ever has an exception that prevents it from setting processRunning = false (ie. manually aborting it in the Script Editor GUI)
    scriptProperties.setProperty("processRunning", "false" + ":" + now.getTime().toString());
    scriptProperties.setProperty("masterSpreadsheetFileID", masterSheet.getId()); // Store the master spreadsheet file ID in a Script Property
    thoughtFolder.addFile(DriveApp.getFileById(masterSheet.getId())); // Add the master spreadsheet to the 'Programmable Thoughts' folder
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(masterSheet.getId())); // Remove the 'Root Folder' tag
    ScriptApp.newTrigger('rollingProcess') // Create a new Apps Script Trigger that runs the 'rollingProcess' function every minute
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log("Initialized");
  } else {
    Logger.log("Already Initialized");
  }
}

// This function is run every minute as defined by the trigger created in initialize()
// It's main purpose is to prevent process() from being run concurrently
function rollingProcess() {
  const now = new Date();
  const processRunningString = scriptProperties.getProperty("processRunning");
  const processRunning = processRunningString == null ? "false" : processRunningString.split(':')[0];
  const processRunningTimestamp =processRunningString == null ? 0 : parseInt(processRunningString.split(':')[1]);
  const diffMilliseconds = now.getTime() - processRunningTimestamp;
  Logger.log("rollingProcess processRunning: " + processRunning + " diffMilliseconds: " + diffMilliseconds);
  // Catch if the Script Property was 'stuck' == true by checking if it's been > 6 minutes (the max Apps Script execution time)
  if (processRunning != "true" || (processRunning == "true" && diffMilliseconds > 360000)) {
      process();
  } else {
    Logger.log("process already running. Skipping.");
  }
}

// This is the script's primary function
// It's executed by rollingProcess() every minute (only if it's not currently running) and performs the following:
// 1. Finds any new uploaded Thoughts
// 2. Transcribes the audio if the 'googleCloudSpeechToTextAPIKey' is set
// 3. Parses tags attached and performs tag specific functionality if defined
// 4. Adds a record to the Master Spreadsheet
// 5. Sends an email to you containing the transcription (if available) and attaches the audio recording
function process() {
  try {
    setProcessRunningProperty("true"); // Set the 'processRunning' Script Property to guarantee only 1 process() is running at a time
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetThoughtSheetID);
    // Get a single Thought
    // This currently functions as LIFO which is maybe not ideal in all situations.
    // For cases where there are unsynced Thoughts being uploaded + new Thoughts, preference should probably go to do the newest ones first, so LIFO makes sense. But it is debatable.
    const allThoughts = getAllThoughts();
    const thought = allThoughts[0];
    if (thought) { // Only continue if there's a Thought ready to be processed
      const filename = thought.getName();
      const thoughtDateCreated = thought.getDateCreated();
      const thoughtDateCreatedDateObject = new Date(thoughtDateCreated);
      const sampleRate = filename.split('(').length > 1 && filename.split(')').length > 1 ? parseInt(filename.split('(')[1].split(')')[0]) : 44100; // Parse sample rate from filename
      const canceled = isCanceled(filename);
      const dupe = DriveApp.getFolderById(processedFolderID).getFilesByName(filename).hasNext();
      if (canceled || (dupe && DriveApp.getFolderById(processedFolderID).getFilesByName(filename).next().getSize() == thought.getSize())) { // Catch dupes which may be sent by the app in case of an error
        Logger.log("Canceled: " + canceled + " Dupe: " + dupe);
        DriveApp.getFolderById(processedFolderID).addFile(thought);
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
      } else if (filename.split('#')[0].includes("command")) { // Process 'Tag Commands' separately from regular Thoughts
        Logger.log("Processing Tag Commands");
        const processTagCommandsResponse = processTagCommands(filename); // Process 'Tag Commands' appended to the filename
        DriveApp.getFolderById(processedFolderID).addFile(thought);
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
      } else {
        Logger.log("Processing Thought: " + filename + " dateCreated: " + thoughtDateCreated + " bytes: " + thought.getSize() + " sampleRate: " + sampleRate);
        // const doc = DocumentApp.create(filename); // Every Thought has an associated Google Doc created
        let indexHtmlTemplate;
        try {
          indexHtmlTemplate = HtmlService.createTemplateFromFile(indexHtmlFilename); // Create template from the indexHtmlFilename so we can conditionally chose to include 'edit' functionality
        } catch (error) {
          Logger.log(error.stack);
          Logger.log("Create the index.html file if you'd like to use the edit functionality from the email notifications")
        } 
        // The following chunk of code is building pieces of the email
        const editURL = publishedUrl + "?action=edit";
        const audioUrl = "https://drive.google.com/file/d/" + thought.getId() + "/view";
        // const docUrl = "https://docs.google.com/document/d/" + doc.getId();
        const flagUrl = publishedUrl + "?id=" + thought.getId() + "&action=flag";
        const trashUrl = publishedUrl + "?id=" + thought.getId() + "&action=trash";
        const taskUrl = publishedUrl + "?id=" + thought.getId() + "&action=task";
        const editLink = "<a href='" + editURL + "'>edit</a>";
        const audioLink = "<a href='" + audioUrl + "'>audio</a>";
        // const docLink = "<a href='" + docUrl + "'>doc</a>";
        const flagLink = "<a href='" + flagUrl + "'>flag</a>";
        const trashLink = "<a href='" + trashUrl + "'>trash</a>";
        const taskLink = "<a href='" + taskUrl + "'>task</a>";
        var text = thought.getSize() > 5000 && googleCloudSpeechToTextAPIKey ? speechToText(thought, sampleRate) : ""; // Transcribe the audio if the file size > 5KB
        const processTagsResponse = processTags(filename, text, [], audioUrl); // Process tags appended to the filename
        text = processTagsResponse.text; // Pick up any modifications from the tag processing
        const emailSubjectModifiers = processTagsResponse.emailSubjectModifiers; // Tags are added to the email subject
        const origTags = processTagsResponse.origTags;
        if (text) {
          // const docBody = doc.getBody(); // Add the transcribed text (if available) to the Google Doc
          // const docText = docBody.insertParagraph(0, thoughtDateCreatedDateObject.toLocaleDateString('en-US').replace(/\s/g, " ") + " " + thoughtDateCreatedDateObject.toLocaleTimeString('en-US').replace(/\s/g, " ") + ": " + text + " - ");
          // const docAudioLink = docText.appendText("Audio").setLinkUrl(audioUrl);
          // docAudioLink.merge();
          if (origTags && origTags.length > 0) {
            const thoughtTagSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetTagSheetID);
            const thoughtTagValues = thoughtTagSheet.getDataRange().getValues();
            for (var i = 0; i < origTags.length; i++) { // Iterate through all tags and add them to the tag sheet if they are new
              var rowID = -1;
              // var tagDoc;
              for (var x = 1; x < thoughtTagValues.length; x++) {
                if (origTags[i] == thoughtTagValues[x][0]) {
                  rowID = x;
                  // try {
                  //   tagDoc = DocumentApp.openById(thoughtTagValues[x][1]);
                  // } catch (error) {
                  //   Logger.log(error.stack);
                  //   Logger.log("Removing row containting bad tag data. Document possibly deleted.")
                  //   Logger.log("rowID: " + rowID + " thoughtTagValues[x][0]: " + thoughtTagValues[x][0]);
                  //   thoughtTagSheet.deleteRow(rowID + 1);
                  //   tagDoc = false;
                  // }
                  break;
                }
              }
              // if (rowID == -1 || !tagDoc) { // Create a new doc as this is a new tag or the doc has been deleted
              if (rowID == -1) { // Create a new doc as this is a new tag or the doc has been deleted
                // tagDoc = DocumentApp.create(origTags[i]);
                // const tagDocUrl = "https://docs.google.com/document/d/" + tagDoc.getId();
                const tagData = [
                  origTags[i],
                  "", // tagDoc.getId(),
                  ""  // tagDocUrl
                ];
                insertRow(thoughtTagSheet, tagData, 2) // The above data is appended to the top of the Tag sheet
                // DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(tagDoc.getId())); // Remove the 'Root Folder' tag
                // DriveApp.getFolderById(tagFolderID).addFile(DriveApp.getFileById(tagDoc.getId())); // Add the Google Doc to the 'Tags' folder
              }
              // Add the transcribed text and audio link to the tag doc
              // const tagDocBody = tagDoc.getBody();
              // const tagText = tagDocBody.insertListItem(0, thoughtDateCreatedDateObject.toLocaleDateString('en-US').replace(/\s/g, " ") + " " + thoughtDateCreatedDateObject.toLocaleTimeString('en-US').replace(/\s/g, " ") + ": " + text + " - ").setGlyphType(DocumentApp.GlyphType.BULLET);              
              // const tagAudioLink = tagText.appendText("Audio").setLinkUrl(audioUrl);
              // tagAudioLink.merge();
              // const tagSeparator = tagText.appendText(" / ").setLinkUrl("");
              // tagSeparator.merge();
              // const tagDocLink = tagText.appendText("Doc").setLinkUrl(docUrl);
              // tagDocLink.merge();
            }
          }
        }
        // const displayText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + (indexHtmlTemplate && publishedUrl ? editURL + " / " : "") + audioUrl + " / " + docUrl + (publishedUrl ? " / " + flagUrl + " / " + trashUrl : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskUrl : "");
        // const displayHtmlText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + (indexHtmlTemplate && publishedUrl ? editLink + " / " : "") +  audioLink + " / " + docLink + (publishedUrl ? " / " + flagLink + " / " + trashLink : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskLink : "");
        const displayText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + audioUrl + (publishedUrl ? " / " + flagUrl + " / " + trashUrl : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskUrl : "");
        const displayHtmlText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + audioLink + (publishedUrl ? " / " + flagLink + " / " + trashLink : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskLink : "");
        const data = [
          thought.getId(),
          filename,
          thoughtDateCreated,
          "https://drive.google.com/file/d/" + thought.getId() + "/view",
          text,
          "", // "https://docs.google.com/document/d/" + doc.getId(),
          false,
          origTags.join(","),
          true,
          "",
          false
        ];
        insertRow(thoughtMasterSheet, data, 2) // The above data is appended to the top of the Master Spreadsheet
        // DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(doc.getId())); // Remove the 'Root Folder' tag
        // DriveApp.getFolderById(docFolderID).addFile(DriveApp.getFileById(doc.getId())); // Add the Google Doc to the 'Docs' folder
        DriveApp.getFolderById(processedFolderID).addFile(thought); // Move the file into the processed folder 
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought); // Remove the file from the parent folder 
        // const thoughtSpreadsheetUrl = "https://docs.google.com/spreadsheets/d/" + thoughtSpreadsheet.getId();
        // const thoughtSpreadsheetLink = "<a href='" + thoughtSpreadsheetUrl + "'>All Thoughts</a>";
        const thoughtAdminLink = "<a href='" + editURL + "'>All Thoughts</a>";
        const tailMessage = `
              

        ${thoughtAdminLink}`;
        const tailHtmlmessage = "<br><br><br><br><br>" + thoughtAdminLink;
        body = displayText + tailMessage;
        htmlBody = displayHtmlText + tailHtmlmessage;
        const subject = (emailSubjectModifiers && emailSubjectModifiers.length > 0 ? emailSubjectModifiers.join(' / ') + " - " : "") + "Thought " + paddedMonth(thoughtDateCreatedDateObject) + '/' + paddedDate(thoughtDateCreatedDateObject) + '/' + thoughtDateCreatedDateObject.getFullYear() + ' ' + thoughtDateCreatedDateObject.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: true, hour: 'numeric', minute: '2-digit'}).replace(/\s/g, " ");
        // Send the Google Account an email containing the transcribed text and attached audio file
        if ((emailSubjectModifiers.includes("Task Added") && pushKey == "") || !emailSubjectModifiers.includes("Task Added")) { // Send a push notification rather than email when tasks are added successfully
          GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body, {
            htmlBody: htmlBody,
            attachments: [thought.getBlob().setName(filename)]
          });
        } else {
          sendPush("Task Added", text);
        }
        Logger.log("Processing complete");
      }
    } else {
      Logger.log("No Thoughts to process");
    }
    setProcessRunningProperty("false"); // Reset the 'processRunning' flag and add the current timestamp
  } catch (error) {
    setProcessRunningProperty("false"); // If there are any exceptions, we still reset the 'processRunning' flag and add the current timestamp
    Logger.log(error.stack);
  }
}

// Helper function for setting the 'processRunning' property
function setProcessRunningProperty(running) {
  const now = new Date();
  scriptProperties.setProperty("processRunning", running.toString() + ":" + now.getTime().toString()); // Reset the 'processRunning' flag and add the current timestamp
}

// Takes a filename and outputs an array of tags
// For the example filename "recording20220611132759349#tags#p1$task$.mp3"
// We're taking the index 2 entry from the # split which would be p1$task$.mp3 and further splitting by '$' which leaves tags = ["p1", "task", ".mp3"]
function splitTagsFromFilename(filename) {
  const tags = filename.split('#')[2].split('$');
  tags.pop(); // Removes the last entry which is the file extension - ".mp3"
  return tags;
}

// Check for a special 'cancel' tag that skips the rest of the processing code
// While the need for a 'cancel' tag is mostly moot given the official apps support canceling directly in the client (long hold the stop button for 1 second)
// This code mostly serves as an example of how a tag could drive specific processing behavior, which is especially useful for empty audio 'Tag Commands' (long hold a tag to send just the tag)
// For example, a 'Tag Command' could be used to signal the script to:
// 1. Compile all Thoughts with a specific tag over the past week and email a summary
// 2. Set a "Snooze" flag that tells the script to avoid sending emails until the next day
// 3. Turn on your computer/lights/etc. through integration with services like SmartThings
// And much more!
function isCanceled(filename) {
  const tags = splitTagsFromFilename(filename);
  var canceled = false;
  tags.find(element => { // Array.find allows us to use a function to compare elements
    if (element && element.toLowerCase() === "cancel") {
      canceled = true;
      return;
    }
  });
  return canceled;
}

// Iterate through the uploaded tags on files with audio recordings
// Each supported tag may trigger unique behavior and has its own case/switch code block
// All unmatched tags are returned in a new array and also added to the email subject line 
function processTags(filename, text, newTags, audioUrl) {
  Logger.log("processTags filename: " + filename + " text: " + text + " newTags: " + newTags.join(', '));
  const response = {};
  var emailSubjectModifiers = [];
  const tags = splitTagsFromFilename(filename);
  if (newTags && newTags.length > 0) 
    for (var i = 0; i < newTags.length; i++) 
      tags.push(newTags[i]); // If any new tags are passed from doGet() actions, include those tags as they might not have been on the original filename
  response.priority = 1; // Set default priority to the lowest
  response.origTags = [...tags]; // Return a shallow copy of the original tags
  Logger.log("Original tags: " + response.origTags.join(', '));
  const supportedTags = ["p1","p2","p3","task"]; // 'task' needs to be last in this array to receive updated priority metadata from the p1,p2,p3 tag processing based the structure of the for loops below
  for (var i = 0; i < supportedTags.length; i++) {
    const index = tags.findIndex(element => { // findIndex allows us to use a function to compare elements with toLowerCase() to ensure we don't miss a tag due to case differences
      if(element.toLowerCase() === supportedTags[i].toLowerCase()) {
        switch(element.toLowerCase()) { // Decide what to do for each supported tag
          case "task":
            // Skip adding a task if the transcription is empty or if any of the required keys / IDs are null
            if (!text || !publishedUrl || (taskIntegrationProvider == 1 && (!todoistTestKey || !todoistProjectID)) 
            || (taskIntegrationProvider == 2 && (!notionInternalIntegrationToken || !notionPageID))
            || (taskIntegrationProvider == 3 && (!airtableKey || !airtableBaseID || !airtableTaskEndpoint)))  break;
            const result = JSON.parse(addTask(text, response.priority, audioUrl)); // Call the ToDoist API and store the result
            if (taskIntegrationProvider == 1 && result && result.id && result.id.toString().length > 0) { // If the result.id is populated, the Todoist task was added successfully
              emailSubjectModifiers.push("Task Added"); // Add email subject modifiers based on Todoist response
            } else if (taskIntegrationProvider == 2 && result && result.results && result.results.length > 0) { // If the results object length > 1, the Notion task was added successfully
              emailSubjectModifiers.push("Task Added"); // Add email subject modifiers based on Notion response
            } else if (taskIntegrationProvider == 3 && result && result.records && result.records.length > 0 && result.records[0].id && result.records[0].id.toString().length > 0) { // If the record ID is populated, the Airtable task was added successfully
              emailSubjectModifiers.push("Task Added"); // Add email subject modifiers based on Notion response
            } else {
              emailSubjectModifiers.push("Task Failed");
            }
            break;
          case "p1":
            if (response.priority < 4) { // Only set the highest priority tag
              response.priority = 4;
              emailSubjectModifiers.push("High Priority"); // Add reworded email subject modifiers
              emailSubjectModifiers = emailSubjectModifiers.filter(item => item !== "Medium Priority"); // Remove previously set lower priority email subject modifiers
              emailSubjectModifiers = emailSubjectModifiers.filter(item => item !== "Low Priority");
            } else if (response.priority == 1) {
              response.priority = 4;
              emailSubjectModifiers.push("High Priority"); // Add reworded email subject modifiers
            } 
            break;
          case "p2":
            if (response.priority < 3) { // Only set the highest priority tag
              response.priority = 3;
              emailSubjectModifiers.push("Medium Priority"); // Add reworded email subject modifiers
              emailSubjectModifiers = emailSubjectModifiers.filter(item => item !== "Low Priority"); // Remove previously set lower priority email subject modifiers
            } else if (response.priority == 1) {
              response.priority = 3;
              emailSubjectModifiers.push("Medium Priority"); // Add reworded email subject modifiers
            } 
            break;
          case "p3":
            if (response.priority == 1) {
              response.priority = 2;
              emailSubjectModifiers.push("Low Priority"); // Add reworded email subject modifiers
            }
            break;
        }
      }
      return element.toLowerCase() === supportedTags[i].toLowerCase(); // Necessary for the index to return the actual index
    });
    if (index !== -1) {
      tags.splice(index, 1); // Remove the found supported tag from the tag list based on the element's index. The '1' in the splice() function means we're removing just 1 item.
    }
  }
  Logger.log("Unmatched tags: " + tags.join(', ')); // Due to the splice() above, tags now only has unmatched entries
  for (var i = 0; i < tags.length; i++) {
    emailSubjectModifiers.push(tags[i]);
  }
  response.text = text;
  response.emailSubjectModifiers = emailSubjectModifiers;
  response.unmatchedTags = tags;
  return response; // Return an object containing the transcribed text (as it's been potentially modified), array of subject line modifiers, the array of remaining unmatched tags
}

// Iterate through the 'Tag Commands'
// Each supported tag command may trigger unique behavior and has its own case/switch code block
// All unmatched 'Tag Commands' are returned in a new array
function processTagCommands(filename) {
  const response = {};
  const tagCommands = splitTagsFromFilename(filename);
  response.origTagCommands = [...tagCommands]; // Return a shallow copy of the original 'Tag Commands'
  Logger.log("Original Tag Commands: " + response.origTagCommands.join(', '));
  const supportedTagCommands = ["TBD"];
  for (var i = 0; i < supportedTagCommands.length; i++) {
    const index = tagCommands.findIndex(element => { // findIndex allows us to use a function to compare elements with toLowerCase() to ensure we don't miss a tag due to case differences
      if(element.toLowerCase() === supportedTagCommands[i].toLowerCase()) {
        switch(element.toLowerCase()) { // Decide what to do for each supported tag
          case "TBD":
            // Placeholder
            break;
        }
      }
      return element.toLowerCase() === supportedTagCommands[i].toLowerCase(); // Necessary for the index to return the actual index
    });
    if (index !== -1) {
      tagCommands.splice(index, 1); // Remove the found supported tag command from the tag command list based on the element's index. The '1' in the splice() function means we're removing just 1 item.
    }
  }
  // Send an email report containing all Thoughts for the unmatched Tag Commands
  if (tagCommands && tagCommands.length > 0) {
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
    const thoughtTagSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetTagSheetID);
    const thoughtTagValues = thoughtTagSheet.getDataRange().getValues();
    for (var i = 0; i < tagCommands.length; i++) {
      // var tagDocID;
      // for (var x = 1; x < thoughtTagValues.length; x++) {
      //   if (tagCommands[i] == thoughtTagValues[x][0]) {
      //     tagDocID = thoughtTagValues[x][1];
      //     break;
      //   }
      // }
      // if (tagDocID) {
      //   const url = "https://docs.google.com/feeds/download/documents/export/Export?id="+tagDocID+"&exportFormat=pdf";
      //   const param = {
      //     method: "get",
      //     headers: {"Authorization": "Bearer " + ScriptApp.getOAuthToken()},
      //     muteHttpExceptions:true,
      //   };
      //   const response = UrlFetchApp.fetch(url, param);
      //   const blob = response.getBlob().setName("Tag Report - " + tagCommands[i] + ".pdf");
      //   GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Tag Report - " + tagCommands[i], "", {
      //     htmlBody: "",
      //     attachments: [blob]
      //   });
      // }
    }
  }
  Logger.log("Unmatched Tag Commands: " + tagCommands.join(', ')); // Due to the splice() above, tagCommands now only has unmatched entries
  response.unmatchedTagCommands = tagCommands;
  return response; // Return an object containing the unmatched 'Tag Commands' and the original set for reference
}

// Post a transcribed Thought as a Todoist, Notion, or Airtable task
function addTask(task, priority, audioUrl) {
  if (!publishedUrl || (taskIntegrationProvider == 1 && (!todoistTestKey || !todoistProjectID)) 
  || (taskIntegrationProvider == 2 && (!notionInternalIntegrationToken || !notionPageID))
  || (taskIntegrationProvider == 3 && (!airtableKey || !airtableBaseID || !airtableTaskEndpoint))) return;
  task = task.split('(')[0]; // Remove confidence text
  if (!task) return;
  Logger.log("Adding task: " + task);
  const url = taskIntegrationProvider == 1 ? "https://api.todoist.com/rest/v1/tasks" : taskIntegrationProvider == 2 ? "https://api.notion.com/v1/blocks/" + notionPageID + "/children" : "https://api.airtable.com/v0/" + airtableBaseID + "/" + airtableTaskEndpoint;
  var data = {};
  if (taskIntegrationProvider == 1) { // https://developer.todoist.com/rest/v1/#create-a-new-task
    data = {
      'content': task,
      'description': audioUrl,
      'priority': priority,
      'project_id': todoistProjectID,
      'X-Request-Id': Utilities.getUuid()
    };
  } else if (taskIntegrationProvider == 2) { // https://developers.notion.com/docs/working-with-page-content#appending-blocks-to-a-page
    data = {
      'children': [{
        "object": "block",
        "type": "to_do",
        "to_do": {
          "rich_text": [{
            "type": "text",
            "text": {
              "content": task,
              "link": {
                "url" : audioUrl
              }
            }
          }],
          "color": priority == 4 ? "red" : priority == 3 ? "yellow" : priority == 2 ? "green" : "default"
        }
      }]
    };
  } else if (taskIntegrationProvider == 3) { // https://airtable.com/api
    data = {
      "records": [
        {
          "fields": {
            "Name": task,
            "Status": "To do",
            "Priority": priority == 4 ? "High" : priority == 3 ? "Medium" : priority == 2 ? "Low" : "Low",
            "Audio": audioUrl
          }
        },
      ]
    };
  }
  var options = {
    'method' : (taskIntegrationProvider != 2 ? 'post' : 'patch'),
    'contentType': 'application/json',
    'payload' : JSON.stringify(data),
    'headers': {
      'Authorization': 'Bearer ' + (taskIntegrationProvider == 1 ? todoistTestKey : taskIntegrationProvider == 2 ? notionInternalIntegrationToken : airtableKey),
      'Notion-Version' : '2021-08-16'
    }
  };
  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response)
  return response;
}

function sendPush(title, message) {
  Logger.log("Sending push notification with title: " + title + " message: " + message);
  const url = "https://us-central1-programmable-thoughts.cloudfunctions.net/sendPushNotification";
  var data = {
      'title': title,
      'message': message,
      'pushkey': pushKey
    };
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(data)
  };
  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response)
  return response;
}

// Returns an array of all new files uploaded
function getAllThoughts() {
  const thoughts = [];
  const files = DriveApp.getFolderById(thoughtFolderID).getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if ([MimeType.GOOGLE_DOCS, MimeType.GOOGLE_SHEETS, MimeType.GOOGLE_APPS_SCRIPT].includes(file.getMimeType())) { // Only include actual uploaded audio files / 'Tag Command' files
      continue;
    }
    thoughts.push(file);
  }
  return thoughts;  
}

// Upload an audio file to the Google Cloud Speech-to-Text API
function speechToText(file, sampleRate) {
  var text;
  const data = {
    "config": { // See the configuration parameters here - https://cloud.google.com/speech-to-text/docs/reference/rest/v1p1beta1/RecognitionConfig
        "encoding":"MP3", // This and sampleRateHertz will soon be configurable in the native apps
        "sampleRateHertz": sampleRate,
        "languageCode": "en-US",
        "enableAutomaticPunctuation": true,
        "model": "video",
        "useEnhanced": true
    },
    "audio": {
        "content": Utilities.base64Encode(file.getBlob().getBytes()) // Base64 encoded data has a 60 second / 10MB limitation - https://cloud.google.com/speech-to-text/docs/base64-encoding
    }
  };
  const url = speechUrl + "speech:recognize?key=" + googleCloudSpeechToTextAPIKey;
  var options = {
    'method' : 'post',
    'muteHttpExceptions': false,
    'contentType': 'application/json',
    'payload' : JSON.stringify(data)
  };
  const response = UrlFetchApp.fetch(url, options);
  const obj = JSON.parse(response.getContentText());
  const results = obj.results;
  if (!results) return "[no text could be transcribed]"; 
  const confidences = [];
  for (var i = 0; i < results.length; i++) { // The API will often return multiple 'results'. These usually occur when there are pauses in the audio recording.
    for (var j = 0; j < results[i].alternatives.length; j++) {
      const transcript = obj.results[i].alternatives[j].transcript;
      const confidence = obj.results[i].alternatives[j].confidence;
      confidences.push(confidence);
      Logger.log("results[" + i + "].alternatives[" + j + "].transcript: " + transcript);
      Logger.log("results[" + i + "].alternatives[" + j + "].confidence: " + confidence);
      text = text ? text + ", " + transcript : transcript; // Reconstruct a single string containing all of the transcribed text
    }
    const resultEndTime = obj.results[i].resultEndTime;
    const languageCode = obj.results[i].languageCode;
    Logger.log("results[" + i + "].resultEndTime: " + resultEndTime);
    Logger.log("results[" + i + "].languageCode: " + languageCode);
  }
  const totalBilledTime = obj.totalBilledTime;
  Logger.log("totalBilledTime:" + totalBilledTime);
  const averageConfidence = confidences.reduce((a, b) => a + b) / confidences.length;
  text = text + " (" + (averageConfidence * 100).toFixed(2) + "% confidence)";
  return text;
}

// Inserts a row into a Google Spreadsheet 
function insertRow(sheet, rowData, optIndex) {
  // The lock here is a bit unnecessary as only one process() can run at a time
  // But it's always a good idea to use a lock when writing data to a central file like the Master Spreadsheet
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { 
    var index = optIndex || 1;
    sheet.insertRowBefore(index).getRange(index, 1, 1, rowData.length).setValues([rowData]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// Given a Date object, return the month with a padded zero (ie. January is '01')
function paddedMonth(date) {
  return ("0" + (date.getMonth() + 1)).slice(-2); // getMonth() uses a zero index, so January is 0
}

// Given a Date object, return the date with a padded zero (ie. December 7th is '07')
function paddedDate(date) {
  return ("0" + date.getDate()).slice(-2);
}

// Google Apps Script doesn't have a way to get a Google Spreadsheet's sheet by its ID (only by name) - https://issuetracker.google.com/issues/36759083
function getSheetById(spreadsheet,id) {
  // if (!processedFolderID || !docFolderID || !tagFolderID || !thoughtFolderID || !masterSpreadsheetFileID) return;
  if (!processedFolderID || !thoughtFolderID || !masterSpreadsheetFileID) return;
  return spreadsheet.getSheets().filter(
    function(s) {return s.getSheetId() == id;}
  )[0];
}

function getRecentDocs() {
  const filesArray = [];
  const files = DriveApp.searchFiles('mimeType = "application/vnd.google-apps.document" and "me" in owners');
  while (files.hasNext() && filesArray.length < 20) {
    const file = files.next();
    const data = {};
    data.title = file.getName();
    data.id = file.getId();
    filesArray.push(data);
  }
  return filesArray;
}

function copyToDoc(id, text, notes, audioUrl) {
  const doc = DocumentApp.openById(id);
  if (!doc) return;
  const docBody = doc.getBody();
  const docText = docBody.appendListItem(text + (notes ? " — " + notes : "") + " — ").setGlyphType(DocumentApp.GlyphType.BULLET);
  const docAudioLink = docText.appendText("Audio").setLinkUrl(audioUrl);
  docAudioLink.merge();
}

function saveThoughtsData(data) {
  // const lock = LockService.getScriptLock();
  // lock.waitLock(60000);
  Logger.log("saveThoughtsData:");
  Logger.log(data);
  const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
  const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetThoughtSheetID);
  const thoughtData = thoughtMasterSheet.getDataRange().getValues();
  const response = {};
  response.status = "SUCCESS"; // TEMP HACK
  for (var x = 0; x < data.length; x++) {
    var rowID = -1;
    for (var i = 0; i < thoughtData.length; i++) {
      if (data[x].id == thoughtData[i][0]) {
        rowID = i + 1;
        const range = thoughtMasterSheet.getRange('A' + rowID + ':K' + rowID);
        const values = range.getValues().flat();
        range.setValues([[
          values[0],
          values[1],
          values[2],
          values[3],
          data[x].text,
          values[5],
          data[x].flagged,
          data[x].tags,
          data[x].unread,
          data[x].notes,
          data[x].copied
        ]])
        break;
      }
    }
  }
  Logger.log(response);
  // lock.releaseLock();
  return response;
}

function getThoughtData(id) {
  const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
  const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetThoughtSheetID);
  const thoughtData = thoughtMasterSheet.getDataRange().getValues();
  const response = {};
  for (var i = 0; i < thoughtData.length; i++) {
    if (id == thoughtData[i][0]) {
      response.text = thoughtData[i][4];
      response.flagged = thoughtData[i][6];
      response.tags = thoughtData[i][7];
      return response;
    }
  }
}

// This special function allows your script to respond to public GET requests when you deploy your script as a Web App
// See here for more info - https://developers.google.com/apps-script/guides/web
// In the email that gets sent containing the transcription and audio files are also several special links.
// This is where those link behaviors are defined
function doGet(e) {
  Logger.log(e);
  const action = e.parameter.action ? decodeURI(e.parameter.action).toString() : "";
  const id = e.parameter.id ? decodeURI(e.parameter.id).toString() : "";
  if (action == "edit") {
    const template = HtmlService.createTemplateFromFile(indexHtmlFilename); 
    const html = template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    html.setTitle("Programmable Thoughts - Admin");
    html.addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return html;
  } else if (action && id) {
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetThoughtSheetID);
    const thoughtData = thoughtMasterSheet.getDataRange().getValues();
    var message;
    switch(action) {
    case "flag": // Mark the Thought in the Master Spreadsheet as 'Flagged'
      message = "flagged";
      for (var i = 0; i < thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.getRange("G" + (i + 1)).setValue("TRUE");
          const html = HtmlService.createHtmlOutput(); // Return a barebones html page containing the message set above
          html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
          html.append("<h2>" + message + "</h2>")
          return html;
        }
      }
      break;
    case "trash": // Delete the Thought's entry in the Master Spreadsheet
      message = "trashed";
      for (var i = 0; i < thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.deleteRow(i + 1);
          const html = HtmlService.createHtmlOutput(); // Return a barebones html page containing the message set above
          html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
          html.append("<h2>" + message + "</h2>")
          return html;
        }
      }
      break;
    case "task": // Allow adding a task after processing (in case the user didn't use the 'task' tag)
      message = "task added";
      for (var i = 0; i < thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          processTags(thoughtData[i][1], thoughtData[i][4], ["task"], thoughtData[i][3]); // Running through processTags() enables adding priority to the task if it was already added as a tag
          const html = HtmlService.createHtmlOutput(); // Return a barebones html page containing the message set above
          html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
          html.append("<h2>" + message + "</h2>")
          return html;
        }
      }
      break;      
    }
  }
}

/*
 * JSON Exporter Source - https://gist.github.com/jalcantarab/0eb43b13c97e4f784bd0be327f6ced52
*/
function getThoughtDataJSON() {
  const thoughtSpreadsheet = SpreadsheetApp.openById(masterSpreadsheetFileID);
  const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, masterSpreadsheetThoughtSheetID);
  return exportJSON(thoughtMasterSheet);
}

/* 
 * exportJSON(Spreadsheet) transforms the data in the given sheet to JSON.
 * @params ss - SpreadsheetApp>Spreaddheet Class.
 * @returns Object[] - Array of JSON objects.
*/ 
function exportJSON(sheet) {
  var rowsData = getRowsData(sheet);
  var result = JSON.stringify(rowsData);
  return result;
}

/* 
 * getRowsData(Sheet) iterates row by row in the sheer and returns an array of objects.
 * Each object contains all the data for a given row, indexed by its normalized column name.
 * @params sheet - SpreadsheetApp>Sheet Class, the sheet object that contains the data to be processed.
 * @returns Object[] - an Array of objects with the headers as keys.
*/ 
function getRowsData(sheet) {
  var headersRange = sheet.getRange(1, 1, sheet.getFrozenRows(), sheet.getMaxColumns());
  var headers = headersRange.getValues()[0];
  var dataRange = sheet.getRange(sheet.getFrozenRows()+1, 1, sheet.getMaxRows(), sheet.getMaxColumns());
  return getObjects(dataRange.getValues(), normalizeHeaders(headers));
}

/* 
 * getObjects(String[], String[]), For every row in the data, generates an object.  
 * Names of object fields are defined in keys.
 * @params data - JavaScript 2d array.
 * @params keys - Array of Strings that define the property names for the objects to create.
 * @returns Object[] - JSON, an Array of objects.
*/ 
function getObjects(data, keys) {
  var objects = [];
  for (var i = 0; i < data.length; ++i) {
    var object = {};
    var hasData = false;
    for (var j = 0; j < data[i].length; ++j) {
      var cellData = data[i][j];
      // if (isCellEmpty(cellData)) { // This breaks Tabulator reactive data support
      //   continue;
      // }
      object[keys[j]] = cellData;
      hasData = true;
    }
    if (hasData) {
      objects.push(object);
    }
  }
  return objects;
}

/* 
 * getColumnsData(Sheet Object, RangeElement[], int) iterates column by column in the input range and returns an array of objects.
 * Each object contains all the data for a given column, indexed by its normalized row name.
 * @params sheet - the sheet object that contains the data to be processed
 * @params range - the exact range of cells where the data is stored
 * @params (optional)rowHeadersColumnIndex - specifies the column number where the row names are stored.
 * @returns Object[] - an Array of objects.
*/ 
function getColumnsData(sheet, range, rowHeadersColumnIndex) {
  rowHeadersColumnIndex = rowHeadersColumnIndex || range.getColumnIndex() - 1;
  var headersTmp = sheet.getRange(range.getRow(), rowHeadersColumnIndex, range.getNumRows(), 1).getValues();
  var headers = normalizeHeaders(arrayTranspose(headersTmp)[0]);
  return getObjects(arrayTranspose(range.getValues()), headers);
}

/* 
 * normalizeHeaders(String[]) Returns an Array of normalized Strings.
 * @params headers - Array of raw headers
 * @returns String[] - Array of normalized headers.
*/ 
function normalizeHeaders(headers) {
  var keys = [];
  for (var i = 0; i < headers.length; ++i) {
    var key = normalizeHeader(headers[i]);
    if (key.length > 0) {
      keys.push(key);
    }
  }
  return keys;
}

/* 
 * normalizeHeaders(String[]) Normalizes a string by removing all alphanumeric characters 
 * Uses camelCase to separate words. The output will always start with a lower case letter.
 * This function is designed to produce JavaScript object property names.
 * @params headers - Array of raw headers
 * @returns String[] - Array of normalized headers.
 * Examples:
 *   "First Name" -> "firstName"
 *   "Market Cap (millions) -> "marketCapMillions
 *   "1 number at the beginning is ignored" -> "numberAtTheBeginningIsIgnored"
*/ 
function normalizeHeader(header) {
  var key = "";
  var upperCase = false;
  for (var i = 0; i < header.length; ++i) {
    var letter = header[i];
    if (letter == " " && key.length > 0) {
      upperCase = true;
      continue;
    }
    if (!isAlnum(letter)) {
      continue;
    }
    if (key.length == 0 && isDigit(letter)) {
      continue; // first character must be a letter
    }
    if (upperCase) {
      upperCase = false;
      key += letter.toUpperCase();
    } else {
      key += letter.toLowerCase();
    }
  }
  return key;
}

/* 
 * isCellEmpty(String) Returns true if the cell where cellData was read from is empty.
 * @params cellData - an SpreadsheetApp Cell Object. 
 * @returns boolean - false if the string is empty. 
*/ 
function isCellEmpty(cellData) {
  return typeof(cellData) == "string" && cellData == "";
}

/* 
 * isAlnum(char) Returns true if the character char is alphabetical, false otherwise.
 * @params char - a single character.
 * @returns boolean.
*/ 
function isAlnum(char) {
  return char >= 'A' && char <= 'Z' ||
    char >= 'a' && char <= 'z' ||
    isDigit(char);
}

/* 
 * isDigit(char) Returns true if the character char is a digit, false otherwise.
 * @params char - a single character.
 * @returns boolean.
*/ 
function isDigit(char) {
  return char >= '0' && char <= '9';
}

/* 
 * isDigit(String[]) returns the transposed table of given 2d Array.
 * @params data - JavaScript 2d array.
 * @returns String[] - transposed 2d array.
 * Example: 
 *     arrayTranspose([[1,2,3],[4,5,6]]) returns [[1,4],[2,5],[3,6]]
*/ 
function arrayTranspose(data) {
  if (data.length == 0 || data[0].length == 0) {
    return null;
  }
  var ret = [];
  for (var i = 0; i < data[0].length; ++i) {
    ret.push([]);
  }

  for (var i = 0; i < data.length; ++i) {
    for (var j = 0; j < data[i].length; ++j) {
      ret[j][i] = data[i][j];
    }
  }
  return ret;
}

function getBlobInBase64(fileId) {
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  return {
    file_name: file.getName(),
    mime: file.getMimeType(),
    b64: Utilities.base64Encode(blob.getBytes())
  }
}
