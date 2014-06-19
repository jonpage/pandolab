var express = require('express')
  , RedisStore = require('connect-redis')(express)
  , sessionStore = new RedisStore()
  , http = require('http')
  , fs = require('fs')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , mongodb = require('mongodb')
  , path = require('path')
  , nodemailer = require('nodemailer')
  , mongoose = require('mongoose')
  , bcrypt = require('bcrypt')
  , SALT_WORK_FACTOR = 10;
  
var LabSession = require('./labsession.js');
var AdmZip = require('adm-zip');

var activeSessions = {};

var user_prefix = process.env.CLOUD_DIR + "/users/";
fs.exists(user_prefix, function(exists) { 
    if (!exists) {
        fs.mkdir(user_prefix, function(err) {
            if (err) { throw(err); }
        });
    }
 
});
/*
 * Mailer setup
 */
var smtpTransport = nodemailer.createTransport("SMTP", {
    host: "host.net",
    port: 468,
    secureConnection: true,
    auth: {
        user: "user@site.com",
        pass: "password"
    },
    // debug: true
});

/*
 * Database setup
 */
//mongoose.connect('localhost', 'test');
mongoose.connect('mongodb://username:password@mongo.domain.net');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
  console.log('Connected to DB');
});

// User Schema
var userSchema = mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true},
  accessToken: { type: String } // Used for Remember Me
});

// Bcrypt middleware
userSchema.pre('save', function(next) {
	var user = this;

	if(!user.isModified('password')) {return next();}

	bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
		if(err) {return next(err);}

		bcrypt.hash(user.password, salt, function(err, hash) {
			if(err) {return next(err);}
			user.password = hash;
			next();
		});
	});
});

// Password verification
userSchema.methods.comparePassword = function(candidatePassword, cb) {
    // console.log("attempting to compare password");
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
		if(err) {return cb(err);}
		cb(null, isMatch);
	});
};

// Remember Me implementation helper method
userSchema.methods.generateRandomToken = function () {
  var user = this,
      chars = "_!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      token = new Date().getTime() + '_';
  for ( var x = 0; x < 16; x++ ) {
    var i = Math.floor( Math.random() * 62 );
    token += chars.charAt( i );
  }
  return token;
};

// Seed a user
var User = mongoose.model('user', userSchema);

// test connection to db
// User.find({email: /jon/}, function(err, docs) {
//     if (err) { throw(err); }
//     console.log(JSON.stringify(docs));
// });

// var usr = new User({ email: 'bob@example.com', password: 'secret' });
// usr.save(function(err) {
//   if(err) {
//     console.log(err);
//   } else {
//     console.log('user: ' + usr.email + " saved.");
//   }
// });


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
//
//   Both serializer and deserializer edited for Remember Me functionality
// passport.serializeUser(function(user, done) {
//   var createAccessToken = function () {
//     var token = user.generateRandomToken();
//     User.findOne( { accessToken: token }, function (err, existingUser) {
//       if (err) { return done( err ); }
//       if (existingUser) {
//         createAccessToken(); // Run the function again - the token has to be unique!
//       } else {
//         user.set('accessToken', token);
//         user.save( function (err) {
//           if (err) return done(err);
//           return done(null, user.get('accessToken'));
//         })
//       }
//     });
//   };
// 
//   if ( user._id ) {
//     createAccessToken();
//   }
// });
// 
// passport.deserializeUser(function(token, done) {
//   User.findOne( {accessToken: token } , function (err, user) {
//     done(err, user);
//   });
// });

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy({usernameField: 'email'}, function(username, password, done) {
  User.findOne({ email: username }, function(err, user) {
    if (err) { return done(err); }
    if (!user) { 
        // console.log("could not find username.");
        return done(null, false, { message: 'Unknown user ' + username }); 
    } else {
        // console.log("found username: " + username);
    }
    user.comparePassword(password, function(err, isMatch) {
      if (err) {
          // console.log("comparePassword error");
          return done(err);
      }
      if(isMatch) {
        // console.log("Valid password");
        return done(null, user);
      } else {
        // console.log("Invalid password");
        return done(null, false, { message: 'Invalid password' });
      }
    });
  });
}));


