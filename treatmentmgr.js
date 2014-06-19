/**
 * Module dependencies
 */
var EventEmitter = require("events").EventEmitter;
var fs = require('fs');
var util = require('util');
var jade = require('jade');
var path = require('path');
// this is used to collect current time data
var date = new Date();

exports = module.exports = TreatmentManager;


/**
 * Constructor
 */
function TreatmentManager(pathToTreatment, sessionsTable) 
{
    /**
     * Annex of variables that were previousl defined statically, but are now properties of each instance
     */

    // this.existingSessionData;

    // flag for if this treatment is running
    this.running = false;

    // this.properties;
    // this.clients;
    this.subjectStates = [];
    // this.path;
    this.stages = [];

    this.tables = {};
    this.log = []; // this array will contain tables from previous periods

    // this.currentPeriod;

    // this.userFcn;
    // experimentData[i][j] corresponds to stage i, subject j
    this.experimentData = [];
    // each period this will be a vector of length equal to the number of stages and all values equal to true (set to false once the first has ended)
    this.firstToEnd = [];
    this.numSubjectsStarted = [];

    /**
     * End annex
     */

    this.pathToTreatment = pathToTreatment;
    // grab treatment properties
    this.properties = JSON.parse(fs.readFileSync(this.pathToTreatment + "treatment.json").toString());
    // grab userFcn
    this.userFcn = require(this.pathToTreatment + "script.js");
    // grab stages
    // TODO test extension to support handlebars templates
    for (var i = 0; i < this.properties.stages.length; i++) {
        this.stages[i] = {
            activeScreen: jade.compile(fs.readFileSync(this.pathToTreatment + this.properties.stages[i].activeScreen).toString()),
            waitingScreen: jade.compile(fs.readFileSync(this.pathToTreatment + this.properties.stages[i].waitingScreen).toString())
        };
    }

    console.log("stages length: " + this.stages.length);

    if (typeof sessionsTable !== 'undefined') {
        this.existingSessionData = sessionsTable;
    } else {
        this.existingSessionData = [];
    }
    // only want clients who are participants
    // for (var i = 0; i < this.clients.length; i++) {
    //     this.subjectStates[i] = {stageNum:-1, stageName: "Ready", active: false};
    // }
}

/**
 * Inherits from EventEmitter.
 */

TreatmentManager.prototype.__proto__ = EventEmitter.prototype;

/**
 * Begin treatment
 * @param {Array} clients A list of clients from labmanager.js
 */
TreatmentManager.prototype.start = function(clients, connectedClients) 
{
    // initialize treatment vars
    this.currentPeriod = 0;
    this.clients = clients;
    this.initializeTreatment(clients, connectedClients);

    // set the clientState to the first stage for all subjects
    var subjectNum = 0
    for (var i = 0; i < this.numSubjects; i++) {
        this.subjectStates[i] = 
        {
            stageNum: 0, 
            subjectNum: i,
            stageName: this.properties.stages[0].name, 
            active: true, 
            period: this.currentPeriod, 
            timeout: (typeof this.properties.stages[0].timeout !== "undefined") ? this.properties.stages[0].timeout : 30,
            startStageTime: new Date().getTime(),
            time: 30
        };
    }
    // console.log("line 102, getTime: " + new Date().getTime());
    // emit event signalling that clients table has been updated
    this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});

    // initialize experimentData array 
    // experimentData[i][j] corresponds to stage i, subject j
    this.experimentData[0] = [];

    if (typeof this.userFcn.beginPeriod !== 'undefined') {
        this.userFcn.beginPeriod(this.tables);
    }
    // start first stage
    this.running = true;
    this.startStage();
    // add eventListener for endStage
    // for (var j = 0; j < this.clients.length; j++) {
        // console.log("EventListener for endStage: j = " + j);
        // this.clients[j].on("endStage", this.endStageListner(j));
    // }
};

/**
 * Handle reconnecting clients
 * subject_id is expected to be a subject index, not a client index
 */
