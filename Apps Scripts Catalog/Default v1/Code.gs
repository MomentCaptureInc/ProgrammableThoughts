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
// Replace with your own Todoist Test API Key
const todoistTestKey = ""; 
// Replace with your own Todoist Project ID
const todoistProjectID = ""; 
// Replace with deployed web app 'dev' url
// Using the 'dev' is okay as you only need the url to work for your own Google account
// The reason for using the 'dev' url rather than 'exec', is that the former url always points to HEAD
// This means you won't need to constantly redeploy when you change the code). 
// Hit the 'Deploy' button on the top right. Then select 'New Deployment', and under 'Select Type' choose web app, and then hit deploy (leave all config at defaults). 
// Now hit the 'Deploy' button again, and select 'Test deployments'. Copy that url (ending with /dev) into the publishedUrl variable.
const publishedUrl = ""; 

const speechUrl = "https://speech.googleapis.com/v1p1beta1/"; // Google Cloud Speech-to-Text API endpoint https://cloud.google.com/speech-to-text/docs/reference/rest/v1p1beta1/speech/recognize
const scriptProperties = PropertiesService.getScriptProperties(); // Script properties are scoped to this script 
// Get the Google Drive File IDs of various folders / documents the script needs
const processedFolderID = scriptProperties.getProperty("processedFolderID");
const docFolderID = scriptProperties.getProperty("docFolderID");
const thoughtFolderID = scriptProperties.getProperty("thoughtFolderID");
const masterSheetID = scriptProperties.getProperty("masterSheetID");

