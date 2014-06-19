/**
 * This section is to be taken out later. It is only used now to test the format of treatment folders.
 */
// dependencies for this section
var fs = require('fs');
var util = require('util');

// Define the default paths all relative to the treatment folder
// var _eel_pathToTreatment = __dirname + "/treatments/ultimatum_seq/";
// var _eel_treatmentScript = _eel_pathToTreatment + "script.js";
// var _eel_treatmentJSON = _eel_pathToTreatment + "treatment.json";

// Load the treatment properties
// var treatmentProperties = JSON.parse(fs.readFileSync(_eel_treatmentJSON).toString());
// console.log(fs.readFileSync(_el_treatmentJSON).toString());
// test of properties
// console.log("First active screen template: " + treatmentProperties.stages[0].activeScreen);

// define the treatment tables (this one is writable by the treatment authors
var tables = {};
// these variables should hold the variables which are read only to the treatment authors
var _treatment = {};
var _session = {};

/**
 * Variable initialization
 * each stage:
 *    subjects[i].participate = true; for all i
 *
 * each period:
 *    globals.period = thisPeriod;
 *    subjects[i].subject = i;
 *    subjects[i].group = 1;
 */

// once the session has been locked the number of subjects will be set
// use this number and the groupSize to initialize the subjects table.
// var startTreatment = function() {
//     var groupSize = (typeof treatmentProperties.groupSize !== 'undefined') ? treatmentProperties.groupSize : clients.length;
// 
//     console.log("groupSize = " + groupSize); // PASS
// 
//     // initialize the read-only treatment variables
//     _treatment.subjects = [];
//     for (var i = 0; i < clients.length; i++) {
//         _treatment.subjects[i] = {subject: i}
//     }
// 
//     // initialize the tables
//     tables = {};
// 
//     tables.globals = {
//         period : 0,
//         numPeriods : treatmentProperties.payingPeriods + treatmentProperties.practicePeriods,
//         payingPeriods : treatmentProperties.payingPeriods,
//         practicePeriods : treatmentProperties.practicePeriods,
//         repeatTreatment : false
//     };
// 
//     tables.subjects = [];
//     tables.session = [];
//     for (var j = 0; j < clients.length; j++) {
//         tables.subjects[j] = {
//             period: 0,
//             subject: j,
//             group: j % (clients.length / groupSize),
//             chat_group: j % (clients.length / groupSize),
//             profit: 0,
//             totalProfit: 0,
//             participate: true,
//             leaveStage: false
//         };
// 
//         tables.session[j] = {
//             subject: 0,
//             finalProfit: 0,
//             showUpFee: (typeof treatmentProperties.showUpFee !== 'undefined') ? treatmentProperties.showUpFee : 0,
//             showUpFeeInvested: 0,
//             moneyAdded: 0,
//             moneyToPay: (typeof treatmentProperties.showUpFee !== 'undefined') ? treatmentProperties.showUpFee : 0,
//             moneyEarned: (typeof treatmentProperties.showUpFee !== 'undefined') ? treatmentProperties.showUpFee : 0
//         };
//     }
// 
//     tables.summary = {};
//     tables.contracts = {};
// 
// }


//
// var tables = {};
// tables.globals = {};
// tables.subjects = [{subject:0,profit:0},{subject:1,profit:0}];

// 
// var treatmentScript = require(_eel_treatmentScript);
// treatmentScript.beginPeriod(tables);
// treatment.beginStage(tables,stageName);

// TODO add code for loading treatments via the filesystem (and in zipped format)


/**
 * Start normal EconExpLab server code
 */
var os = require('os');
var LabManager = require("./labmanager.js");
var TreatmentManager = require("./treatmentmgr.js");

var fs = require('fs');
var _ = require('underscore');
var jade = require('jade');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
// var sio = require('socket.io').listen(server);
var sockjs = require('sockjs');

// set the public directory as available to loaded content.
app.use(express.static('public'));

// find this computer's IP address on the local network
var interfaces = os.networkInterfaces();
var addresses = [];
for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family == 'IPv4' && !address.internal) {
            addresses.push(address.address);
        }
    }
}