TreatmentManager.prototype.refresh = function(client_id) 
{
    subject_id = this.subjects.indexOf(client_id);
    if (subject_id === -1) {
        // do nothing
    } else {
        // change this.tables object to have the subjectNum
        var stageTable = JSON.parse(JSON.stringify(this.tables));
        stageTable.subjectNum = subject_id;
        // need to recalculate time before sending it
        this.subjectStates[subject_id].time = this.subjectStates[subject_id].timeout - Math.round((new Date().getTime() - this.subjectStates[subject_id].startStageTime) / 1000);
            stageTable.time = this.subjectStates[subject_id].time;

        // if this period is not a practice period, add the current period profit to totalProfit
        if (this.currentPeriod >= this.properties.practicePeriods) {
            stageTable.subjects[subject_id].totalProfit += +stageTable.subjects[subject_id].profit;
        }

        // update the client's view
        if (this.subjectStates[subject_id].active) {
            console.log("treatmentmgr.js[151] - subject " + subject_id + " is active");
            this.clients[this.subjects[subject_id]].conn.write(JSON.stringify({messageName: "update",
                        html: this.stages[this.subjectStates[subject_id].stageNum].activeScreen(stageTable),
                time: this.subjectStates[subject_id].timeout - ((new Date().getTime() - this.subjectStates[subject_id].startStageTime) / 1000)
                    }));
        } else {
            console.log("treatmentmgr.js[157] - subject " + subject_id + " is not active");
            this.clients[this.subjects[subject_id]].conn.write(JSON.stringify({messageName: "update", html: this.stages[this.subjectStates[subject_id].stageNum].waitingScreen(stageTable)}));
        }
        // emit event signalling that clients table has been updated
        this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
    }
    // reattach endStage event listener
    // this.clients[subject_id].on("endStage", this.endStageListner(subject_id));
};

/**
 * @this {TreatmentManager}
 * @param {Number} id The subject number of the user that sent the data.
 * @param {String} command The command that was sent. This corresponds to 
 */
TreatmentManager.prototype.updateData = function (id, command, data) {
    // for now, simply pass everything to the user function
    if (typeof this.userFcn.updateData !== 'undefined') {
        console.log("command: " + command);
        console.log("id: " + id);
        console.log("data: " + JSON.stringify(data));
        this.userFcn.updateData(this.table, this.subjectStates[id].stageNum, id, command, data);
    }
    // for now, tell all users to update their view to reflect changes from updateData
    // update the client's view
    for (var i = 0; i < this.subjects.length; i++) {

        // only update the view for active clients
        if (this.subjectStates[i].active) {
            console.log("treatmentmgr.js[186] - subject " + i + " is active");
            // change this.tables object to have the subjectNum
            var stageTable = JSON.parse(JSON.stringify(this.tables));
            stageTable.subjectNum = i;
            stageTable.time = this.subjectStates[i].time;
            // if this period is not a practice period, add the current period profit to totalProfit
            if (this.currentPeriod >= this.properties.practicePeriods) {
                stageTable.subjects[i].totalProfit += +stageTable.subjects[i].profit;
            }
            this.clients[this.subjects[i]].conn.write(JSON.stringify({
                messageName: "update",
                html: this.stages[this.subjectStates[i].stageNum].activeScreen(stageTable),
                time: this.subjectStates[i].timeout - ((new Date().getTime() - this.subjectStates[i].startStageTime) / 1000)
            }));
        }

    }
    // tell the manager to update their view as well
    this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
    
}

// closure to the rescue
TreatmentManager.prototype.endStageListener = function(client_id)
{
    subjectNum = this.subjects.indexOf(client_id);
    console.log("TreatmentManager.endStageListener(" + subjectNum + ")");
    // be careful with the dynamic this.
    self = this;
    return function(data) {
        // collect data
        // console.log("j (subjectNum): " + subjectNum);
        // console.log("subjectStates.length = " + self.subjectStates.length);
        if (typeof self.experimentData[self.subjectStates[subjectNum].stageNum] !== 'undefined') {
            self.experimentData[self.subjectStates[subjectNum].stageNum][subjectNum] = data;
        } else {
            self.experimentData[self.subjectStates[subjectNum].stageNum] = [];
            self.experimentData[self.subjectStates[subjectNum].stageNum][subjectNum] = data;
        }
        // emit event signalling that clients table has been updated
        self.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
        // call endStage with array of data indexed by subjectNum
        self.endStage(self.experimentData[self.subjectStates[subjectNum].stageNum],subjectNum);
    };
}

