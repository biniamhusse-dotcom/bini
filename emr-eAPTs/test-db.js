const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: 'host.docker.internal',
  database: 'eapts_dev',
  password: '6h5Q4W4gPC',
  port: 5432
});
client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE 'art_%' AND table_name NOT LIKE 'base_%' AND table_name NOT LIKE 'cash_%' AND table_name NOT LIKE 'dump_%' AND table_name NOT LIKE 'create_%' AND table_name NOT LIKE 'inventory_%' AND table_name NOT LIKE 'loss_%' AND table_name NOT LIKE 'receive_%' AND table_name NOT LIKE 'request_%' AND table_name NOT LIKE 'transfer_%' AND table_name NOT LIKE 'is_%' AND table_name NOT LIKE 'next_%' AND table_name NOT LIKE 'outstanding_%' AND table_name NOT LIKE 'picklisted_%' AND table_name NOT LIKE 'stockstatus%' AND table_name NOT LIKE 'sync_%' AND table_name NOT LIKE 'full_%' AND table_name NOT LIKE 'prescription_%' AND table_name NOT LIKE 'issue_%' AND table_name NOT LIKE 'patients' AND table_name NOT LIKE 'diagnosis_%' AND table_name NOT LIKE 'schema_%' ORDER BY table_name"))
  .then(res => {
    console.log('Other tables:', res.rows.map(r => r.table_name).join(', '));
    return client.query("SELECT column_name, table_name FROM information_schema.columns WHERE column_name IN ('route_uuid','frequency_uuid','administration_uuid','route','frequency','administration','uuid') AND table_schema='public' AND table_name NOT LIKE 'art_%' AND table_name NOT LIKE 'base_%' AND table_name NOT LIKE 'cash_%' AND table_name NOT LIKE 'dump_%'");
  })
  .then(res => {
    console.log('Route/freq columns:', res.rows.map(r => r.table_name + '.' + r.column_name).join(', '));
    client.end();
  })
  .catch(e => { console.log('Error:', e.message); client.end(); });