// This is the first function that that needs to be run and serves three main purposes: 
// 1. Approve the Oauth permissions request
// 2. Create the necessary files and folder structure for the other functions in the script
// 3. Create an Apps Script Trigger which runs the 'Rolling
// Before actually running, you'll be presented with an OAuth permissions request. This request covers all of the code in the script, not just the APIs used in the 'initialize' function
function initialize() {
  if (!processedFolderID || !docFolderID || !thoughtFolderID || !masterSheetID) {  // Only run if this function hasn't been yet as these IDs are set inside this function
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
    const thoughtFolder = DriveApp.getFolderById(foldersArrayIDs[0]); // Arbitrarily use the first folder found. We'll be looking to improve this.
    thoughtFolder.addFile(scriptFile); // Move this Apps Script file into the folder
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(scriptFile); // Folders in Google Drive act more like tags, so you need to remove the 'Root Folder' tag
    scriptProperties.setProperty("thoughtFolderID", thoughtFolder.getId()); // Save the parent folder ID in a Script Property
    scriptProperties.setProperty("processedFolderID", thoughtFolder.createFolder("Processed").getId()); // Create a 'Processed' folder and store the ID in a Script Property
    scriptProperties.setProperty("docFolderID", thoughtFolder.createFolder("Docs").getId()); // Create a 'Docs' folder and store the ID in a Script Property
    // Create a new Google Spreadsheet which will act as a database of all thoughts
    // Configure the formatting and add a header
    const masterSheet = SpreadsheetApp.create("Programmable Thoughts Data", 2, 7);
    const entireSheetRange = masterSheet.getRange("A1:G2");
    const headerRange = masterSheet.getRange("A1:G1");
    const transcribedRange = masterSheet.getRange("E1:E");
    masterSheet.setFrozenRows(1);
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
      "Favorite"
    ]]);
    const now = new Date();
    // Create a Script Property that keeps track of whether the 'rollingProcess' function is running
    // Also add a millisecond timestamp counted from the ECMAScript epoch (January 1, 1970, UTC)
    // This timestamp is used to rescue the 'rollingProcess' trigger if it ever has an exception that prevents it from setting processRunning = false (ie. manually aborting it in the Script Editor GUI)
    scriptProperties.setProperty("processRunning", "false" + ":" + now.getTime().toString());
    scriptProperties.setProperty("masterSheetID", masterSheet.getId()); // Store the master spreadsheet file ID in a Script Property
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
  try {
    const now = new Date();
    const processRunningString = scriptProperties.getProperty("processRunning");
    const processRunning = processRunningString == null ? "false" : processRunningString.split(':')[0];
    const processRunningTimestamp =processRunningString == null ? 0 : parseInt(processRunningString.split(':')[1]);
    const diffMilliseconds = now.getTime() - processRunningTimestamp;
    Logger.log("rollingProcess processRunning: " + processRunning + " diffMilliseconds: " + diffMilliseconds);
    // Catch if the Script Property was 'stuck' true by checking if it's been > 6 minutes (the max Apps Script execution time)
    if (processRunning != "true" || (processRunning == "true" && diffMilliseconds > 360000)) {
       process();
    } else {
      Logger.log("process already running. Skipping.");
    }
  } catch (error) {
    Logger.log(error.stack);
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
    const startTime = new Date();
    scriptProperties.setProperty("processRunning", "true" + ":" + startTime.getTime().toString()); // Set the 'processRunning' Script Property to guarantee only 1 process() is running at a time
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSheetID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, 0);
    // Get a single Thought
    // This currently functions as LIFO which is maybe not ideal in all situations.
    // For cases where there are unsynced thoughts being uploaded + new thoughts, preference should probably go to do the newest ones first, so LIFO makes sense. But it is debatable.
    const thought = getAllThoughts()[0];
    if (thought) { // Only continue if there's a Thought ready to be processed
      const filename = thought.getName();
      const thoughtDateCreated = thought.getDateCreated();
      const thoughtDateCreatedDateObject = new Date(thoughtDateCreated);
      const sampleRate = filename.split('*').length > 1 ? parseInt(filename.split('*')[1]) : 44100;
      Logger.log("Processing thought: " + filename + " dateCreated: " + thoughtDateCreated + " bytes: " + thought.getSize() + " sampleRate: " + sampleRate);
      const canceled = isCanceled(filename);
      const dupe = DriveApp.getFolderById(processedFolderID).getFilesByName(filename).hasNext();
      if (canceled || (dupe && DriveApp.getFolderById(processedFolderID).getFilesByName(filename).next().getSize() == thought.getSize())) {
        Logger.log("Canceled: " + canceled + " Dupe: " + dupe);
        DriveApp.getFolderById(processedFolderID).addFile(thought);
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
        const endTime = new Date();
        scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString());
        return;
      }
      var text = thought.getSize() > 20000 && googleCloudSpeechToTextAPIKey != "" ? speechToText(thought, sampleRate) : ""; // Transcribe the audio if the file size > 20KB
      const processTagsResponse = processTags(filename, text, []); // Process tags appended to the filename
      text = processTagsResponse.text; // Pick up any modifications from the tag processing
      const emailSubjectModifiers = processTagsResponse.emailSubjectModifiers; // Tags are added to the email subject
      const origTags = processTagsResponse.origTags;
      const doc = DocumentApp.create(filename); // Every Thought has an associated Google Doc created
      if (text) doc.getBody().setText(text); // Add the transcribed text (if available) to the Google Doc
      // The following chunk of code is building pieces of the email
      const audioUrl = "https://drive.google.com/file/d/" + thought.getId() + "/view";
      const docUrl = "https://docs.google.com/document/d/" + doc.getId();
      const favoriteUrl = publishedUrl + "?id=" + thought.getId() + "&action=favorite";
      const trashUrl = publishedUrl + "?id=" + thought.getId() + "&action=trash";
      const taskUrl = publishedUrl + "?id=" + thought.getId() + "&action=task";
      const audioLink = "<a href='" + audioUrl + "'>audio</a>";
      const docLink = "<a href='" + docUrl + "'>doc</a>";
      const favoriteLink = "<a href='" + favoriteUrl + "'>favorite</a>";
      const trashLink = "<a href='" + trashUrl + "'>trash</a>";
      const taskLink = "<a href='" + taskUrl + "'>task</a>";
      const displayText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + audioUrl + " / " + docUrl + (publishedUrl ? " / " + favoriteUrl + " / " + trashUrl : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskUrl : "");
      const displayHtmlText = text + (origTags && origTags.length > 0 ? " [" + origTags.join(', ') +"]" : "") + " — " + audioLink + " / " + docLink + (publishedUrl ? " / " + favoriteLink + " / " + trashLink : "") + (todoistTestKey && todoistProjectID && publishedUrl ? " / " + taskLink : "");
      const data = [
        thought.getId(),
        filename,
        thoughtDateCreated,
        "https://drive.google.com/file/d/" + thought.getId() + "/view",
        text,
        "https://docs.google.com/document/d/" + doc.getId() 
      ];
      insertRow(thoughtMasterSheet, data, 2) // The above data is appended to the top of the Master Spreadsheet
      DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(doc.getId())); // Remove the 'Root Folder' tag
      DriveApp.getFolderById(docFolderID).addFile(DriveApp.getFileById(doc.getId())); // Add the Google Doc to the 'Docs' folder
      DriveApp.getFolderById(processedFolderID).addFile(thought); // Move the file into the processed folder 
      DriveApp.getFolderById(thoughtFolderID).removeFile(thought); // Remove the file from the parent folder 
      const thoughtSpreadsheetUrl = "https://docs.google.com/spreadsheets/d/" + thoughtSpreadsheet.getId();
      const thoughtSpreadsheetLink = "<a href='" + thoughtSpreadsheetUrl + "'>All Thoughts</a>";
      const tailMessage = `
            

      ${thoughtSpreadsheetUrl}`;
      const tailHtmlmessage = "<br><br><br><br><br>" + thoughtSpreadsheetLink;
      body = displayText + tailMessage;
      htmlBody = displayHtmlText + tailHtmlmessage;
      const subject = (emailSubjectModifiers && emailSubjectModifiers.length > 0 ? emailSubjectModifiers.join(' / ') + " - " : "") + "Thought " + paddedMonth(thoughtDateCreatedDateObject) + '/' + paddedDate(thoughtDateCreatedDateObject) + '/' + thoughtDateCreatedDateObject.getFullYear() + ' ' + thoughtDateCreatedDateObject.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: true, hour: 'numeric', minute: '2-digit'});
      // Send the Google Account an email containing the transcribed text and attached audio file
      GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body, {
        htmlBody: htmlBody,
        attachments: [thought.getBlob().setName(filename)]
      });
      Logger.log("Processing complete");
    } else {
      Logger.log("No thoughts to process");
    }
    const endTime = new Date();
    scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString()); // Reset the 'processRunning' flag and add the current timestamp
  } catch (error) {
    const endTime = new Date();
    scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString()); // If there are any exceptions, we still reset the 'processRunning' flag and add the current timestamp
    Logger.log(error.stack);
  }
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