/**
 * startStage function: show the next stage for the specified subjects
 */
TreatmentManager.prototype.startStage = function(subjectNum) 
{
    // see if subjectNum is valid
    if (subjectNum in this.subjectStates) {
        console.log("only start for: " + subjectNum);
        // start stage for only this subject
        var thisSubjectStage = this.subjectStates[subjectNum].stageNum;
        this.numSubjectsStarted[thisSubjectStage] += 1;
        // call user functions
        if(this.numSubjectsStarted[thisSubjectStage] === 1) {
            if(typeof this.userFcn.beginStageFirst !== 'undefined') {
                this.userFcn.beginStageFirst(this.tables,this.subjectStates[subjectNum].stageName, subjectNum);
            }
            if(typeof this.userFcn.beginStage !== 'undefined') {
                this.userFcn.beginStage(this.tables,this.subjectStates[subjectNum].stageName, subjectNum);
            }
        }
        if(typeof this.userFcn.beginStageEach !== 'undefined') {
            this.userFcn.beginStageEach(this.tables,this.subjectStates[subjectNum].stageName,subjectNum);
        }
        if(this.numSubjectsStarted[thisSubjectStage] === this.subjectStates.length && typeof this.userFcn.beginStageLast !== 'undefined') {
            this.userFcn.beginStageLast(this.tables,this.subjectStates[subjectNum].stageName,subjectNum);
        }

        // change this.tables object to have the subjectNum
        var stageTable = JSON.parse(JSON.stringify(this.tables));
        stageTable.subjectNum = subjectNum;
        stageTable.time = this.subjectStates[subjectNum].time;
        // if this period is not a practice period, add the current period profit to totalProfit
        if (this.currentPeriod >= this.properties.practicePeriods) {
            stageTable.subjects[subjectNum].totalProfit += +stageTable.subjects[subjectNum].profit;
        }
        // check the participate condition
        if (this.tables.subjects[subjectNum].participate === true) {
            this.clients[this.subjects[subjectNum]].conn.write(JSON.stringify({messageName: "update", 
                html: this.stages[this.subjectStates[subjectNum].stageNum].activeScreen(stageTable),
                time: this.subjectStates[subjectNum].timeout - ((new Date().getTime() - this.subjectStates[subjectNum].startStageTime) / 1000)
                }));
        } else {
            this.endStage({},subjectNum);
        }
    } else {
        console.log("start stage for all");
        // prepare stageTables
        var stageTables = [];
        // startStage for all subjects
        for (var i = 0; i < this.subjectStates.length; i++) {
            // call user functions
            if(i === 0) {
                if(typeof this.userFcn.beginStageFirst !== 'undefined') {
                    this.userFcn.beginStageFirst(this.tables,this.subjectStates[i].stageName,i);
                }
                if(typeof this.userFcn.beginStage !== 'undefined') {
                    this.userFcn.beginStage(this.tables,this.subjectStates[i].stageName,i);
                }
            }
            if(typeof this.userFcn.beginStageEach !== 'undefined') {
                this.userFcn.beginStageEach(this.tables,this.subjectStates[i].stageName,i);
            }
            if(i + 1 === this.subjectStates.length && typeof this.userFcn.beginStageLast !== 'undefined') {
                this.userFcn.beginStageLast(this.tables,this.subjectStates[i].stageName,i);
            }

            // closures!?
            var activeScreenFunc = function(index) {
                return this.stages[this.subjectStates[index].stageNum].activeScreen(stageTables[index]);
            };

            // add subjectNum to the locals passed to the template
            stageTables[i] = JSON.parse(JSON.stringify(this.tables));
            stageTables[i].subjectNum = i;
            stageTables[i].time = this.subjectStates[i].time;
            // if this period is not a practice period, add the current period profit to totalProfit
            if (this.currentPeriod >= this.properties.practicePeriods) {
                stageTables[i].subjects[i].totalProfit += +stageTables[i].subjects[i].profit;
            }
            // clients[i].emit("update", {html: activeScreenFunc(i)});
            // check participate
            if (this.tables.subjects[i].participate === true) {
                this.clients[this.subjects[i]].conn.write(JSON.stringify({messageName: "update",
                    html: this.stages[this.subjectStates[i].stageNum].activeScreen(stageTables[i]),
                    time: this.subjectStates[i].timeout - ((new Date().getTime() - this.subjectStates[i].startStageTime) / 1000)
                    }));
            } else {
                this.endStage({},i);
            }
        }
    }
};

