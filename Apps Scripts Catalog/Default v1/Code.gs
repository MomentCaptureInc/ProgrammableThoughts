////////////////////////////////////////////////////////////////////////
// WELCOME TO THE V1 DEFAULT PROGRAMMABLE THOUGHTS GOOGLE APPS SCRIPT //
///////////////////////////////////////////////////////////////////////

// If this is your first time here, you need to run the 'initialize' function. Hit the 'run' button in the top menu and go through the authorization flow. Note that these somewhat scary looking permissions are only being granted to your own personal account (and no one else).After that, you're free to tinker away. But it might be a good idea to just get a feel for the operational flow before digging into code modifications.

/////////////////////////
// OPTIONAL PARAMETERS //
/////////////////////////
const googleCloudSpeechToTextAPIKey = ""; // Replace with your own Google Cloud API Key with Cloud Speech-to-Text permissions. Go to https://console.cloud.google.com/projectcreate and create a new project and then to https://console.cloud.google.com/billing to add billing information (don't worry, speech-to-text is extremely inexpensive). After you have created a billing account, go to https://console.developers.google.com/start/api?id=speech.googleapis.com to enable the Cloud Speech-to-Text API. Once enabled, go to https://console.cloud.google.com/apis/credentials and create an API key. Edit this key and give it a friendly name like 'Cloud Speech-to-Text API Key', and then also enable API restrictions to just 'Cloud Speech-to-Text API'
const todoistTestKey = ""; // Replace with your own Todoist Test API Key
const todoistProjectID = ""; // Repalce with your own Todoist Project ID
const publishedUrl = ""; // Replace with deployed web app 'dev' url (as these links only need to work for your logged in Google account + the 'dev' url always points to HEAD which means you won't need to constatnly redeploy when you change the code). Hit the 'Deploy' button on the top right. Then select 'New Deployment', and under 'Select Type' choose web app, and then hit deploy (leave all config at defaults). Now hit the 'Deploy' button again, and select 'Test deployments'. Copy that url (ending with /dev) into the publishedUrl variable.

const speechUrl = "https://speech.googleapis.com/v1p1beta1/";
const scriptProperties = PropertiesService.getScriptProperties();
const processedFolderID = scriptProperties.getProperty("processedFolderID");
const docFolderID = scriptProperties.getProperty("docFolderID");
const thoughtFolderID = scriptProperties.getProperty("thoughtFolderID");
const masterSheetID = scriptProperties.getProperty("masterSheetID");

function initialize() {
  if (!processedFolderID || !docFolderID || !thoughtFolderID || !masterSheetID) {
    Logger.log("Initializing");
    const scriptFile = DriveApp.getFileById(ScriptApp.getScriptId());
    scriptFile.setName("Programmable Thoughts Script");
    const foldersArrayIDs = [];
    const folders = DriveApp.getFoldersByName("Programmable Thoughts");
    while (folders.hasNext()) foldersArrayIDs.push(folders.next().getId());
    if (!foldersArrayIDs || (foldersArrayIDs && foldersArrayIDs.length == 0)) {
      Logger.log("Programmable Thoughts folder not found. Did you go through the app's setup process?");
      return;
    }
    Logger.log("Folders found: " + foldersArrayIDs.length);
    const thoughtFolder = DriveApp.getFolderById(foldersArrayIDs[0]); // TODO - Find a better way to do this
    thoughtFolder.addFile(scriptFile);
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(scriptFile);
    scriptProperties.setProperty("thoughtFolderID", thoughtFolder.getId());
    scriptProperties.setProperty("processedFolderID", thoughtFolder.createFolder("Processed").getId());
    scriptProperties.setProperty("docFolderID", thoughtFolder.createFolder("Docs").getId());
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
    scriptProperties.setProperty("processRunning", "false" + ":" + now.getTime().toString());
    scriptProperties.setProperty("masterSheetID", masterSheet.getId());
    thoughtFolder.addFile(DriveApp.getFileById(masterSheet.getId()));
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(masterSheet.getId()));
    ScriptApp.newTrigger('rollingProcess')
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log("Initialized");
  } else {
    Logger.log("Already Initialized");
  }
}

function rollingProcess() {
  try {
    const now = new Date();
    const processRunningString = scriptProperties.getProperty("processRunning");
    const processRunning = processRunningString == null ? "false" : processRunningString.split(':')[0];
    const processRunningTimestamp =processRunningString == null ? 0 : parseInt(processRunningString.split(':')[1]);
    const diffMilliseconds = now.getTime() - processRunningTimestamp;
    Logger.log("rollingProcess processRunning: " + processRunning + " diffMilliseconds: " + diffMilliseconds);
    if (processRunning != "true" || (processRunning == "true" && diffMilliseconds > 360000)) {
       process();
    } else {
      Logger.log("process already running. Skipping.");
    }
  } catch (error) {
    Logger.log(error.stack);
  }
}