var app = express();
var server = http.createServer(app);

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  // app.use(express.session({ secret: 'chitty chitty', store: sessionStore, key: 'hello.sid'})); // CHANGE THIS SECRET!
  app.use(express.cookieSession({secret: 'chitty chitty'}));
  // Remember Me middleware
  // app.use( function (req, res, next) {
  //   if ( req.method == 'POST' && req.url == '/' ) {
  //     if ( req.body.rememberme ) {
  //       req.session.cookie.maxAge = 2592000000; // 30*24*60*60*1000 Rememeber 'me' for 30 days
  //     } else {
  //       req.session.cookie.expires = false;
  //     }
  //   }
  //   next();
  // });
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


app.get('/', function(req, res){
  // res.render('login', { user: req.user, message: req.session.messages });
    if (req.isAuthenticated()) {
        res.redirect('/manager');
    } else {
        res.sendfile(__dirname + '/login.html', function (err) {if(err) {throw(err);}});
    }
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.post('/change-pwd', ensureAuthenticated, function(req, res) {
    // change password
    // first check to see if the user already exists, in which case, just change the password
    console.log("trying to change password");
    User.findOne({email: req.user.email}, function(err, existingUser){
        if (err) {throw err;}
        if (existingUser) {
            existingUser.set({password: req.body['new-password-1']});
            existingUser.save(function(err){
                if (err) {throw err;} else {
                    console.log("password changed successfully to " + req.body['new-password-1']);
                }
            });
        } else {
            console.log("Attempted to change the password for " + req.user.email + ", but this user doesn't exist.");
        }
    });
    res.redirect('/manager');
});

app.post('/forgot-pwd', function(req, res){
    // reset the password and redirect
    console.log("reset password for: " + req.body.email);

    User.findOne({email: req.body.email}, function(err, existingUser){
        if (err) {throw err;}
        if (existingUser) {
            var newPassword = "";
            var chars = "abcdefghijkmnpqrstuvwxyz23456789";
            for ( var x = 0; x < 10; x++ ) {
                var i = Math.floor( Math.random() * 32 );
                newPassword += chars.charAt( i );
            }

            existingUser.set({password: newPassword});
            existingUser.save(function(err){
                if (err) {throw err;} else {
                    // email newPassword to user
                    var mailOptions = {
                        from: "PandoLab Admin <admin@pandolab.com>",
                        to: req.body.email,
                        subject: "Password Reset - PandoLab.com",
                        text: "Your password has been reset. Your new password is " + newPassword + ". You may change this once you have logged in.\n\n- Pando Lab Admin (admin@pandolab.com)",
                        html: "<h1>Password Reset - PandoLab.com</h1> <p>Your password has been reset. Your new password is <strong>" + newPassword + "</strong>. You may change this once you have logged in.</p> - Pando Lab Admin (<a href='mailto:admin@pandolab.com'>admin@pandolab.com</a>)"
                    };
                    smtpTransport.sendMail(mailOptions, function(error, response) {
                        if(error) {
                            console.log(error);
                        } else {
                            console.log("Message sent: " + response.message);
                        }
                    });
                }
            });


        } else {
            // TODO change the message the user receives.
            console.log("Requested password reset for " + req.body.email + ", but this user doesn't exist.");
        }
    });

    fs.readFile(__dirname + '/pwd-reset.html',
                function (err, data) {
                    if (err) {
                        res.writeHead(500);
                        return res.end('Error loading pwd-reset.html');
                    }
                    res.send(data.toString().replace("EMAIL-ADDRESS", req.body.email));
                });
});

app.get('/new-lab', ensureAuthenticated, function(req, res) {
    // first check to see if there is a running experiment
    if (typeof activeSessions[req.user.email].lab !== 'undefined' && activeSessions[req.user.email].lab.isRunning() === true) {
    // console.log("running=yes: " + JSON.stringify(activeSessions[req.user.email]));
    } else {
        // destroy activeSession for this user
        // console.log("isRunning: " + activeSessions[req.user.email].lab.isRunning());
        // console.log("running?: " + JSON.stringify(activeSessions[req.user.email]));
        if (typeof activeSessions[req.user.email].lab !== 'undefined') {
            activeSessions[req.user.email].lab.close();
        }
        delete activeSessions[req.user.email];
    }
    // redirect to manager
    res.redirect('/manager');
});

app.get('/help', ensureAuthenticated, function(req, res) {
    fs.readFile(__dirname + '/help.html',
        function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading help.html');
        }
        res.send(data.toString().replace("EMAIL-ADDRESS",req.user.email));
    });
});

