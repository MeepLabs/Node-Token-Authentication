# Node Token Authentication

This repo uses JSON Web Tokens and the [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) package to implement token based authentication on a simple Node.js API.

This is a starting point to demonstrate the method of authentication by verifying a token using Express route middleware.

## Requirements

`node` and `npm` check versions with `node -v && npm -v`

[Redis](https://redis.io/topics/quickstart) needs to be installed on your local system for testing.

macOS users may need to install some [prerequisite packages](https://www.npmjs.com/package/node-gyp) such as the XCode Command Line Tools

Windows users need to install some extra packages to build argon2:

`npm install --global --production windows-build-tools`

`npm install -g node-gyp`

## Usage

1. Clone the repo: `git clone https://github.com/Cryptobyte/node-token-authentication.git`
2. Install dependencies: `npm install`
3. Change `secret` in `config.example.js` to something random
4. Change `database` in `config.example.js` to your [connection string](https://docs.mongodb.com/manual/reference/connection-string/)
5. Rename `config.example.js` to `config.js`
6. Start the server: `npm start`
7. Your API will be available at: `http://localhost:8080/api`

Once everything is set up, we can begin to use our app by creating and verifying tokens.

### Testing the API

The easiest way to test any REST API is with [Postman](https://www.getpostman.com/) but you can also use `curl`
This repository includes a [Postman collection](tests/node-token-authentication.postman_collection.json) that you can import into Postman for testing.

### Creating a User

Send a `POST` request to `http://localhost:8080/api/authenticate` with test user parameters as `x-www-form-urlencoded`. 

```
{
  username: 'username-here',
  password: 'password-here'
}
```

Curl example: `curl -d '{"username":"username-here", "password":"password-here"}' -H "Content-Type: application/x-www-form-urlencoded" -X POST http://localhost:8080/api/create`

### Getting a Token

Send a `POST` request to `http://localhost:8080/api/authenticate` with test user parameters as `x-www-form-urlencoded`. 

```
{
  username: 'username-here',
  password: 'password-here'
}
```

Curl example: `curl -d '{"username":"username-here", "password":"password-here"}' -H "Content-Type: application/x-www-form-urlencoded" -X POST http://localhost:8080/api/authenticate`

### Verifying a Token and Listing Users

Send a `GET` request to `http://localhost:8080/api/users` with a header parameter of `x-access-token` and the token.

You can also send the token as a URL parameter: `http://localhost:8080/api/users?token=YOUR_TOKEN_HERE`

Or you can send the token as a POST parameter of `token`.
