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

const OPENMRS_BASE = 'http://openmrs:8080/openmrs/ws/rest/v1';

const PAYMENT_METHOD_UUID = '59a708fa-6df6-40ba-a375-9f26d0264fe5';
const CREDIT_TYPE_UUID = 'a6ad7613-8c78-4d12-b04e-050a208279f3';

const PAYMENT_UUID = {
  cbhi: '390c4b8b-d206-4a9d-9162-e59ffa183440',
  credit: 'f72199ee-509f-4087-88cd-c743052b3bae',
  cash: 'b25e8721-4d82-49e7-8c4e-0b6667eab8aa',
  free: '4a9afabb-f066-4267-a943-e489409368f3',
};

const DEFAULT_PAYMENT_UUID = PAYMENT_UUID.free;

async function getPatientPaymentType(personUuid) {
  try {
    const response = await get(`${OPENMRS_BASE}/person/${personUuid}?v=full`);
    if (!response.body) return { paymentTypeUuid: DEFAULT_PAYMENT_UUID, sponsorId: null, insuranceNumber: '' };
    const person = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    const attrs = person.attributes || [];
    if (!attrs.length) return { paymentTypeUuid: DEFAULT_PAYMENT_UUID, sponsorId: null, insuranceNumber: '' };

    let paymentMethod = null;
    let creditType = null;
    let creditCompanyDisplay = null;
    let creditCompanyUuid = null;
    let referenceNumber = '';

    for (const attr of attrs) {
      const typeName = attr.attributeType && attr.attributeType.display;
      const valDisplay = attr.value && typeof attr.value === 'object' ? attr.value.display : attr.value;
      if (typeName === 'PaymentMethod') paymentMethod = valDisplay;
      if (typeName === 'CreditType') creditType = valDisplay;
      if (typeName === 'CreditCompany') {
        creditCompanyDisplay = valDisplay;
        creditCompanyUuid = attr.value && typeof attr.value === 'object' ? attr.value.uuid : null;
      }
      if (typeName === 'Reference Number') referenceNumber = valDisplay || '';
    }

    console.log('Billing info: method=' + paymentMethod + ', creditType=' + creditType + ', company=' + creditCompanyDisplay + ', refNo=' + referenceNumber);

    let paymentTypeUuid = DEFAULT_PAYMENT_UUID;
    if (paymentMethod === 'Credit' && creditType === 'CBHI') paymentTypeUuid = PAYMENT_UUID.cbhi;
    else if (paymentMethod === 'Credit') paymentTypeUuid = PAYMENT_UUID.credit;
    else if (paymentMethod === 'Cash') paymentTypeUuid = PAYMENT_UUID.cash;
    else if (paymentMethod === 'Free') paymentTypeUuid = PAYMENT_UUID.free;

    return { paymentTypeUuid, creditCompanyUuid, referenceNumber };
  } catch (err) {
    console.log('Failed to fetch patient billing info: ' + err.message);
    return { paymentTypeUuid: DEFAULT_PAYMENT_UUID, creditCompanyUuid: null, referenceNumber: '' };
  }
}

module.exports.get = get
module.exports.post = post
module.exports.postFile = postFile
module.exports.getPatientPaymentType = getPatientPaymentType