// Iterate through the uploaded tags (on both files with recordings and ones without - ie. 'Tag Commands')
// Each supported tag may trigger unique behavior and has its own case/switch code block
// All unmatched tags are returned in a new array and also added to the email subject line 
function processTags(filename, text, newTags) {
  Logger.log("processTags filename: " + filename + " text: " + text + " newTags: " + newTags.join(', '));
  const response = {};
  const emailSubjectModifiers = [];
  const tags = splitTagsFromFilename(filename);
  if (newTags && newTags.length > 0) for (var i = 0; i < newTags.length; i++) tags.push(newTags[i]); // If any new tags are passed from doGet() actions, include those tags as they might not have been on the original filename
  response.todoistPriority = 1; // Set default priority to the lowest
  response.origTags = [...tags]; // Return a shallow copy of the original tags
  Logger.log("Original tags: " + response.origTags.join(', '));
  const supportedTags = ["p1","p2","p3","task"]; // 'task' needs to be last in this array to receive updated priority metadata from the p1,p2,p3 tag processing based the structure of the for loops below
  for (var i = 0; i < supportedTags.length; i++) {
    tags.find(element => { // Array.find allows us to use a function to compare elements
      if (element && element.toLowerCase() === supportedTags[i].toLowerCase()) {  // toLowerCase() ensures we don't miss a tag due to case differences
        tags.splice(element.index, 1); // Remove the found supported tag from the tag list based on the element's index. The '1' in the splice() function means we're removing just 1 item. This doesn't handle if the tag was duplicated in this list.
        switch(element.toLowerCase()) { // Decide what to do for each supported tag
          case "task":
            if (!text) break; // Skip adding a task if the transcription is empty
            const result = JSON.parse(addTask(text, response.todoistPriority)); // Call the ToDoist API and store the result
            if (result && result.id && result.id.toString().length > 0) { // If the result.id is populated, assume the task was added successfully
              emailSubjectModifiers.push("Task Added"); // Add email subject modifiers based on Todoist response
            } else {
              emailSubjectModifiers.push("Task Failed");
            }
            break;
          case "p1":
            emailSubjectModifiers.push("High Priority"); // Add reworded email subject modifiers
            response.todoistPriority = 4;  // https://developer.todoist.com/rest/v1/#create-a-new-task
            break;
          case "p2":
            emailSubjectModifiers.push("Medium Priority");
            response.todoistPriority = 3;
            break;
          case "p3":
            emailSubjectModifiers.push("Low Priority");
            response.todoistPriority = 2;
            break;
        }
      }
    });
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

// Post a transcribed Thought as a Todoist task
function addTask(task, priority) {
  if (!todoistTestKey || !todoistProjectID || !publishedUrl) return;
  task = task.split('(')[0]; // Remove confidence text
  if (!task) return;
  Logger.log("Adding task: " + task);
  const url = "https://api.todoist.com/rest/v1/tasks";
  var data = {
    'content': task,
    'priority': priority,
    'project_id': todoistProjectID,
    'X-Request-Id': Utilities.getUuid()
  };
  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(data),
    'headers': {
      'Authorization': 'Bearer ' + todoistTestKey
    }
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
        "model": "default"
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
  if (!processedFolderID || !docFolderID || !thoughtFolderID || !masterSheetID) return;
  return spreadsheet.getSheets().filter(
    function(s) {return s.getSheetId() === id;}
  )[0];
}

// This special function allows your script to respond to public GET requests when you deploy your script as a Web App
// See here for more info - https://developers.google.com/apps-script/guides/web
// In the email that gets sent containing the transcription and audio files are also several special links.
// This is where those link behaviors are defined
function doGet(e) {
  Logger.log(e);
  const action = e.parameter.action ? decodeURI(e.parameter.action).toString() : "";
  const id = e.parameter.id ? decodeURI(e.parameter.id).toString() : "";
  if (action && id) {
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSheetID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, 0);
    const thoughtData = thoughtMasterSheet.getDataRange().getValues();
    var message;
    switch(action) {
    case "favorite": // Mark the Thought in the Master Spreadsheet as a 'Favorite'
      message = "favorited";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.getRange("G" + (i + 1)).setValue("TRUE");
          break;
        }
      }
      break;
    case "trash": // Delete the Thought's entry in the Master Spreadsheet
      message = "trashed";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.deleteRow(i + 1);
          break;
        }
      }
      break;
    case "task": // Allow adding a task after processing (in case the user didn't use the 'task' tag)
      message = "task added";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          processTags(thoughtData[i][1], thoughtData[i][4], ["task"]); // Running through processTags() enables adding priority to the task if it was already added as a tag
          break;
        }
      }
      break;
    }
    const response = HtmlService.createHtmlOutput(); // Return a barebones html page containing the message set above
    response.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    response.append("<h2>" + message + "</h2>")
    return response;
  }
}