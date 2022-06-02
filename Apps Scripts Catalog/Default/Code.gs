const apiKey = "AIzaSyBB4OkM1kBm-3QVomFvVyP-SRfJJECEBRM"; // OPTIONAL - REPLACE WITH YOUR OWN GOOGLE SPEECH TO TEXT API KEY. THE EXISTING KEY BELONGS TO PROGRAMMABLE THOUGHTS AND CAN BE USED IN YOUR PERSONAL SCRIPT. BUT IF YOU'RE GOING TO BE TRANSCRIBING A LOT OF AUDIO, YOU WOULD BE BETTER OFF CREATING YOUR OWN API KEY.
const todoistTestKey = ""; // OPTIONAL - REPLACE WITH YOUR OWN TODOSIT TEST API KEY
const todoistProjectID = ""; // OPTIONAL - REPLACE WITH YOUR OWN TODOSIT PROJECT ID
/////////////////////////////////////
const speechUrl = "https://speech.googleapis.com/v1p1beta1/";
const scriptProperties = PropertiesService.getScriptProperties();
/////////////////////////////////////
const publishedUrl = ""; // OPTIONAL - REPLACE WITH DEPLOYED WEB APP URL - ScriptApp.getService().getUrl() broken - https://issuetracker.google.com/issues/170799249
/////////////////////////////////////
const processedFolderID = scriptProperties.getProperty("processedFolderID");
const docFolderID = scriptProperties.getProperty("docFolderID");
const thoughtFolderID = scriptProperties.getProperty("thoughtFolderID");
const masterSheetID = scriptProperties.getProperty("masterSheetID");
const masterScriptID = scriptProperties.getProperty("masterScriptID");
/////////////////////////////////////

function initialize() {
  var message;
  if (!processedFolderID || !docFolderID || !thoughtFolderID || !masterSheetID || !masterScriptID) {
    Logger.log("Initializing");
    const foldersArrayIDs = [];
    const folders = DriveApp.getFoldersByName("Programmable Thoughts");
    while (folders.hasNext()) foldersArrayIDs.push(folders.next().getId());
    Logger.log("Folders found: " + foldersArrayIDs.length);
    const folder = DriveApp.getFolderById(foldersArrayIDs[0]); // HACK - THERE SHOULD ONLY BE 1...NEED TO HANDLE IF THERE ARE MORE
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName() == "Programmable Thoughts Data") scriptProperties.setProperty("masterSheetID", file.getId());
      if (file.getName() == "Programmable Thoughts Script") scriptProperties.setProperty("masterScriptID", file.getId());
    }
    scriptProperties.setProperty("thoughtFolderID", folder.getId());
    scriptProperties.setProperty("processedFolderID", folder.createFolder("Processed").getId());
    scriptProperties.setProperty("docFolderID", folder.createFolder("Docs").getId());

    // TEMP - https://github.com/Elringus/UnityGoogleDrive/issues/99
    const scriptFiles = DriveApp.getFilesByName("Programmable Thoughts Script");
    while (scriptFiles.hasNext()) {
      const scriptFile = scriptFiles.next();
      if (scriptFile.getName() == "Programmable Thoughts Script") {
        scriptProperties.setProperty("masterScriptID", scriptFile.getId());
        DriveApp.getFolderById(folder.getId()).addFile(scriptFile);
        DriveApp.getFolderById(DriveApp.getRootFolder().getId()).removeFile(scriptFile);
      }
    }    

    ScriptApp.newTrigger('rollingProcess')
      .timeBased()
      .everyMinutes(1)
      .create();
    message = "Initialized";
  } else {
    message = "Already Initialized";
  }
  Logger.log(message);
  return message;
}

function rollingProcess() {
  try {
    if (scriptProperties.getProperty("processRunning") != "true") {
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
    scriptProperties.setProperty("processRunning", "true");
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
        textArray.push(text + " - " + audioLink + " / " + docLink + " >> " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=favorite" + "'>favorite</a>" + " / " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=trash" + "'>trash</a>" + (todoistTestKey && todoistProjectID ? " / " + "<a href='" + publishedUrl + "?id=" + thought.getId() + "&action=task" + "'>task</a>" : ""));
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
    scriptProperties.setProperty("processRunning", "false");
  } catch (error) {
    scriptProperties.setProperty("processRunning", "false");
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
  const url = speechUrl + "speech:recognize?key=" + apiKey;
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
  for (var i = 0; i < results.length; i++) {
    for (var j = 0; j < results[i].alternatives.length; j++) {
      const transcript = obj.results[i].alternatives[j].transcript;
      const confidence = obj.results[i].alternatives[j].confidence;
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