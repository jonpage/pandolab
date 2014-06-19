/**
 * Module dependencies
 */
var EventEmitter = require("events").EventEmitter;
var sockjs = require('sockjs');
var rbytes = require('rbytes');

/**
 * Module exports.
 */

exports = module.exports = LabManager;

// array of clients indexed by their arrival to the array (TODO: include the room name)
var labOpen = false;
var connections = [];

/**
 * LabManager constructor
 * @param {String} labCode This string indicates the path of the lab (e.g., "/subject/d12jel")
 */
function LabManager(opts, server, labCode, maxClients) {
    var self = this;
    self.clients = [];

    // setup 
    self.sock = sockjs.createServer(opts);

    // a negative value indicates no limit
    if(typeof maxClients === "undefined"){
        maxClients = -1;
    }

    labOpen = true;

    // connection listener for SockJS server (need to set the prefix for this one to /subject)
    self.sock.on("connection", function(conn) {
        connections.push(conn);
        var this_client;
        console.log("subject connected");
        conn.on('close', function() {
            if (typeof self.clients[this_client] !== 'undefined') {
                self.clients[this_client].connected = false;
            }
            console.log("client " + this_client + " disconnected");
            self.emit("lostClient", this_client);
        });
        conn.on('data', function(m) {
            console.log("data received from subject");
            console.log("[.] message: " + m);
            // make sure m is defined
            if (typeof m !== 'undefined') {
                var data = JSON.parse(m);
                console.log("m.data = " + m.data);
                switch (data.messageName) {
                    case 'old_socket':
                        var uuid = rbytes.randomBytes(16).toHex();
                        var old_client = false;
                        if (data.id) {
                            console.log("old connection: " + data.id);
                            // see if the old connection was in the list of clients
                            for (var i = 0; i < self.clients.length; i++) {
                                if (self.clients[i].id == data.id) {
                                    old_client = i;
                                }
                            }
                        } else {
                            console.log("no old client to test.");
                        }
                        if (old_client !== false) {
                            self.clients[old_client].id = uuid;
                            self.clients[old_client].conn = conn;
                            self.clients[old_client].connected = true;
                            this_client = old_client;
                            console.log("reconnected client: " + this_client);
                            self.emit("reconnectedClient", this_client);
                            conn.write(JSON.stringify({messageName: 'newID', id: uuid}));
                        } else {
                            // only add a client if they are new and there is room || there is no limit
                            if (self.clients.length < maxClients || maxClients < 0) {
                                this_client = self.clients.push({id: uuid, conn: conn, connected: true}) - 1;
                                console.log("added client.");
                                self.emit("addClient", this_client);
                                conn.write(JSON.stringify({messageName: 'newID', id: uuid}));
                            } else {
                                console.log("rejected, too many clients");
                            }
                        }
                        break;
                    case 'endStage':
                        self.emit('endStage', {id: this_client, experimentData: data.experimentData}); 
                        break;
                    case 'updateData':
                        self.emit('updateData', {id: this_client, command: data.command, experimentData: data.experimentData});
                    default:
                        break;
                }
            }
        });
    
    });
    if (typeof labCode === 'undefined') {
        labCode = '/subject/conn';
    } else {
        labCode = '/subject/' + labCode;
    }
    self.sock.installHandlers(server, {prefix:labCode});

}

// returns the number of the clients that are still connected
LabManager.prototype.connectedClients = function() {
    var connectedClients = 0;
    for (var i = 0; i < this.clients.length; i++) {
        if (this.clients[i].connected === true) {
            connectedClients++;
        }
    }
    return connectedClients;
}

/**
 * Inherits from EventEmitter.
 */

LabManager.prototype.__proto__ = EventEmitter.prototype;

LabManager.prototype.clientList = this.clients;

LabManager.prototype.logger = function() 
{
    //if (typeof string === "undefined"){
    console.log("Testing LabManager object!");
    //} else {
    //	console.log(string);
    //}
};

/**
 * Getter for the clients hash
 * @return {[type]} [description]
 */
// LabManager.prototype.__defineGetter__('clients', function () {
//     return this.clients;
// });

// assigns a treatment and subject number to a given client
LabManager.prototype.assignClients = function(subject2client) 
{
    // reset all subjectNums to false
    for (var i = 0; i < this.clients.length; i++) {
        this.clients[i].subjectNum = false;
    }
    // set subjectNum based on subject2client array
    for (i = 0; i < subject2client.length; i++) {
        this.clients[subject2client[i]].subjectNum = i;
    }
};

LabManager.prototype.assignClient = function(clientNum, subjectNum) 
{
    // remove subjectNum from old client
    for (var i = 0; i < this.clients.length; i++) {
        if (this.clients[i].subjectNum === subjectNum) {
            this.clients[i].subjectNum = false;
        }
    }
    // add subjectNum to new client
    this.clients[clientNum].subjectNum = subjectNum;
}

LabManager.prototype.dropClient = function(clientNum) 
{
    delete this.clients[clientNum].subjectNum;
};

LabManager.prototype.lock = function()
{
    labOpen = false;
    // lock the door (i.e. keep new clients from adding)
};

LabManager.prototype.close = function()
{
    // end all socket connections
    for (var i = 0; i < connections.length; i++) {
        if (typeof connections[i].end !== 'undefined') {
            connections[i].end();
        }
    }
    // // reset client list
    this.clients = [];
}