app.get('/about', function(req, res) {
    fs.readFile(__dirname + '/about.html',
        function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading about.html');
        }
        res.send(data.toString());
    });
});

app.get('/logs', ensureAuthenticated, function(req, res) {

    fs.readFile(__dirname + '/log.html',
        function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading log.html');
        }
        // fs.readdir(__dirname + "/users/" + req.user.email.replace(/[\.@]/g, "_") + "/logs/", function(err, files){
        fs.readdir(user_prefix + req.user.email.replace(/[\.@]/g, "_") + "/logs/", function(err, files){
            if (err) { throw(err); }
            var content = "";
            for (var i = 0; i < files.length; i++) {
                if (files[i].indexOf(".csv") > -1) {
                    content += "<li class='list-group-item'><a href='/logs/" + files[i] + "'>" + files[i] + "</a></li>";
                }
            }
            res.send(data.toString().replace("CONTENT", content).replace("EMAIL-ADDRESS",req.user.email));
        });
    });
});

// download function for example zip's
app.get(/(\/examples\/[a-zA-Z_0-9]+\.zip)$/, ensureAuthenticated, function(req, res) {
    res.download(__dirname + req.params[0]);
});

// requests to download csv's
// this makes sure to only load logs in the users folder on the server
app.get(/logs\/([a-zA-Z_0-9]+\.csv)$/, ensureAuthenticated, function(req, res) {
    // var logPath = __dirname + "/users/" + req.user.email.replace(/[\.@]/g, "_") + "/logs/";
    var logPath = user_prefix + req.user.email.replace(/[\.@]/g, "_") + "/logs/";
    fs.readdir(logPath, function(err, files){
        if (err) { throw(err); }
            for (var i = 0; i < files.length; i++) {
                if (req.params[0] === files[i]) {
                    res.download(logPath + files[i]);
                }
            }
    });
});

app.get('/manager', ensureAuthenticated, function(req, res){
    // console.log("authenticated request for /manager");
    var shortCode = "conn";
    // If the user already has a live lab session, send the lab updates to the manager's view
    // Else: create a new LabSession object, assign a shortCode and connect the labsession to the manager's view
    // That is, at this point, make sure the user receives the manager shell with the correct shortCode (i.e., connection url)
    if (activeSessions.hasOwnProperty(req.user.email)) {
        // send user the current lab view
        shortCode = activeSessions[req.user.email].shortCode;
    } else {
        // create shortCode
        var chars = "2345679abcdefghjkmnpqrstuvwxyz";
        shortCode = "";
        for (var i = 0; i < 6; i++) {
            shortCode += chars.charAt(Math.floor(Math.random() * 31));
        }

        // var folder = __dirname + "/users/" + req.user.email.replace(/[\.@]/g, "_") + "/";
        var folder = user_prefix + req.user.email.replace(/[\.@]/g, "_") + "/";
        fs.exists(folder, function(outsideExists) {
            fs.exists(folder + "treatments/", function(insideExists) {
                if (!outsideExists) {
                    fs.mkdir(folder, function(err) {
                        if (err) { throw(err); }
                        fs.mkdir(folder + "treatments/", function(err) {
                            if (err) { throw(err); }
                            // create LabSession
                            lab = new LabSession(folder + "treatments/", shortCode, app, server);
                            // set the activeSessions entry
                            activeSessions[req.user.email] = {shortCode: shortCode, lab: lab};
                            fs.mkdir(folder + "logs/", function(err) {
                                if (err) { throw(err); }
                            });
                        });
                    });
                } else {
                    if (!insideExists) {
                        fs.mkdir(folder + "treatments/", function(err) {
                            if (err) { throw(err); }
                            // create LabSession
                            var lab = new LabSession(folder + "treatments/", shortCode, app, server);
                            // set the activeSessions entry
                            activeSessions[req.user.email] = {shortCode: shortCode, lab: lab};
                            fs.mkdir(folder + "logs/", function(err) {
                                if (err) { throw(err); }
                            });
                        });
                    } else {
                    // create LabSession
                    var lab = new LabSession(folder + "treatments/", shortCode, app, server);
                    // set the activeSessions entry
                    activeSessions[req.user.email] = {shortCode: shortCode, lab: lab};
                    }
                }
            });
        });

    }
    fs.readFile(__dirname + '/mgr_shell.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading shell.html');
            }
            res.send(data.toString().replace("shortCode", shortCode).replace("EMAIL-ADDRESS", req.user.email));
            // res.send(data.toString());
        });
    // res.render('manager', { user: req.user });
});


