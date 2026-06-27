const http = require('http');
const crypto = require('crypto');
const secret = 'CodeForaEPTsCodeForaEPTsCodeForaEPTs';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({iss:'http://localhost:5000',aud:'http://localhost:3000',sub:'emr-eapts',exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000)})).toString('base64url');
const sig = crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
const token = header+'.'+payload+'.'+sig;

const body = JSON.stringify({
  prescriber: {
    firstName: "Test",
    middleName: "",
    lastName: "Doctor",
    qualification: "Doctor",
    registrationNumber: "",
    rowGuid: "00000000-0000-0000-0000-000000000001"
  },
  patient: {
    paymentTypeId: "00000000-0000-0000-0000-000000000000",
    sponsorName: "",
    patientTypeId: "00000000-0000-0000-0000-000000000000",
    firstName: "Test",
    middleName: "Patient",
    lastName: "User",
    phoneNumber: "1234567890",
    age: 25,
    ageType: "Years",
    weight: 0,
    sex: "Male",
    houseNumber: "",
    cardNumber: "124258",
    rowGuid: "a25ea84a-8d5f-4136-b700-f35530e929be",
    region: "",
    zone: "",
    woredaId: ""
  },
  prescriptionDetails: [{
    numberOfDuration: 5,
    administrationId: "01d045a0-adf0-4065-9f5d-4fdc65c3ea92",
    frequencyTypeId: "334ea16c-8a92-11e4-977f-0800271c1b75",
    itemUnitId: "cad1dc79-8d95-4179-bd6e-5a18a3c6a7ba",
    quantity: 15,
    orderNumber: 42,
    additionalNote: ""
  }],
  rowGuid: "d6463ea1-6c39-4abe-a6c8-865d61459e2e",
  institutionId: "8e8c620e-17ed-4a7c-ae91-a770d3ce2f8b",
  prescriptionDiagnosis: [],
  prescriptionDate: "2026-06-26T07:34:16.000Z"
});

const options = {
  hostname: 'host.docker.internal',
  port: 5133,
  path: '/api/Patient/EMRPrescription',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: 30000
};

console.log('POST /api/Patient/EMRPrescription');
console.log('Body:', body.substring(0, 200) + '...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});
req.on('error', (e) => { console.log('Error:', e.message); });
req.on('timeout', () => { console.log('TIMEOUT'); req.destroy(); });
req.write(body);
req.end();
