var request = require('requestretry');
const fs = require('fs');
const path = require('path');

function post(url, body) {
  var auth = 'Basic ' + Buffer.from(process.env.EMRUserName + ':' + process.env.EMRPassword).toString('base64');

  return new Promise(function (resolve, reject) {
    request({
      url: encodeURI(url),
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
      json: true,
      body: body,

      // The below parameters are specific to request-retry
      maxAttempts: 5,   // (default) try 5 times
      retryDelay: 5000,  // (default) wait for 5s before trying again
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError // (default) retry on 5xx or network errors
    }, function (err, response, body) {
      if (response) {
        return resolve({
          statusCode: response.statusCode,
          body: body,
          cookie: response.headers['set-cookie']
        });
      }
      if (err) {
        return reject(err)
      }
    });
  })
}

function postFile(url, cookie) {
  const fileStream = fs.createReadStream(path.resolve(__dirname, "../AddressLog/addressHierarchy.csv"));
  return new Promise(function (resolve, reject) {
    request({
      url: encodeURI(url),
      method: "POST",
      followAllRedirects: true, // Enable following all redirects
      headers: {
        'Content-Type': 'multipart/form-data',
        'Cookie': cookie,

      },
      formData: {
        file: fileStream,
        delimiter: ',',
        userGeneratedIdDelimiter: '>'
      },

      // The below parameters are specific to request-retry
      maxAttempts: 5,   // (default) try 5 times
      retryDelay: 5000,  // (default) wait for 5s before trying again
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError // (default) retry on 5xx or network errors
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
  var auth = 'Basic ' + Buffer.from(process.env.EMRUserName + ':' + process.env.EMRPassword).toString('base64');
  return new Promise(function (resolve, reject) {
    request({
      url: encodeURI(url),
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },

      // The below parameters are specific to request-retry
      maxAttempts: 5,   // (default) try 5 times
      retryDelay: 5000,  // (default) wait for 5s before trying again
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError // (default) retry on 5xx or network errors
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

module.exports.get = get
module.exports.post = post
module.exports.postFile = postFile