/**
 * endPeriod function
 */
TreatmentManager.prototype.endPeriod = function() 
{
    // Sum profit if not a practice period
    if (this.currentPeriod >= this.properties.practicePeriods) {
        for (var i = 0; i < this.tables.subjects.length; i++) {
            this.tables.subjects[i].totalProfit += +this.tables.subjects[i].profit;
        }
    }
    // save the period to the log
    this.savePeriod();

    // see if this was the last period
    if (this.currentPeriod >= this.properties.payingPeriods + this.properties.practicePeriods - 1 && !this.tables.globals.repeatTreatment) {
        // update the session table
        for (i = 0; i < this.numSubjects; i++) {
            this.tables.session[i].finalProfit += +this.tables.subjects[i].totalProfit;
        }
        // save the period to the log
        this.savePeriod();
        this.endTreatment();
    } else {
        // save the period to the log
        this.savePeriod();
        this.startPeriod(this.currentPeriod + 1);
    }
};

/**
 * endStage function
 * This primarily sends the waiting screen if the subject needs to wait 
 * and calls the startStage or endPeriod functions where appropriate.
 */
TreatmentManager.prototype.endStage = function(data,subjectNum) 
{
    var last = false;
    var first = false;
    var nextStage;
    // end for only one subject
    if (subjectNum in this.subjectStates) {

        // process experimentData by assigning any value which appears in the subjects table to the relavent subject
        for (variable in data[subjectNum]) {
            // remove the condition that the variable already exists
            if (data[subjectNum].hasOwnProperty(variable)) {
            // if (data[subjectNum].hasOwnProperty(variable) && this.tables.subjects[subjectNum].hasOwnProperty(variable)) {
                // console.log("original value of " + variable + " = " + this.tables.subjects[subjectNum][variable]);
                // console.log("new value will be = " + data[subjectNum][variable]);
                // assign the experimentData value to the subjects table
                this.tables.subjects[subjectNum][variable] = data[subjectNum][variable];
            }
        }

        nextStage = this.subjectStates[subjectNum].stageNum + 1;
        // set subjectStates[.].active to false and show waiting screen
        console.log("treatmentmgr.js[373] - setting subject " + subjectNum + " to not active");
        this.subjectStates[subjectNum].active = false;
        this.subjectStates[subjectNum].endStageTime = new Date().getTime();
        // console.log("line 294, time: " + new Date().getTime());
        this.subjectStates[subjectNum].time = Math.round((this.subjectStates[subjectNum].endStageTime - this.subjectStates[subjectNum].startStageTime) / 1000);

        // send the waiting screen
        this.clients[this.subjects[subjectNum]].conn.write(JSON.stringify({messageName: "update", html: this.stages[this.subjectStates[subjectNum].stageNum].waitingScreen(this.tables)}));

        var allWaiting = true;
        var thisSubjectStage = this.subjectStates[subjectNum].stageNum;
        var thisSubjectStageName = this.subjectStates[subjectNum].stageName;
        for (var i = 0; i < this.subjectStates.length; i++) {
            allWaiting = allWaiting && !this.subjectStates[i].active && this.subjectStates[i].stageNum == thisSubjectStage;
        }
        // if all are now false and on the same stage start the next stage for all 
        if (allWaiting) {
            last = true;
            // send user functions
            if (typeof this.userFcn.endStageEach !== 'undefined') {
                this.userFcn.endStageEach(this.tables, thisSubjectStageName, data[subjectNum], subjectNum);
            }
            if (typeof this.userFcn.endStage !== 'undefined') {
                this.userFcn.endStage(this.tables, thisSubjectStageName, data, subjectNum);
            }
            if (typeof this.userFcn.endStageLast !== 'undefined') {
                this.userFcn.endStageLast(this.tables, thisSubjectStageName, data[subjectNum], subjectNum);
            }

            // if this is the last stage do period end stuff
            if (nextStage === this.stages.length) {
                this.endPeriod();
            } else {
                // otherwise start the next stage
                for (var j = 0; j < this.subjectStates.length; j++) {
                    this.subjectStates[j] = 
                    {
                        subjectNum: j,
                        stageNum: nextStage, 
                        stageName: this.properties.stages[nextStage].name, 
                        active: true, 
                        period: this.currentPeriod,
                        timeout: (typeof this.properties.stages[nextStage].timeout !== "undefined") ? this.properties.stages[nextStage].timeout : 30,
                        startStageTime: new Date().getTime()
                    };
                    // console.log("line 337, getTime: " + new Date().getTime());
                    this.subjectStates[j].time = this.subjectStates[j].timeout;
                    // emit event signalling that clients table has been updated
                    this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
                }
                this.startStage();
            }
        } else {
            // not all subjects are waiting (or possibly on the same stage)
            if (this.firstToEnd[this.subjectStates[subjectNum].stageNum]===true) {
                this.firstToEnd[this.subjectStates[subjectNum].stageNum] = false;
                first = true;
            }
            // see if last should be called
            var last = true;
            var waitingSameStage;
            var laterStage;
            for (var i = 0; i < this.subjectStates.length; i++) {
                waitingSameStage = !this.subjectStates[i].active && this.subjectStates[i].stageNum === thisSubjectStage;
                laterStage = this.subjectStates[i].stageNum > thisSubjectStage;
                last = last && (waitingSameStage || laterStage);
            }

            // send user functions
            if (first && typeof this.userFcn.endStageFirst !== 'undefined') {
                this.userFcn.endStageFirst(this.tables, thisSubjectStageName, data[i], subjectNum);
            }
            if (typeof this.userFcn.endStageEach !== 'undefined') {
                this.userFcn.endStageEach(this.tables, thisSubjectStageName, data[i], subjectNum);
            }
            if (last) {
                if (typeof this.userFcn.endStage !== 'undefined') {
                    this.userFcn.endStage(this.tables, thisSubjectStageName, data, subjectNum);
                }
                if (typeof this.userFcn.endStageLast !== 'undefined') {
                    this.userFcn.endStageLast(this.tables, thisSubjectStageName, data[i], subjectNum);
                }
            }

            // see if the next stage has a waitForAll condition
            if (nextStage === this.stages.length || !(this.properties.stages[nextStage].waitForAll === false && typeof this.properties.stages[nextStage].waitForAll !== 'undefined')) {
                // keep waiting
                //clients[subjectNum].emit("update", {html: stages[subjectStates[subjectNum].stageNum].waitingScreen(tables)});

                // emit event signalling that clients table has been updated
                this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
            } else {
                // go to next stage
                this.subjectStates[subjectNum] = 
                {
                    stageNum: nextStage, 
                    stageName: this.properties.stages[nextStage].name, 
                    active: true, 
                    period: this.currentPeriod,
                    timeout: (typeof this.properties.stages[nextStage].timeout !== "undefined") ? this.properties.stages[nextStage].timeout : 30,
                    startStageTime: new Date().getTime()
                };
                // console.log("line 391, getTime: " + new Date().getTime());
                this.subjectStates[subjectNum].time = this.subjectStates[subjectNum].timeout;
                // emit event signalling that clients table has been updated
                this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});

                this.startStage(subjectNum);
            }

        }
        // emit event signalling that clients table has been updated
        this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
        // console.log("sent clientsTable update: " + JSON.stringify(this.tables));
    } else {
        // send all subjects to the next stage or end period
        // find the next stage
        nextStage = 0;
        for (var k = 0; k < this.subjectStates.length; k++) {
            if(this.subjectStates[k].stageNum >= nextStage) {
                nextStage = this.subjectStates[k].stageNum + 1;
            }
        }

        // in this case, don't call user functions (this endStage call is essentially killing the stage)

        if (nextStage = this.stages.length) {
            this.endPeriod();
        } else {
            for (var k = 0; k < this.subjectStates.length; k++) {
                this.subjectStates[k] = 
                {
                    subjectNum: k,
                    stageNum: nextStage, 
                    stageName: this.properties.stages[nextStage].name, 
                    active: true, 
                    period: this.currentPeriod,
                    timeout: (typeof this.properties.stages[nextStage].timeout !== "undefined") ? this.properties.stages[nextStage].timeout : 30,
                    startStageTime: new Date().getTime()
                };
                // console.log("line 424, getTime: " + new Date().getTime());
                this.subjectStates[k].time = this.subjectStates[k].timeout;
                // emit event signalling that clients table has been updated
                this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
                // show wait screen
                this.clients[this.subjects[k]].conn.write(JSON.stringify({messageName: "update", html: this.stages[this.subjectStates[k].stageNum].waitingScreen(this.tables)}));
            }
            this.startStage();
        }
    }
};