// this object manages the backend client pool
var lab = new LabManager({sockjs_url: 'http://cdn.sockjs.org/sockjs-0.3.min.js'}, server);

// this object is the manager sockjs server
var mgr_sock = sockjs.createServer({sockjs_url: 'http://cdn.sockjs.org/sockjs-0.3.min.js'});

// this object manages the treatment
// initialize it once the startTreatment button is hit
var treatment;

// The subjects array carries subject-specific data which is not in the socket object
// renamed clients to avoid confusion with the subjects table
var clients = [];
// var client2subject_id = [];

// create clientsArray to pass to the manager
// var clientsArray = [];

var clientsArray = function() {
    // first get list of clients from the lab manager
    var clientList = [];
    for (var i = 0; i < lab.clients.length; i++) {
        if (typeof lab.clients[i].subjectNum !== 'undefined' && lab.clients[i].subjectNum !== false) {
            clientList[i] = treatment.subjectStates[lab.clients[i].subjectNum];
        } else {
            clientList[i] = {stageName: 'Ready', active: false, period: '-', time: '-'};
        }
        if (lab.clients[i].connected === false) {
            clientList[i].connected = false;
        } else {
            clientList[i].connected = true;
        }
    }
    return clientList;
};

// event listener for adding new clients data is the id of this client in the clients array in labmanager.js
lab.on("addClient", function(data){
    console.log("other addClient eventhandler");
    clients.push({client_id: +data, stageName: "Ready"});
    // create clientsArray to pass to the manager
    // var clientsArray = [];
    // I think one problem here. if I add a client after we are running this should move the stageName to ready for all players
    // yup. ok.... I should only set the state to this for the most recently added client
    // clientsArray[clients[j].client_id] = {stageName: clients[j].state, active: false, period: "-", stageNum: "-", time: "-"};

    // for (var j = 0; j < clients.length; j++) {
    //     clientsArray[clients[j].client_id] = {stageName: clients[j].state, active: false, period: "-", stageNum: "-", time: "-"};
    // }
    // client2subject_id[+data-1] = subjects.length - 1;
    // lab.clientList[+data].conn.write(JSON.stringify({messageName: "update", html: "Please wait for the experiment to begin."}));
    // if a treatment is already started update the manager's view
    if (typeof treatment !== 'undefined' && typeof treatment.subjectStates !== 'undefined') {
        // update timers
        for (var i = 0; i < treatment.subjectStates.length; i++) {
            // only update if currently in an active state
            if (treatment.subjectStates[i].active === true) {
                treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
            }
        }
        // send clientStates
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
    } else {
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
    }

    // console.log("lab listeners: " + util.inspect(lab.listeners('update')));
});

lab.on("lostClient", function() {
    // create client list
    // start with lab.clients
    // if a client has connected = false, 
    if (typeof mgr_conn !== 'undefined') {
    // if a treatment is already started update the manager's view
    if (typeof treatment !== 'undefined' && typeof treatment.subjectStates !== 'undefined') {
        // update timers
        for (var i = 0; i < treatment.subjectStates.length; i++) {
            // only update if currently in an active state
            if (treatment.subjectStates[i].active === true) {
                treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
            }
        }
        // send clientStates
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
    } else {
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
    }

    }
});

// test to see if the reconnectedClient is getting this far
lab.on("reconnectedClient", function(data) {
    console.log("reconnectedClient event received:\nclient: " + data);
    // if a treatment is already started update the manager's view
    if (typeof treatment !== 'undefined' && typeof treatment.subjectStates !== 'undefined') {
        // update timers
        for (var i = 0; i < treatment.subjectStates.length; i++) {
            // only update if currently in an active state
            if (treatment.subjectStates[i].active === true) {
                treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
            }
        }
        // send clientStates
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
    } else {
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
    }

});

