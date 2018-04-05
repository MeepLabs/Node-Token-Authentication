// =================================================================
// get the packages we need ========================================
// =================================================================
const express 	 = require('express');
const app        = express();
const bodyParser = require('body-parser');
const morgan     = require('morgan');
const mongoose   = require('mongoose');

const jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
const config = require('./config'); // get our config file
const User   = require('./app/models/user'); // get our mongoose model

// used to easily set password requirements
const passPolicy = require('password-sheriff').PasswordPolicy;
const charsets   = require('password-sheriff').charsets;

const argon2 = require('argon2'); // used to securely hash passwords

const client = require('redis').createClient(); // used to track rate limits

// =================================================================
// configuration ===================================================
// =================================================================
const port = process.env.PORT || 8080; // used to create, sign, and verify tokens

// connect to database
mongoose.Promise = global.Promise;
mongoose.connect(config.database, {
  useMongoClient: true

}).then(() =>
  console.log('Database connection successful!')

).catch((err) => console.error(err));

app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// =================================================================
// routes ==========================================================
// =================================================================
app.get('/setup', function(req, res) {

	// create a sample user
	const nick = new User({
		username: 'Nick Cerminara',
		password: 'password'
	});

	// save sample user to database
	nick.save(function(err) {
		if (err) throw err;

		res.status(200).json({
      success: true
		});
	});
});

// basic route (http://localhost:8080)
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// ---------------------------------------------------------
// get an instance of the router for api routes
// ---------------------------------------------------------
const apiRoutes = express.Router();

const limiter = require('express-limiter')(apiRoutes, client); // tell the rate limit plugin to handle apiRoutes route

// setup a rate limit for auth endpoints
let authLimit = limiter({
  path: '/authenticate',                       // use this on all endpoints
  total: 5,                                    // limit to 5 requests
  method: 'all',                               // POST, GET, etc.
  expire: 1000 * 60 * 5,                       // per 5 minutes
  lookup: 'connection.remoteAddress',          // based on client ip address
  onRateLimited: function (req, res, next) {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded'
    })
  }
});

// ---------------------------------------------------------
// create user (no middleware necessary since this isn't authenticated)
// ---------------------------------------------------------
// http://localhost:8080/api/create
apiRoutes.post('/create', authLimit, function(req, res) {

  // check if username already exists, if so return error
  User.findOne({ username: req.body.username }, function(err, user) {
    if (err) throw err;

    if (user) {
      res.status(403).json({
        success: false,
        message: 'Username already exists.'
      });

    } else { // if user doesn't exist

      // define password policy
      const policy = new passPolicy({
        length: {minLength: 6},
        identicalChars: {max: 3},
        contains: {
          expressions: [
            charsets.upperCase,
            charsets.numbers,
            charsets.specialCharacters
          ]
        }
      });

      // check if the password meets policy requirements
      if (!policy.check(req.body.password)) {

        // if not return error and exit function with return
        res.status(406).json({
          success: false,
          message: 'Invalid Password',
          policy: policy.explain()
        });

        return;
      }

      // after all checks, hash the password
      argon2.hash(req.body.password).then(hash => {

        // create new user object with hashed password
        const newUser = new User({
          username: req.body.username,
          password: hash
        });

        // save the new user object to the database
        newUser.save(function (err) {
          if (err) throw err;

          // return success message
          res.status(200).json({
            success: true
          });
        });

      }).catch(err => { // something went wrong hashing the password
        res.status(500).json({
          success: false,
          message: 'Cannot Create Account',
          exception: err.message
        });
      });
    }
  });
});

// ---------------------------------------------------------
// authentication (no middleware necessary since this isn't authenticated)
// ---------------------------------------------------------
// http://localhost:8080/api/authenticate
apiRoutes.post('/authenticate', authLimit, function(req, res) {

	// find the user
	User.findOne({ username: req.body.username }, function(err, user) {
		if (err) throw err;

		if (!user) {
			res.status(403).json({
        success: false,
        message: 'Authentication failed. User not found.'
			});

		} else if (user) {
      argon2.verify(user.password, req.body.password).then(match => {
        if (!match) {
          res.status(403).json({
            success: false,
            message: 'Authentication failed. Wrong password.'
          });

        } else {

          // if user is found and password is right
          // create a token
          const payload = {
            username: user.username
          };

          const token = jwt.sign(payload, app.get('superSecret'), {
            expiresIn: 86400 // expires in 24 hours
          });

          res.status(200).json({
            success: true,
            message: 'Enjoy your token!',
            token: token
          });
        }

      }).catch(err => {
        res.status(500).json({
          message: 'Unable to Login',
          exception: err.message
        });
      });
		}
	});
});

// ---------------------------------------------------------
// route middleware to authenticate and check token
// ---------------------------------------------------------
apiRoutes.use(function(req, res, next) {

	// check header or url parameters or post parameters for token
	const token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, app.get('superSecret'), function(err, decoded) {			
			if (err) {
				return res.status(403).json({
          success: false,
          message: 'Failed to authenticate token.'
				});

			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				next();
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({ 
			success: false, 
			message: 'No token provided.'
		});
	}
});

// ---------------------------------------------------------
// authenticated routes
// ---------------------------------------------------------
apiRoutes.get('/', function(req, res) {
	res.status(200).json({
    message: 'Welcome to the coolest API on earth!'
	});
});

// ---------------------------------------------------------
// example authenticated route
// ---------------------------------------------------------
apiRoutes.get('/users', function(req, res) {
	User.find({}, function(err, users) {
	  let retUsers = [];              // create array of usernames so we don't expose passwords
	  users.forEach(function(user) {  // loop through users in database
      retUsers.push(user.username); // add each username to array for returning
    });

		res.status(200).json(retUsers); // return the new array
	});
});

apiRoutes.get('/check', function(req, res) {
	res.status(200).json(req.decoded);
});

app.use('/api', apiRoutes);

// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);
