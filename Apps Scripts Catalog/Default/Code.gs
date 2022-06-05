/////////////////////////////////////////////////////////////////////
// WELCOME TO THE DEFAULT PROGRAMMABLE THOUGHTS GOOGLE APPS SCRIPT //
/////////////////////////////////////////////////////////////////////
// IF THIS IS YOUR FIRST TIME HERE, YOU NEED TO RUN THE 'INITIALIZE' FUNCTION. HIT THE 'RUN' BUTTON IN THE TOP MENU AND GO THROUGH THE AUTHORIZATION FLOW.
// NOTE THAT THESE SOMEWHAT SCARY LOOKING PERMISSIONS ARE ONLY BEING GRANTED TO YOUR OWN PERSONAL ACCOUNT (AND NO ONE ELSE).
// AFTER THAT, YOU'RE FREE TO TINKER AWAY. BUT IT MIGHT BE A GOOD IDEA TO JUST GET A FEEL FOR THE OPERATIONAL FLOW BEFORE DIGGING INTO CODE MODIFICATIONS.

/////////////////////////
// OPTIONAL PARAMETERS //
/////////////////////////
const googleCloudSpeechToTextAPIKey = "AIzaSyDXgPaIIbqpYeNSMlVH5g8oKddHWGH2fSo"; // REPLACE WITH YOUR OWN GOOGLE SPEECH TO TEXT API KEY. THE EXISTING KEY BELONGS TO PROGRAMMABLE THOUGHTS AND CAN BE USED IN YOUR PERSONAL SCRIPT.
const todoistTestKey = ""; // REPLACE WITH YOUR OWN TODOSIT TEST API KEY
const todoistProjectID = ""; // REPLACE WITH YOUR OWN TODOSIT PROJECT ID
const publishedUrl = ""; // REPLACE WITH DEPLOYED WEB APP URL - ScriptApp.getService().getUrl() broken - https://issuetracker.google.com/issues/170799249

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
    Logger.log("Folders found: " + foldersArrayIDs.length);
    const thoughtFolder = DriveApp.getFolderById(foldersArrayIDs[0]); // HACK - THERE SHOULD ONLY BE 1...NEED TO HANDLE IF THERE ARE MORE
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

    scriptProperties.setProperty("masterSheetID", masterSheet.getId());
    thoughtFolder.addFile(DriveApp.getFileById(masterSheet.getId()));
    DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(masterSheet.getId()));
    ScriptApp.newTrigger('rollingProcess')
      .timeBased()
      .everyMinutes(1)
      .create();
    const now = new Date();
    scriptProperties.setProperty("processRunning", "false" + ":" + now.getTime().toString());
    Logger.log("Initialized");
  } else {
    Logger.log("Already Initialized");
  }
}

