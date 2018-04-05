// =================================================================
// get the packages we need ========================================
// =================================================================
const express 	 = require('express');
const app        = express();              // express instance
const bodyParser = require('body-parser'); // middleware for parsing request bodies
const morgan     = require('morgan');      // request logger
const mongoose   = require('mongoose');    // Mongoose (MongoDB) database for storing users
const config     = require('./config');    // get our config file
const port = process.env.PORT || 8080;     // port to run server on

// connect to database
mongoose.Promise = global.Promise;
mongoose.connect(config.database, {
  useMongoClient: true

}).then(() =>
  console.log('Database connection successful!')

).catch((err) => console.error(err));

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// basic route (http://localhost:8080)
app.get('/', function(req, res) {
	res.send('Hello! The API is at http://localhost:' + port + '/api');
});

// require the api routes
app.use('/api', require('./app/routes/api'));

// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);
