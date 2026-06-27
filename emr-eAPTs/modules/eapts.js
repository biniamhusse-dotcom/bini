var request = require('requestretry');
const crypto = require('crypto');

function generateDaguToken() {
  const secret = 'CodeForaEPTsCodeForaEPTsCodeForaEPTs';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'http://localhost:5000',
    aud: 'http://localhost:3000',
    sub: 'emr-eapts',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}

function post(url, body) {
  var token = generateDaguToken();
  return new Promise(function (resolve, reject) {
    request({
      url: encodeURI(url),
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      json: true,
      body: body,
      maxAttempts: 5,
      retryDelay: 5000,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError
    }, function (err, response, body) {
      if (response) {
        return resolve({
          statusCode: response.statusCode,
          body: body
        });
      }
      if (err) {
        return reject(err)
      }
    });
  })
}

function get(url) {
  var token = generateDaguToken();
  return new Promise(function (resolve, reject) {
    request({
      url: encodeURI(url),
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      maxAttempts: 5,
      retryDelay: 5000,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError
    }, function (err, response, body) {
      if (response) {
        return resolve({
          statusCode: response.statusCode,
          body: body
        });
      }
      if (err) {
        return reject(err)
      }
    });
  })
}

module.exports.post = post
module.exports.get = get