function process() {
  try {
    const startTime = new Date();
    scriptProperties.setProperty("processRunning", "true" + ":" + startTime.getTime().toString());
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSheetID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, 0);
    const thought = getAllThoughts()[0]; // This currently functions as LIFO which is maybe not idea in all situations. For cases where there are unsynced thoughts being uploaded + new thoughts, preference should probably go to do the newest ones first, so LIFO makes sense them... It's arguable.
    if (thought) {
      const filename = thought.getName();
      const thoughtDateCreated = thought.getDateCreated(); 
      const thoughtDateCreatedDateObject = new Date(thoughtDateCreated);
      Logger.log("Processing thought: " + filename + " dateCreated: " + thoughtDateCreated + " bytes: " + thought.getSize());
      if (IsCancelled(filename)) {
        Logger.log("Thought was cancelled");
        DriveApp.getFolderById(processedFolderID).addFile(thought);
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
        const endTime = new Date();
        scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString());
        return;
      }
      var text = thought.getSize() > 20000 && googleCloudSpeechToTextAPIKey != "" ? speechToText(thought) : "";
      const processTagsResponse = processTags(filename, text, []);
      text = processTagsResponse.text; // Pick up any modifications from the tag processing
      const emailSubjectModifiers = processTagsResponse.emailSubjectModifiers;
      const origTags = processTagsResponse.origTags;
      const doc = DocumentApp.create(filename);
      if (text) doc.getBody().setText(text);
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
      insertRow(thoughtMasterSheet, data, 2)
      DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(doc.getId()));
      DriveApp.getFolderById(docFolderID).addFile(DriveApp.getFileById(doc.getId()));
      DriveApp.getFolderById(processedFolderID).addFile(thought);
      DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
      const thoughtSpreadsheetUrl = "https://docs.google.com/spreadsheets/d/" + thoughtSpreadsheet.getId();
      const thoughtSpreadsheetLink = "<a href='" + thoughtSpreadsheetUrl + "'>All Thoughts</a>";
      const tailMessage = `
            

      ${thoughtSpreadsheetUrl}`;
      const tailHtmlmessage = "<br><br><br><br><br>" + thoughtSpreadsheetLink;
      body = displayText + tailMessage;
      htmlBody = displayHtmlText + tailHtmlmessage;
      const subject = (emailSubjectModifiers && emailSubjectModifiers.length > 0 ? emailSubjectModifiers.join(' / ') + " - " : "") + "Thought " + paddedMonth(thoughtDateCreatedDateObject) + '/' + paddedDate(thoughtDateCreatedDateObject) + '/' + thoughtDateCreatedDateObject.getFullYear() + ' ' + thoughtDateCreatedDateObject.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: true, hour: 'numeric', minute: '2-digit'});
      GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body, {
        htmlBody: htmlBody,
        attachments: [thought.getBlob().setName(filename)]
      });
      Logger.log("Processing complete");
    } else {
      Logger.log("No thoughts to process");
    }
    const endTime = new Date();
    scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString());
  } catch (error) {
    const endTime = new Date();
    scriptProperties.setProperty("processRunning", "false" + ":" + endTime.getTime().toString());
    Logger.log(error.stack);
  }
}

/*
Takes a filename and outputs an array of tags
*/
function SplitTagsFromFilename(filename) {
  const tags = filename.split('#')[2].split('$'); // For the example filename "recording20220611132759349#tags#p1$task$.mp3" we're taking the index 2 entry from the # split which would be p1$task$.mp3 and further splitting by '$' which leaves tags = ["p1", "task", ".mp3"]
  tags.pop(); // Removes the last entry which is the file extension - ".mp3"
  return tags;
}

/*
Check for a special 'cancel' tag that skips the rest of the processing code
*/
function IsCancelled(filename) {
  const tags = SplitTagsFromFilename(filename);
  var cancelled = false;
  tags.find(element => { // Array.find allows us to use a function to compare elements
    if (element && element.toLowerCase() === "cancel") {
      cancelled = true;
      return;
    }
  });
  return cancelled;
}