// This get request sends the socket shell to the clients
app.get('/subject', function (req, res) {
    //res.send(__dirname + '/shell.html');
    // This readFile method is only used to change 'localhost' to whatever this computer's IP address is.
    fs.readFile(__dirname + '/shell.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading shell.html');
            }
            // change the reference to localhost to the IP address for this computer in the local network
            // data = data.toString().replace("('localhost')", "('" + addresses[0] + "/subject')");
            //res.writeHead(200);
            //res.end(data);
            res.send(data.toString());
        });
});

// var mgr_jade;

var pathToTreatments = __dirname + "/treatments/";
var activeTreatment = "";
var treatmentList = {}; // this is used to map treatment names to paths for the system
var availableTreatments = []; // this list is sent to the mgr_shell
var openTreatments = []; // this is the list of open treatments in the manager's view

// SockJS implementation of the manager code 
// mgr_conn replaces mgr_socket
mgr_sock.on('connection', function(conn) {
    // assign connection to mgr_conn
    mgr_conn = conn;

    // if a treatment is already started update the manager's view
    if (typeof treatment !== 'undefined' && typeof treatment.subjectStates !== 'undefined') {
        // update timers
        for (var i = 0; i < treatment.subjectStates.length; i++) {
            // only update if currently in an active state
            if (treatment.subjectStates[i].active === true) {
                treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
            }
        }
        // send clientStates
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
    } else {
        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
    }

    // read the treatment directory to find treatments
    fs.readdir(pathToTreatments, function(err, files) {
        if (err) {throw err;}
        availableTreatments = [];
        for (var i = 0; i < files.length; i++) {
            if(fs.statSync(pathToTreatments + files[i]).isDirectory()) {
                treatmentList[files[i]] = pathToTreatments + files[i];
                availableTreatments.push(files[i]);
            }
        }
        mgr_conn.write(JSON.stringify({messageName: 'availableTreatments', availableTreatments: availableTreatments}));
    });

    mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: openTreatments}));

    // listen for the start treatment button
    mgr_conn.on('data', function(m) {
        m = JSON.parse(m);
        
        switch(m.messageName) {
            // receive list of openTreatments and store it
            case 'openTreatments':
                openTreatments = m.openTreatments;
                break;

            case 'setActiveTreatment':
                for (var i = 0; i < openTreatments.length; i++) {
                    openTreatments[i].active = false;
                }
                openTreatments[m.treatment].active = true;
                // TODO: assign the treatment variable with this treatment.
                activeTreatment = openTreatments[m.treatment].name;
                mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: openTreatments}));
                break;

            case 'swapOpenTreatments':
                var swapTemp = openTreatments[m.swap[0]];
                openTreatments[m.swap[0]] = openTreatments[m.swap[1]];
                openTreatments[m.swap[1]] = swapTemp;
                mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: openTreatments}));
                break;

            case 'removeTreatment':
                // remove the selected treatment
                openTreatments.splice(m.treatment,1);
                // send the modified list of openTreatments
                mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: openTreatments}));
                break;

            case 'assignClient':
                console.log("Assign Client attempted.");
                if (typeof lab !== 'undefined') {
                    lab.assignClient(m.clientNum, m.subjectNum);
                }
                if (typeof treatment !== 'undefined') {
                    treatment.assignClient(m.clientNum, m.subjectNum);
                }
                // update timers
                for (var i = 0; i < treatment.subjectStates.length; i++) {
                    // only update if currently in an active state
                    if (treatment.subjectStates[i].active === true) {
                        treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
                    }
                }
                // send clientStates
                mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));

                break;

            case 'stopTreatment':
                treatment.endTreatment();
                break;

            case 'startTreatment':
                console.log("Start Treatment clicked.");
                // see if there is an active treatment
                for (var i = 0; i < openTreatments.length; i++) {
                    if (openTreatments[i].active) {
                        treatment = new TreatmentManager(pathToTreatments + openTreatments[i].name + "/");

                        treatment.on("subjectsAssigned", function(subject2client) {
                            console.log("subject assignment: " + subject2client);
                            lab.assignClients(subject2client);
                        });
                        
                        // add listener for client refresh / reconnection
                        lab.on("reconnectedClient", function(data) {
                            console.log("labtest heard 'reconnected' event, calling treatment.refresh()");
                            treatment.refresh(data);
                        });

                        // add listener for endStage call from client
                        lab.on("endStage", function(data) {
                            var endStage = treatment.endStageListener(data.id);
                            endStage(data.experimentData);
                        });

                    }
                }

                if (typeof treatment === 'undefined') {
                    // should not startTreatment if there is no treatment
                    console.log("treatment is undefined (probably no active treatment).");
                    break;
                }


                // console.log("reconnected listener attached");


                // add listener for updataData call from client, reroute data to the treatment
                lab.on("updateData", function(data) {
                    treatment.updateData(data.id, data.command, data.experimentData);
                });

                // add listener for changes to clients table
                treatment.on("clientsTable", function(data) {
                    // if a treatment is already started update the manager's view
                    if (typeof treatment !== 'undefined' && typeof treatment.subjectStates !== 'undefined') {
                        // update timers
                        for (var i = 0; i < treatment.subjectStates.length; i++) {
                            // only update if currently in an active state
                            if (treatment.subjectStates[i].active === true) {
                                treatment.subjectStates[i].time = treatment.subjectStates[i].timeout - Math.round((new Date().getTime() - treatment.subjectStates[i].startStageTime) / 1000);
                            }
                        }
                        // send clientStates
                        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: data.tables}));
                    } else {
                        mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
                    }

                });

                // set listener for log output
                // This produces the log text
                treatment.on("endTreatment", function(log) { 
                    console.log("treatment ended");
                    printLog(log);
                });

                treatment.start(lab.clients, lab.connectedClients());
                break;
            default:
                break;
        }
    });
});

