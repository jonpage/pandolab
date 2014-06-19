var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;

// this script will add the user specified below.

mongoose.connect('mongodb://labcurator:emptybeaker@mongo.onmodulus.net:27017/p5Yzejah');
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

// Seed a user
var User = mongoose.model('user', userSchema);

var usr = new User({ email: 'bob@example.com', password: 'secret' });
usr.save(function(err) {
    if(err) {
        console.log(err);
    } else {
        console.log('user: ' + usr.email + " saved.");
    }
});
