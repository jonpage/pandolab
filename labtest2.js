var LabSession = require('./labsession.js');
var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').createServer(app);

var shortCode = "b3hjjk";

var lab = new LabSession(__dirname + "/treatments/", shortCode, app, server);

app.configure(function() {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.engine('ejs', require('ejs-locals'));
});
// set the public directory as available to loaded content.
app.use(express.static('public'));

app.get('/manager', function (req, res) {
    fs.readFile(__dirname + '/mgr_shell.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading shell.html');
            }
            res.send(data.toString().replace('manager/conn', 'manager/'+shortCode));
        });
});

server.listen(3000);
