# PandoLab 
PandoLab is an online economic experiment manager with the underlying structure and terminology inspired by z-Tree. For more information on z-Tree see the [z-Tree Wiki](https://www.uzh.ch/iew/ztree/ssl-dir/wiki/) or the [z-Tree Home Page](http://www.iew.uzh.ch/ztree/).

# Setup
The online PandoLab application is hosted on [Modulus](https://modulus.io/). So, if you are using a different environment you will need to make a few changes to the code.

In `app.js` change the value of `user_prefix` (line 20) to the location you will keep user files for your distribution. Change the properties of `smtpTransport` (lines 33 - 39) to match your SMTP configuration. Change the MongoDB URL (line 47). Finally, replace `process.env.PORT` (line 570) with the desired port.
