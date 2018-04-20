const express = require('express');
const router = express.Router();
const jwt    = require('jsonwebtoken');                        // used to create, sign, and verify tokens
const User   = require('../models/user');                      // get our mongoose model
const passPolicy = require('password-sheriff').PasswordPolicy; // used to easily set password requirements
const charsets   = require('password-sheriff').charsets;
const argon2 = require('argon2');                              // used to securely hash passwords
const client = require('redis').createClient();                // used to track rate limits
const limiter = require('express-limiter')(router, client);    // tell the rate limit plugin to handle apiRoutes route
const config = require('../../config');                        // get our config file
const secret = config.secret;

// setup a rate limit for auth endpoints
let authLimit = limiter({
  path: '*',                                   // use this on all endpoints
  total: 15,                                   // limit to 15 requests
  method: 'post',                              // only limit post requests
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
router.post('/create', authLimit, function(req, res) {

  // check if username already exists, if so return error
  User.findOne({ username: req.body.username }, function(err, user) {
    if (err) throw err;

    // check for required information
    if ((!req.body.username) || (req.body.password) || (req.body.email)) {
      res.status(403).json({
        success: false,
        message: 'Missing required information'
      });

      return;
    }

    if (user) {
      res.status(403).json({
        success: false,
        message: 'Username already exists.'
      });

    } else { // if user doesn't exist

      // define password policy
      const policy = new passPolicy({
        length: { minLength: 6 },
        identicalChars: { max: 3 },
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
          email: req.body.email,
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
router.post('/authenticate', authLimit, function(req, res) {

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

          const token = jwt.sign(payload, secret, {
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

router.post('resetEmail', authLimit, function(req, res) {

});

router.post('reset2fa', authLimit, function (req, res) {

});

// ---------------------------------------------------------
// route middleware to authenticate and check token
// ---------------------------------------------------------
router.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  const token = req.body.token || req.query['token'] || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, secret, function(err, decoded) {
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
// example authenticated route
// ---------------------------------------------------------
// http://localhost:8080/api/users
router.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    let retUsers = [];              // create array of usernames so we don't expose passwords
    users.forEach(function(user) {  // loop through users in database
      retUsers.push(user.username); // add each username to array for returning
    });

    res.status(200).json(retUsers); // return the new array
  });
});

// ---------------------------------------------------------
// example authenticated route
// ---------------------------------------------------------
router.get('/', function(req, res) {
  res.status(200).json({
    message: 'Welcome to the coolest API on earth!'
  });
});

module.exports = router;