TreatmentManager.prototype.assignClient = function(clientNum, subjectNum) {
    this.subjects[subjectNum] = clientNum;  
}

/**
 * Initialize treatment variables
 * @param {Number} numClients This number should be the Math.floor(+clients/+groupSize)*+groupSize
 */
TreatmentManager.prototype.initializeTreatment = function(clients, connectedClients) 
{
    // setup firstToEnd
    for (var i = 0; i < this.properties.stages.length; i++) {
        this.firstToEnd[i] = true;
        this.numSubjectsStarted[i] = 0;
    }

    // only consider connected clients
    var numConnected = connectedClients;
    console.log("numConnected = " + connectedClients);
    // groupSize (default: subjects.length) otherwise make it the size of all clients
    this.groupSize = typeof this.properties.groupSize !== 'undefined' ? this.properties.groupSize : numConnected;
    console.log("groupSize = " + this.groupSize);
    this.numSubjects = Math.floor(numConnected / this.groupSize) * this.groupSize;
    console.log("numSubjects = " + this.numSubjects);
    // assign subjects a client id
    this.subjects = [];
    var client_id = 0;
    for (i = 0; i < this.numSubjects; i++) {
        while (clients[client_id].connected === false && typeof clients[client_id] !== 'undefined') {
            client_id++;
        }
        this.subjects[i] = client_id;  
        // lab.assignClient(client_id, this.properties.name, i);
        client_id++;
    }
    console.log("subjectAssignment: " + JSON.stringify(this.subjects));
    this.emit("subjectsAssigned", this.subjects);
    this.showUpFee = typeof this.showUpFee !== 'undefined' ? this.showUpFee : 0;

    // pull in old session data if it exists
    if (this.existingSessionData.length > 0) {
        this.tables.session = this.existingSessionData;
    } else {
        this.tables.session = [];
        for (var j = 0; j < this.numSubjects; j++) {
            this.tables.session[j] = {
                subject: j,
                finalProfit: 0,
                showUpFee: this.showUpFee,
                showUpFeeInvested: 0,
                moneyAdded: 0,
                moneyToPay: this.showUpFee,
                moneyEarned: this.showUpFee
            };
        }
    }

    // console.log("groupSize = " + groupSize); // PASS
    //  set frequently used prperties
    this.payingPeriods = this.properties.payingPeriods !== 'undefined' ? this.properties.payingPeriods : 1;
    this.practicePeriods = this.properties.practicePeriods !== 'undefined' ? this.properties.practicePeriods : 0;

    this.tables.globals = {
        period : 0,
        numPeriods : this.practicePeriods + this.payingPeriods,
        payingPeriods : this.payingPeriods,
        practicePeriods : this.practicePeriods,
        repeatTreatment : false,
        groupSize: this.groupSize,
        numGroups: Math.ceil(this.numSubjects / this.groupSize)
    };

    this.tables.subjects = [];
    for (var j = 0; j < this.numSubjects; j++) {
        this.tables.subjects[j] = {
            period: 0,
            subject: j,
            group: j % (this.numSubjects / this.groupSize),
            profit: 0,
            totalProfit: 0,
            participate: true,
            leaveStage: false
        };
    }
    console.log("finished initializing");
};

