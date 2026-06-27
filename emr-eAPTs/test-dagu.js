const http = require('http');
const crypto = require('crypto');
const secret = 'CodeForaEPTsCodeForaEPTsCodeForaEPTs';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({iss:'emr-eapts',sub:'emr-eapts',exp:Math.floor(Date.now()/1000)+86400,iat:Math.floor(Date.now()/1000)})).toString('base64url');
const sig = crypto.createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');
const token = header+'.'+payload+'.'+sig;

const options = {
  hostname: 'host.docker.internal',
  port: 5133,
  path: '/api/Patient/DuItems?institutionId=c1704170-564b-4cdb-b742-11e05b6da50c',
  method: 'GET',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const items = parsed.model || [];
    const searchUuids = ['f3387f1a-e77a-493d-bc59-8b88539439f5', 'd4631c91-5e07-11ef-8f7c-0242ac120002', 'd4704115-5e07-11ef-8f7c-0242ac120002'];
    for (const uuid of searchUuids) {
      const found = items.filter(i => i.itemUuid === uuid);
      console.log(uuid + ':', found.length > 0 ? 'FOUND: ' + found[0].genericName : 'NOT FOUND');
    }
    // Check if Paracetamol exists by name
    const para = items.filter(i => i.genericName && i.genericName.toLowerCase().includes('paracetamol'));
    console.log('Paracetamol items:', para.length);
    if (para.length > 0) console.log('First:', JSON.stringify(para[0], null, 2));
    // Check all payment types
    const same = items.filter(i => i.itemUuid === 'f3387f1a-e77a-493d-bc59-8b88539439f5');
    console.log('Same UUID items:', same.length > 0 ? JSON.stringify(same[0]) : 'none');
  });
});
req.on('error', (e) => { console.log('Error:', e.message); });
req.end();
