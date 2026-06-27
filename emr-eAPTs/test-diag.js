const http = require('http');
const crypto = require('crypto');
const secret = 'CodeForaEPTsCodeForaEPTsCodeForaEPTs';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({iss:'http://localhost:5000',aud:'http://localhost:3000',sub:'emr-eapts',exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000)})).toString('base64url');
const sig = crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
const token = header+'.'+payload+'.'+sig;

function get(path) {
  return new Promise((resolve) => {
    const opts = {hostname:'host.docker.internal', port:5133, path, method:'GET', headers:{'Authorization':'Bearer '+token,'Accept':'application/json'}, timeout:10000};
    const req = http.request(opts, res => { 
      let d=''; 
      res.on('data',c=>d+=c); 
      resolve({status:res.statusCode, body:d});
    });
    req.on('error', e => resolve({error:e.message}));
    req.end();
  });
}

function post(path, body) {
  return new Promise((resolve) => {
    const b = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {hostname:'host.docker.internal', port:5133, path, method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'Content-Length':Buffer.byteLength(b)}, timeout:15000};
    const req = http.request(opts, res => { 
      let d=''; 
      res.on('data',c=>d+=c); 
      resolve({status:res.statusCode, headers:res.headers, body:d});
    });
    req.on('error', e => resolve({error:e.message}));
    req.write(b);
    req.end();
  });
}

(async () => {
  // First: verify institution lookup works
  console.log('1. Institution lookup by UUID:');
  const inst = await get('/api/Institution/8e8c620e-17ed-4a7c-ae91-a770d3ce2f8b');
  console.log(inst.status, inst.body.substring(0, 200));

  // Try institution by integer ID
  console.log('\n2. Institution lookup by int ID 3167:');
  const inst2 = await get('/api/Institution/3167');
  console.log(inst2.status, inst2.body.substring(0, 200));

  // Minimal possible body - exactly matching the swagger schema
  console.log('\n3. EMRPrescription - absolute minimum:');
  const minBody = {
    prescriber: {
      firstName: "Biniam",
      lastName: "Gidey",
      rowGuid: "1890220f-ec3a-423e-8886-b04a60740146"
    },
    patient: {
      firstName: "Test",
      lastName: "Patient",
      age: 25,
      ageType: "Years",
      sex: "Male",
      cardNumber: "124258",
      rowGuid: "a25ea84a-8d5f-4136-b700-f35530e929be",
      paymentTypeId: "4a9afabb-f066-4267-a943-e489409368f3",
      patientTypeId: "c5129e01-02b6-44e5-8386-7f5c5a7f9266"
    },
    prescriptionDetails: [{
      numberOfDuration: 5,
      administrationId: "01d045a0-adf0-4065-9f5d-4fdc65c3ea92",
      frequencyTypeId: "44bead48-74a0-4107-a09d-e52be2c25803",
      itemUnitId: "f3387f1a-e77a-493d-bc59-8b88539439f5",
      quantity: 15
    }],
    rowGuid: "d6463ea1-6c39-4abe-a6c8-865d61459e2e",
    institutionId: "8e8c620e-17ed-4a7c-ae91-a770d3ce2f8b",
    prescriptionDate: "2026-06-26T12:00:00.000Z"
  };
  const r3 = await post('/api/Patient/EMRPrescription', minBody);
  console.log(r3.status, r3.body.substring(0, 300));

  // Try without prescriptionDiagnosis
  console.log('\n4. Same but without prescriptionDiagnosis key:');
  const minBody2 = {...minBody};
  const r4 = await post('/api/Patient/EMRPrescription', minBody2);
  console.log(r4.status, r4.body.substring(0, 300));

  // Try with prescriptionNumber set
  console.log('\n5. With prescriptionNumber:');
  const minBody3 = {...minBody, prescriptionNumber: 'RX-41'};
  const r5 = await post('/api/Patient/EMRPrescription', minBody3);
  console.log(r5.status, r5.body.substring(0, 300));

  // Try with completely different rowGuid
  console.log('\n6. Different rowGuids:');
  const minBody4 = {...minBody};
  minBody4.rowGuid = crypto.randomUUID();
  minBody4.patient.rowGuid = crypto.randomUUID();
  const r6 = await post('/api/Patient/EMRPrescription', minBody4);
  console.log(r6.status, r6.body.substring(0, 300));
})();