TreatmentManager.prototype.savePeriod = function() 
{
    this.log.push(JSON.parse(JSON.stringify(this.tables)));
};

TreatmentManager.prototype.startPeriod = function(period) 
{
    // reinitialize this.firstToEnd
    for (var i = 0; i < this.firstToEnd.length; i++) {
        this.firstToEnd[i] = true;
        this.numSubjectsStarted[i] = 0;
    }

    this.currentPeriod = period;
    this.tables.globals.period = period;
    this.tables.globals.repeatTreatment = false;
    for (var i = 0; i < this.tables.subjects.length; i++) {
        this.tables.subjects[i].period = period;
        this.tables.subjects[i].profit = 0;
    }
    // set the clientState to the first stage for all subjects
    for (var i = 0; i < this.subjectStates.length; i++) {
        this.subjectStates[i] = 
        {
            subjectNum: i,
            stageNum: 0, 
            stageName: this.properties.stages[0].name, 
            active: true, 
            period: period,
            timeout: (typeof this.properties.stages[0].timeout !== "undefined") ? this.properties.stages[0].timeout : 30,
            startStageTime: new Date().getTime()
        };
        // console.log("line 541, getTime: " + new Date().getTime());
        this.subjectStates[i].time = this.subjectStates[i].timeout;
    }
    // emit event signalling that clients table has been updated
    this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});

    if (typeof this.userFcn.beginPeriod !== 'undefined'){
        this.userFcn.beginPeriod(this.tables);
    }
    this.startStage();
};