function rollingProcess() {
  try {
    const now = new Date();
    const processRunning = scriptProperties.getProperty("processRunning").split(':')[0];
    const processRunningTimestamp = parseInt(scriptProperties.getProperty("processRunning").split(':')[1]);
    const diffMilliseconds = now.getTime() - processRunningTimestamp;
    Logger.log("rollingProcess diffMilliseconds: " + diffMilliseconds);
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
    Logger.log("Process");
    const startTime = new Date();
    scriptProperties.setProperty("processRunning", "true" + ":" + startTime.getTime().toString());
    const thoughtSpreadsheet = SpreadsheetApp.openById(masterSheetID);
    const thoughtMasterSheet = getSheetById(thoughtSpreadsheet, 0);
    var pizza = false;
    const textArray = [];
    // const blobArray = [];
    const thoughts = getAllThoughts();
    var thoughtDateCreatedDateObject
    if (thoughts && thoughts.length > 0) {
      Logger.log("Processing " + thoughts.length + " thoughts");
      for (var i = 0; i < thoughts.length; i++) {
        const thought = thoughts[i];
        const thoughtDateCreated = thought.getDateCreated(); 
        thoughtDateCreatedDateObject = new Date(thoughtDateCreated);
        var actionMessage;  
        Logger.log("name: " + thought.getName() + " dateCreated: " + thoughtDateCreated);
        const text = speechToText(thought);
        if (!text) {
          Logger.log("Empty audio file, more acurately, no text could be transcribed");
          DriveApp.getFolderById(processedFolderID).addFile(thought);
          DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
          const data = [
            thought.getId(),
            thought.getName(),
            thoughtDateCreated,
            "https://drive.google.com/file/d/" + thought.getId() + "/view",
            "",
            ""
          ];
          insertRow(thoughtMasterSheet, data, 2)
          continue;
        }
        if (todoistTestKey && todoistProjectID) actionMessage = actions(text);
        const doc = DocumentApp.create(thought.getName());
        doc.getBody().setText(text);
        const audioLink = "<a href=" + "'https://drive.google.com/file/d/" + thought.getId() + "/view'" + ">audio</a>";
        const docLink = "<a href=" + "'https://drive.google.com/file/d/" + doc.getId() + "'>doc</a>" // "https://docs.google.com/document/d/" + doc.getId();
        textArray.push(text + " — " + audioLink + " / " + docLink + (publishedUrl ? " / " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=favorite" + "'>favorite</a>" + " / " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=trash" + "'>trash</a>" : "") + (todoistTestKey && todoistProjectID ? " / " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=task" + "'>task</a>" : ""));
        // blobArray.push(thought.getBlob());
        const data = [
          thought.getId(),
          thought.getName(),
          thoughtDateCreated,
          "https://drive.google.com/file/d/" + thought.getId() + "/view",
          text,
          "https://drive.google.com/file/d/" + doc.getId() 
        ];
        insertRow(thoughtMasterSheet, data, 2)
        DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(DriveApp.getFileById(doc.getId()));
        DriveApp.getFolderById(docFolderID).addFile(DriveApp.getFileById(doc.getId()));
        DriveApp.getFolderById(processedFolderID).addFile(thought);
        DriveApp.getFolderById(thoughtFolderID).removeFile(thought);
        if (text.toLowerCase().includes("pizza")) pizza = true;
        Logger.log("Thought " + (i + 1) + " processed");
      }
      if (textArray && textArray.length > 0) textArray.reverse();
      if (pizza) {
        Logger.log("pizza");
        const body = "pizza pizza";
        const htmlBody = '<img src="https://files.panomoments.com/santarpios-pizza.jpg" alt="pizza"/>';
        GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Pizza Pizza", body, {
          htmlBody: htmlBody
        });
      } else if (textArray && textArray.length > 0) {
        var body;
        var htmlBody;
        const tailMessage = "";
        const tailHtmlmessage = "<br><br>" + (actionMessage ? actionMessage : "") + "<br><br><br><br><br><a href='https://docs.google.com/spreadsheets/d/" + thoughtSpreadsheet.getId() + "'>All Thoughts</a> - say 'pizza'";
        if (thoughts.length > 1) {
          body = textArray.map(function(val, index) { return (index + 1).toString() + ". " + val; }).join(" | ") + tailMessage;
          htmlBody = textArray.map(function(val, index) { return (index + 1).toString() + ". " + val; }).join("<br>") + tailHtmlmessage;
        } else {
          body = textArray.join(" | ") + tailMessage;
          htmlBody = textArray.join("<br>") + tailHtmlmessage;
        }
        const subject = 'Thought ' + paddedMonth(thoughtDateCreatedDateObject) + '/' + paddedDate(thoughtDateCreatedDateObject) + '/' + thoughtDateCreatedDateObject.getFullYear() + ' ' + thoughtDateCreatedDateObject.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour12: true, hour: 'numeric', minute: '2-digit'});
        GmailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body, {
          htmlBody: htmlBody
        });
      }
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
  if (!results) return; 
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
  return spreadsheet.getSheets().filter(
    function(s) {return s.getSheetId() === id;}
  )[0];
}

function doGet(e) {
  Logger.log(e);
  const adminHTML = HtmlService.createTemplateFromFile('admin');
  const admin = adminHTML.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  admin.setTitle("Thoughts Admin");
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
  return admin;
}