// POST /login
//   This is an alternative implementation that uses a custom callback to
//   acheive the same functionality.
app.post('/', function(req, res, next) {
    // console.log("attempting to log user in");
  passport.authenticate('local', function(err, user, info) {
      // console.log("logged in user: " + user);
    if (err) { return next(err) }
    if (!user) {
      req.session.messages =  [info.message];
      return res.redirect('/')
    }
    req.logIn(user, function(err) {
      if (err) { 
          // console.log("error with req.logIn()");
          return next(err); 
      }
      // create new shortcode (6-digit alphanumeric (use mongoose to make sure this is unique))
      // -> actually, not a good idea to force new code on login. leave a button for the user.
      // console.log("try to send to manager");
      return res.redirect('/manager');
    });
  })(req, res, next);
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.post('/delete-treatment', ensureAuthenticated, function(req, res) {
    console.log("deleting treatment ");
});

app.post('/upload-zip', ensureAuthenticated, function(req, res) {
    console.log("size: " + JSON.stringify(req.files.files[0].size));
    console.log("path: " + JSON.stringify(req.files.files[0].path));
    console.log("name: " + JSON.stringify(req.files.files[0].name));
    console.log("type: " + JSON.stringify(req.files.files[0].type));
    console.log("user email: " + req.user.email);
    var file = req.files.files[0];
    // check that the file type is a zip
    if(file.type === "application/zip") {
        console.log("this is a zip");
        var dirName = file.name.replace(/\.zip$/, "");
        var zip = new AdmZip(file.path);
        var zipEntries = zip.getEntries(); // an array of ZipEntry records
        var zipPath = "";

        zipEntries.forEach(function(zipEntry) {
            console.log("name: " + zipEntry.name);
            console.log("entryName: " + zipEntry.entryName);
            
            if (zipEntry.name === "treatment.json") {
                zipPath = zipEntry.entryName.replace(zipEntry.name, "");
                console.log("Found treatment.json at " + zipPath); 
            }
        });
        // now zipPath contains the path to extract
        // see if the proposed dirName is available
        var userFolder = req.user.email.replace(/[\.@]/g, "_");
        // fs.readdir(__dirname + "/users/" + userFolder + "/treatments/", function(err, files){
        fs.readdir(user_prefix + userFolder + "/treatments/", function(err, files){
            console.log(files);
            if (err) { throw(err); }
            var dirNameUnique = false;
            while (dirNameUnique === false) {
                dirNameUnique = true;
                for (var i = 0; i < files.length; i++) {
                    if (dirName === files[i]) {
                        dirNameUnique = false;
                        dirName += "x";
                    }
                }
            }
            // now dirName is unique, time to unzip to the unique directory
            // var targetPath = __dirname + "/users/" + userFolder + "/treatments/" + dirName;
            var targetPath = user_prefix + userFolder + "/treatments/" + dirName;
            fs.mkdir(targetPath, function(err){
                if(err) { throw(err); }
                // extract to the the new directory
                if (zipPath.length === 0) {
                    zip.extractAllTo(targetPath);
                    // add the newly add dirName to availableTreatments in lab
                    res.send({nested: false, files: files});
                } else {
                    zip.extractEntryTo(zipPath, targetPath);
                    // add the newly add dirName to availableTreatments in lab
                    res.send({nested: true, files: files});
                }
                // TODO rezip the file for future downloads
            });

        })
    } else {
        console.log("this is not a zip");
        // TODO send user note that this is not the right file type
    }
    // check for a treatment.json
    // check for nested treatments
    // copy to this user's folder and reload the available treatments list.
});

// this listening port should be process.env.PORT on production
server.listen(process.env.PORT, function() {
  console.log('Express server listening on port' + process.env.PORT);
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/')
}
