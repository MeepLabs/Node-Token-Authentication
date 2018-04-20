const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// set up a mongoose model
module.exports = mongoose.model('User', new Schema({
	email: String,
	username: String,
	password: String
}));