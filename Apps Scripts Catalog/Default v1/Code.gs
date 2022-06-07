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
const publishedUrl = ""; // Replace with deployed web app url. Hit the 'deploy' button on the top right. Under 'Select Type' choose web app, and then hit deploy. Copy that url to this variable

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
    const thoughtFolder = DriveApp.getFolderById(foldersArrayIDs[0]); // Find a better way to do this
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
    Logger.log(error);
  }
}

function process() {
  try {
    const startTime = new Date();
    scriptProperties.setProperty("processRunning", "true" + ":" + startTime.getTime().toString());
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSheetID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, 0);
    const thought = getAllThoughts()[0]; // Need to test sort. Could be last entry.
    if (thought) {
      const thoughtDateCreated = thought.getDateCreated(); 
      const thoughtDateCreatedDateObject = new Date(thoughtDateCreated);
      Logger.log("Processing thought: " + thought.getName() + " dateCreated: " + thoughtDateCreated);
      var actionMessage;  
      const text = googleCloudSpeechToTextAPIKey != "" ? speechToText(thought) : "";
      if (text != "" && todoistTestKey && todoistProjectID) actionMessage = actions(text);
      const doc = DocumentApp.create(thought.getName());
      if (text != "") doc.getBody().setText(text);
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
      const displayText = text + " — " + audioUrl + " / " + docUrl + (publishedUrl ? " / " + favoriteUrl + " / " + trashUrl : "") + (todoistTestKey && todoistProjectID ? " / " + taskUrl : "");
      const displayHtmlText = text + " — " + audioLink + " / " + docLink + (publishedUrl ? " / " + favoriteLink + " / " + trashLink : "") + (todoistTestKey && todoistProjectID ? " / " + taskLink : "");
      const data = [
        thought.getId(),
        thought.getName(),
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
      

      ${(actionMessage ? actionMessage : "")}
      

      ${thoughtSpreadsheetUrl}`;
      const tailHtmlmessage = "<br><br>" + (actionMessage ? actionMessage : "") + "<br><br><br><br><br>" + thoughtSpreadsheetLink;
      body = displayText + tailMessage;
      htmlBody = displayHtmlText + tailHtmlmessage;
      const subject = 'Thought ' + paddedMonth(thoughtDateCreatedDateObject) + '/' + paddedDate(thoughtDateCreatedDateObject) + '/' + thoughtDateCreatedDateObject.getFullYear() + ' ' + thoughtDateCreatedDateObject.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: true, hour: 'numeric', minute: '2-digit'});
      GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body, {
        htmlBody: htmlBody,
        attachments: [thought.getBlob().setName(thought.getName())]
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
    Logger.log(error);
  }
}

function actions(text) {
  if (text.includes("task start") && text.includes("task stop")) { // Currently can't handle multiple tasks
    const taskTextArray = text.split("task start");
    const task = taskTextArray[1].split("task stop")[0];
    addTask(task);
    return "Task Added: " + task;
  }
}

function addTask(task){
  if (!todoistTestKey) return;
  Logger.log("Adding task: " + task);
  const url = "https://api.todoist.com/rest/v1/tasks";
  var data = {
    'content': task,
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
  if (!results) return "(no text could be transcribed)"; 
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
           addTask(thoughtData[i][4]);
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