var printLog = function(log) {
    var logString = "";
    for (var i = 0; i < log.length; i++) {
        for (table in log[i]) {
            if (log[i].hasOwnProperty(table) && typeof log[i][table] !== 'undefined') {
                if (util.isArray(log[i][table])) {
                    // check that there are rows in this array
                    if (log[i][table].length > 0) {
                        // build the header first
                        logString += "Period, Table, ";
                        for (variable in log[i][table][0]) {
                            logString +=  variable + ", ";
                        }
                        logString += "\n";

                        // build the table body
                        for (row in log[i][table]) {
                            logString += i + ", " + table + ", ";
                            for (column in log[i][table][row]) {
                                if (log[i][table][row].hasOwnProperty(column)) {
                                    logString += log[i][table][row][column] + ", ";
                                }
                            }
                            logString += "\n";
                        }

                    }

                } else {
                    // this table does not have multiple rows
                    logString += "Period, Table, ";
                    for (value in log[i][table]) {
                        if (log[i][table].hasOwnProperty(value)) {
                            logString += value + ", ";
                        }
                    }
                    logString += "\n";

                    // build the table body
                    logString += i + ", " + table + ", ";
                    for (value in log[i][table]) {
                        if (log[i][table].hasOwnProperty(value)) {
                            logString += log[i][table][value] + ", ";
                        }
                    }
                    logString += "\n";
                }
            }
        }
    }
    // create a time related filename
    fs.writeFile(__dirname + "/treatmentLog.csv", logString, function (err) {
        if (err) { throw err; }
        console.log("log was saved.");
    });
};

mgr_sock.installHandlers(server, {prefix:'/manager/conn'});

// I need to send a manager-specific socket shell.
// this will be a security hole to fill later (i.e. it should not be so easy to access the manager controls)
// In the future I will use the server-side authentication to determine who
// should be able to acces this (specifically for the online version of this
// software).
app.get('/manager', function (req, res) {
    fs.readFile(__dirname + '/mgr_shell.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading shell.html');
            }
            // change the reference to localhost to the IP address for this computer in the local network.
            // "/manager" here refers to the namespace, which is distinct from the
            // GET request above
            // data = data.toString().replace("('localhost')", "('" + addresses[0] + "/manager/conn')");
            res.send(data.toString());
        });
});



console.log("Manager:\n" + addresses[0] + ":" + 1337 + "/manager");
console.log("Subject:\n" + addresses[0] + ":" + 1337 + "/subject");

server.listen(1337);
