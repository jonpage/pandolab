/**
 * Module dependencies
 */
var fs = require('fs');
var rimraf = require('rimraf');
var util = require('util');
var path = require('path');
var os = require('os');
var jade = require('jade');
var express = require('express');
var http = require('http');
var sockjs = require('sockjs');
var LabManager = require("./labmanager.js");
var TreatmentManager = require("./treatmentmgr.js");
var check = require('syntax-error');

/**
 * Module exports
 */

exports = module.exports = LabSession;

var mgr_conn;

Error.stackTraceLimit = Infinity;

/**
 * LabSession constructor
 * @param {String} treatmentsFolder Location of treatment files for this user
 * @param {String} shortCode        Unique alphanumeric id for this lab session
 * @param {Express} app             Express app from the main program
 * @param {HTTPServer} server       HTTP server object
 */
function LabSession(treatmentsFolder, shortCode, app, server) {

    var self = this;

    this.shortCode = shortCode;
    this.app = app;
    self.mgr_conn;
    // define the treatment tables (this one is writable by the treatment authors
    var tables = {};
    // this object manages the treatment
    // initialize it once the startTreatment button is hit
    var treatment;
    // The subjects array carries subject-specific data which is not in the socket object
    // renamed clients to avoid confusion with the subjects table
    self.clients = [];

    //var pathToTreatments = __dirname + "/treatments/";
    var pathToTreatments = treatmentsFolder;
    var activeTreatment = "";
    var treatmentList = {}; // this is used to map treatment names to paths for the system
    var availableTreatments = []; // this list is sent to the mgr_shell
    var existingSessionData = [];
    self.openTreatments = []; // this is the list of open treatments in the manager's view

    // TODO add code for loading treatments via the filesystem (and in zipped format)

    // initialize server
    // var app = express();

    // // set the public directory as available to loaded content.
    // app.use(express.static('public'));

    // this object manages the backend client pool
    self.lab = new LabManager({sockjs_url: 'http://cdn.sockjs.org/sockjs-0.3.min.js'}, server, shortCode);

    // this object is the manager sockjs server
    self.mgr_sock = sockjs.createServer({sockjs_url: 'http://cdn.sockjs.org/sockjs-0.3.min.js'});

    // this is a convenience method
    var clientsArray = function() {
        // first get list of clients from the lab manager
        var clientList = [];
        for (var i = 0; i < self.lab.clients.length; i++) {
            if (typeof self.lab.clients[i].subjectNum !== 'undefined' && self.lab.clients[i].subjectNum !== false && typeof treatment !== 'undefined' && treatment !== false) {
                clientList[i] = treatment.subjectStates[self.lab.clients[i].subjectNum];
            } else {
                clientList[i] = {stageName: 'Ready', active: false, period: '-', time: '-'};
            }
            if (self.lab.clients[i].connected === false) {
                clientList[i].connected = false;
            } else {
                clientList[i].connected = true;
            }
        }
        return clientList;
    };

    // event listener for adding new clients data is the id of this client in the clients array in labmanager.js
    self.lab.on("addClient", function(data){
        console.log("other addClient eventhandler");
        self.clients.push({client_id: +data, stageName: "Ready"});
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
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
        } else {
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
        }
    });

    self.lab.on("lostClient", function() {
        // create client list
        // start with lab.clients
        // if a client has connected = false, 
        if (typeof self.mgr_conn !== 'undefined') {
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
                self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
            } else {
                self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
            }

        }
    });

    // test to see if the reconnectedClient is getting this far
    self.lab.on("reconnectedClient", function(data) {
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
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
        } else {
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
        }

    });

    // This get request sends the socket shell to the clients
    app.get('/lab/'+shortCode, function (req, res) {
        fs.readFile(__dirname + '/shell.html',
            function (err, data) {
                if (err) {
                    res.writeHead(500);
                    return res.end('Error loading shell.html');
                }
                res.send(data.toString().replace("subject/conn", "subject/"+shortCode));
            });
    });

    // SockJS implementation of the manager code 
    // self.mgr_conn replaces mgr_socket
    this.mgr_sock.on('connection', function(conn) {
        // assign connection to mgr_conn
        self.mgr_conn = conn;

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
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));
        } else {
            self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
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
            self.mgr_conn.write(JSON.stringify({messageName: 'availableTreatments', availableTreatments: availableTreatments}));
        });

        self.mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: self.openTreatments}));

        // listen for the start treatment button
        self.mgr_conn.on('data', function(m) {
            m = JSON.parse(m);
            var reconnectedClientHandler = function (data) {
                console.log("labtest heard 'reconnected' event, calling treatment.refresh()");
                if (typeof treatment !== 'undefined') {
                    treatment.refresh(data);
                }
            }

            switch(m.messageName) {
                // receive list of openTreatments and store it
                case 'openTreatments':
                    self.openTreatments = m.openTreatments;
                    break;

                case 'setActiveTreatment':
                    for (var i = 0; i < self.openTreatments.length; i++) {
                        self.openTreatments[i].active = false;
                    }
                    self.openTreatments[m.treatment].active = true;
                    // TODO: assign the treatment variable with this treatment.
                    activeTreatment = self.openTreatments[m.treatment].name;
                    self.mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: self.openTreatments}));
                    break;
                
                case 'deleteTreatments':
                    var treatmentArray = m.treatments;
                    var rmHandler = function(treatmentName) {
                        return function(e) {
                            if (e) {throw(e);} 
                                availableTreatments.splice(availableTreatments.indexOf(treatmentName),1);
                                self.mgr_conn.write(JSON.stringify({messageName: 'availableTreatments', availableTreatments: availableTreatments}));
                        };
                    };
                    for (var j = 0; j < m.treatments.length; j++) {
                        rimraf(path.join(pathToTreatments,m.treatments[j]), rmHandler(m.treatments[j]));
                    }
                    break;

                case 'getTreatments':
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
                            self.mgr_conn.write(JSON.stringify({messageName: 'availableTreatments', availableTreatments: availableTreatments}));
                        });
                    break;

                // case 'swapOpenTreatments':
                //     var swapTemp = openTreatments[m.swap[0]];
                //     openTreatments[m.swap[0]] = openTreatments[m.swap[1]];
                //     openTreatments[m.swap[1]] = swapTemp;
                //     self.mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: openTreatments}));
                //     break;

                case 'removeTreatment':
                    // remove the selected treatment
                    // first confrim this treatment is not running
                    if (self.openTreatments[m.treatment].running === false) {
                        self.openTreatments.splice(m.treatment,1);
                        // update which treatment should be active
                        var lastFinished = -1;
                        for (i = 0; i < self.openTreatments.length; i++) {
                            if (self.openTreatments[i].finished === true) {
                                lastFinished = i;
                            }
                        }
                        if (lastFinished + 1 < self.openTreatments.length) {
                            self.openTreatments[lastFinished + 1].active = true;
                        }
                        // send the modified list of openTreatments
                        self.mgr_conn.write(JSON.stringify({messageName: 'openTreatments', openTreatments: self.openTreatments}));
                    }
                    break;

                case 'assignClient':
                    console.log("Assign Client attempted.");
                    if (typeof self.lab !== 'undefined') {
                        self.lab.assignClient(m.clientNum, m.subjectNum);
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
                    self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: treatment.tables}));

                    break;

                case 'stopTreatment':
                    if (treatment != false && typeof treatment !== 'undefined') {
                        treatment.endTreatment();
                    }
                    // treatment = false;
                    break;

                case 'startTreatment':
                    console.log("Start Treatment clicked.");
                    // see if there is an active treatment
                    for (var i = 0; i < self.openTreatments.length; i++) {
                        if (self.openTreatments[i].active && self.openTreatments[i].running === false) {
                            // adding a try-catch block for error reporting to the manager
                            try {
                                var scriptSrc = fs.readFileSync(pathToTreatments + self.openTreatments[i].name + "/" + "script.js");
                                var err = check(scriptSrc, "script.js")
                                if (err) {
                                    // send the error to the user
                                    self.mgr_conn.write(JSON.stringify({messageName: 'error', error: err}));
                                } else {
                                treatment = new TreatmentManager(pathToTreatments + self.openTreatments[i].name + "/", existingSessionData);
                                self.openTreatments[i].running = true;

                                treatment.removeAllListeners("subjectsAssigned").on("subjectsAssigned", function(subject2client) {
                                    console.log("subject assignment: " + subject2client);
                                    self.lab.assignClients(subject2client);
                                });

                                // add listener for client refresh / reconnection
                                self.lab.removeListener("reconnectedClient", reconnectedClientHandler).on("reconnectedClient", reconnectedClientHandler);

                                // add listener for endStage call from client
                                self.lab.removeAllListeners("endStage").on("endStage", function(data) {
                                    console.log("labsession.js[302] - calling endStage for " + data.id);
                                    if (typeof treatment !== 'undefined') {
                                        var endStage = treatment.endStageListener(data.id);
                                        endStage(data.experimentData);
                                    }
                                });

                                // add listener for updataData call from client, reroute data to the treatment
                                self.lab.removeAllListeners("updateData").on("updateData", function(data) {
                                    treatment.updateData(data.id, data.command, data.experimentData);
                                });
                                // add listener for changes to clients table
                                treatment.removeAllListeners("clientsTable").on("clientsTable", function(data) {
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
                                        self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray(), tables: data.tables}));
                                    } else {
                                        self.mgr_conn.write(JSON.stringify({messageName: 'update', clients: clientsArray()}));
                                    }

                                });

                                treatment.removeAllListeners("treatmentEnded").on("treatmentEnded", function(){
                                    // set the active treatment to finished and activate the next
                                    for (var i = 0; i < self.openTreatments.length; i++) {
                                        if (self.openTreatments[i].active === true) {
                                            self.openTreatments[i].active = false;
                                            self.openTreatments[i].running = false;
                                            self.openTreatments[i].finished = true;
                                        }
                                    }
                                    var lastFinished = -1;
                                    for (i = 0; i < self.openTreatments.length; i++) {
                                        if (self.openTreatments[i].finished === true) {
                                            lastFinished = i;
                                        }
                                    }
                                    if (lastFinished + 1 < self.openTreatments.length) {
                                        self.openTreatments[lastFinished + 1].active = true;
                                    }
                                    self.mgr_conn.write(JSON.stringify({messageName: 'treatmentEnded', openTreatments: self.openTreatments}));
                                    // treatment = false;
                                });

                                // set listener for log output
                                // This produces the log text
                                // treatment.on("endTreatment", function(log) {
                                //     printLog(log);
                                // });
                                
                                treatment.start(self.lab.clients, self.lab.connectedClients());
                                }
                            } catch (err) {
                                self.mgr_conn.write(JSON.stringify({messageName: 'error', error: err.stack}));
                            }
                        }
                    }


                    // console.log("reconnected listener attached");



                    break;
                default:
                    break;
            }
        });
    });


    console.log("shortCode: " + shortCode);
    console.log("install handlers: " + this.mgr_sock.installHandlers(server, {prefix:'/manager/' + shortCode}));

    // // I need to send a manager-specific socket shell.
    // // this will be a security hole to fill later (i.e. it should not be so easy to access the manager controls)
    // // In the future I will use the server-side authentication to determine who
    // // should be able to acces this (specifically for the online version of this
    // // software).
    // app.get('/manager', function (req, res) {
    //     fs.readFile(__dirname + '/mgr_shell.html',
    //         function (err, data) {
    //             if (err) {
    //                 res.writeHead(500);
    //                 return res.end('Error loading shell.html');
    //             }
    //             res.send(data.toString());
    //         });
    // });

}

LabSession.prototype.isRunning = function() {
    var running = false
    for (var i = 0; i < this.openTreatments.length; i++) {
        if (this.openTreatments[i].running === true) {
            running = true;
        }
    }
    return running;
};

/**
 *  This function closes down the lab session by ending the connection with users.
 */
LabSession.prototype.close = function() {
    // kill the route to the lab to prevent anyone from loading it
    for ( var i = this.app.routes.get.length - 1; i >= 0; i--) {
        if (this.app.routes.get[i].path === "/lab/" + this.shortCode) {
          this.app.routes.get.splice(i, 1);
        }
    }
    // kill the connection for each client
    this.lab.close();
    this.mgr_conn.end();
};