TreatmentManager.prototype.initializeStage = function() 
{

};

TreatmentManager.prototype.endTreatment = function() 
{
    if (this.running === true) {

        // send all subjects the waiting screen
        for (var i = 0; i < this.subjectStates.length; i++) {
            console.log("treatmentmgr.js[665] - setting subject " + i + " to not active");
            this.subjectStates[i].active = false;
            this.subjectStates[i].endStageTime = new Date().getTime();
            this.subjectStates[i].time = Math.round((this.subjectStates[i].endStageTime - this.subjectStates[i].startStageTime) / 1000);
            // send the waiting screen
            this.clients[this.subjects[i]].conn.write(JSON.stringify({messageName: "update", html: this.stages[this.subjectStates[i].stageNum].waitingScreen(this.tables)}));
        }
        // emit event signalling that clients table has been updated
        this.emit("clientsTable", {subjectStates: this.subjectStates, tables: this.tables});
        // this is where I want to shoot out a log
        // save the log here 
        this.printLog();
        // TODO add totalProfit to session finalProfit
        this.emit("treatmentEnded",{session: this.tables.session});
        this.running = false;
    }
};

TreatmentManager.prototype.printLog = function() {
    var logString = "";
    var log = this.log;
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
    fs.writeFile(path.resolve(this.pathToTreatment, "../../logs/", path.basename(this.pathToTreatment) + "_" + Math.round(new Date().getTime() / 1000)  + ".csv"), logString, function (err) {
        if (err) { throw err; }
        console.log("log was saved.");
    });
};