/*
Iterate through the uploaded tags (on both files with recordings and ones without - ie. tag commands)
Each supported tag may trigger unique behavior and has it's own case/switch code block
All unmatched tags are returned in a new array and also added to the email subject line 
*/
function processTags(filename, text, newTags) {
  Logger.log("processTags filename: " + filename + " text: " + text + " newTags: " + newTags.join(', '));
  const response = {};
  const emailSubjectModifiers = [];
  const tags = SplitTagsFromFilename(filename);
  if (newTags && newTags.length > 0) for (var i = 0; i < newTags.length; i++) tags.push(newTags[i]); // If any new tags are passed from doGet() actions, include those tags as they might not have been on the original filename
  response.todoistPriority = 1; // Set default priority to the lowest
  response.origTags = [...tags]; // Return a shallow copy of the original tags
  Logger.log("Original tags: " + response.origTags.join(', '));
  const supportedTags = ["p1","p2","p3","task"]; // 'task' needs to be last in this array to recieve updated priority metadata from the p1,p2,p3 tag processing based the structure of the for loops below
  for (var i = 0; i < supportedTags.length; i++) {
    tags.find(element => { // Array.find allows us to use a function to compare elements
      if (element && element.toLowerCase() === supportedTags[i].toLowerCase()) {  // toLowerCase() ensures we don't miss a tag due to case differences
        tags.splice(element.index, 1); // Remove the found supported tag from the tag list based on the element's index. The '1' in the splice() function means we're removing just 1 item. This doesn't handle if the tag was duplicated in this list.
        switch(element.toLowerCase()) { // Decide what to do for each supported tag
          case "task":
            if (!text) break; // Skip adding a task if the transciption is empty
            const result = JSON.parse(addTask(text, response.todoistPriority)); // Call the ToDoist API and store the result
            if (result && result.id && result.id.toString().length > 0) { // If the result.id is populated, assume the task was added successfully
              emailSubjectModifiers.push("Task Added"); // Add email subject modifiers based on Todoist reponse
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
  return response; // Return an object containting the transcribed text (as it's been potentially modified), array of subject line modifiers, the array of remaining unmatched tags
}

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

function getAllThoughts() {
  const thoughts = [];
  const files = DriveApp.getFolderById(thoughtFolderID).getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if ([MimeType.GOOGLE_DOCS, MimeType.GOOGLE_SHEETS, MimeType.GOOGLE_APPS_SCRIPT].includes(file.getMimeType())) {
      continue;
    }
    thoughts.push(file);
  }
  return thoughts;  
}

function speechToText(file) {
  var text;
  const data = {
    "config": {
        "encoding":"MP3",
        "sampleRateHertz": 44100,
        "languageCode": "en-US",
        "enableAutomaticPunctuation": true,
        "model": "default"
    },
    "audio": {
        "content": Utilities.base64Encode(file.getBlob().getBytes())
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
  for (var i = 0; i < results.length; i++) {
    for (var j = 0; j < results[i].alternatives.length; j++) {
      const transcript = obj.results[i].alternatives[j].transcript;
      const confidence = obj.results[i].alternatives[j].confidence;
      confidences.push(confidence);
      Logger.log("results[" + i + "].alternatives[" + j + "].transcript: " + transcript);
      Logger.log("results[" + i + "].alternatives[" + j + "].confidence: " + confidence);
      text = text ? text + ", " + transcript : transcript;
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

function insertRow(sheet, rowData, optIndex) {
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

function paddedMonth(date) {
  return ("0" + (date.getMonth() + 1)).slice(-2);
}

function paddedDate(date) {
  return ("0" + date.getDate()).slice(-2);
}

function getSheetById(spreadsheet,id) {
  if (!processedFolderID || !docFolderID || !thoughtFolderID || !masterSheetID) return;
  return spreadsheet.getSheets().filter(
    function(s) {return s.getSheetId() === id;}
  )[0];
}

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
    case "favorite":
      message = "favorited";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.getRange("G" + (i + 1)).setValue("TRUE");
          break;
        }
      }
      break;
    case "trash":
      message = "trashed";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          thoughtMasterSheet.deleteRow(i + 1);
          break;
        }
      }
      break;
    case "task":
      message = "task added";
      for (var i = 0; thoughtData.length; i++) {
        if (id == thoughtData[i][0]) {
          processTags(thoughtData[i][1], thoughtData[i][4], ["task"]); // Running through processTags() enables adding priority to the task if it was already added as a tag
          break;
        }
      }
      break;
    }
    const response = HtmlService.createHtmlOutput();
    response.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    response.append("<h2>" + message + "</h2>")
    return response;
  }
}