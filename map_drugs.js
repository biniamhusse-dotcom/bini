const { Client } = require('pg');
const mysql = require('mysql2/promise');
const fs = require('fs');

// Normalize drug name for matching
function normalize(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract generic name (first word before number/percentage)
function extractGeneric(name) {
  const n = normalize(name);
  // Remove strength-like parts
  const parts = n.split(/[\s]/).filter(p => p.length > 0);
  const generic = [];
  for (const p of parts) {
    if (/^[\d.,]+/.test(p) || /^[\d.,]+mg|ml|g|mcg|iu|%$/.test(p)) break;
    if (['tablet', 'capsule', 'injection', 'syrup', 'cream', 'ointment',
         'solution', 'suspension', 'drop', 'drops'].includes(p)) break;
    if (['with', 'for', 'in', 'per', 'as', 'bp'].includes(p)) break;
    generic.push(p);
  }
  return generic.join(' ');
}

async function main() {
  // Connect to Dagu PostgreSQL
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '6h5Q4W4gPC',
    database: 'eapts_dev'
  });
  await pgClient.connect();

  // Get Dagu drug-like items
  const daguRes = await pgClient.query(`
    SELECT p.name AS product_name,
           COALESCE(d.name, '') AS dosage_form,
           COALESCE(s.name, '') AS strength,
           u.name AS unit,
           iu.rowguid::text AS item_unit_uuid
    FROM item.product p
    JOIN item.item i ON i.product_id = p.id
    JOIN item.item_unit iu ON iu.item_id = i.id
    LEFT JOIN item.dosage d ON i.dosage_id = d.id
    LEFT JOIN item.strength s ON i.strength_id = s.id
    JOIN item.unit u ON iu.unit_id = u.id
    WHERE iu.is_used = true AND d.name IS NOT NULL
    ORDER BY p.name, d.name, s.name
  `);

  await pgClient.end();

  // Build Dagu index: generic_name -> [items]
  const daguIndex = {};
  for (const row of daguRes.rows) {
    const generic = normalize(row.product_name);
    if (!daguIndex[generic]) daguIndex[generic] = [];
    daguIndex[generic].push(row);
  }

  // Connect to OpenMRS MySQL
  const mysqlConn = await mysql.createConnection({
    host: 'localhost',
    port: 3206,
    user: 'root',
    password: 'adminAdmin!123',
    database: 'openmrs'
  });

  // Get all OpenMRS drugs
  const [drugs] = await mysqlConn.execute(
    'SELECT drug_id, name, dosage_form, uuid FROM drug ORDER BY drug_id'
  );

  const matches = [];
  const noMatches = [];

  for (const drug of drugs) {
    const generic = extractGeneric(drug.name);
    const candidates = daguIndex[generic];

    if (candidates) {
      // Pick the best candidate
      // Priority: match by strength substring in name
      const drugNorm = normalize(drug.name);
      let best = candidates[0];
      let bestScore = 0;

      for (const c of candidates) {
        let score = 0;
        const cName = normalize(c.product_name + ' ' + c.strength + ' ' + c.dosage_form + ' ' + c.unit);
        // Check how many words from drug name appear in candidate
        const drugWords = new Set(drugNorm.split(' ').filter(w => w.length > 1));
        const candWords = new Set(cName.split(' ').filter(w => w.length > 1));
        for (const w of drugWords) {
          if (candWords.has(w)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }

      matches.push({
        drug_id: drug.drug_id,
        drug_name: drug.name,
        dagu_product: best.product_name,
        dagu_dosage: best.dosage_form,
        dagu_strength: best.strength,
        dagu_uuid: best.item_unit_uuid,
        score: bestScore
      });
    } else {
      noMatches.push({ drug_id: drug.drug_id, name: drug.name, generic });
    }
  }

  // Generate SQL
  const sqlLines = [
    '-- Generated drug UUID update and mapping script',
    '-- Run in OpenMRS MySQL',
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    '-- Clear existing mappings',
    'TRUNCATE TABLE eapts_drug_mapping;',
    '',
    '-- Update drug UUIDs and create mappings',
    'INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, created_date) VALUES'
  ];

  const valueLines = [];
  for (const m of matches) {
    valueLines.push(`  (${m.drug_id}, '${m.dagu_uuid}', NOW())`);
  }
  sqlLines.push(valueLines.join(',\n') + ';');
  sqlLines.push('');
  sqlLines.push('SET FOREIGN_KEY_CHECKS = 1;');

  // Write SQL
  fs.writeFileSync('C:\\Users\\COMPUTER\\Documents\\emr\\update_drug_mappings.sql',
    sqlLines.join('\n'), 'utf8');

  console.log(`Matches: ${matches.length}`);
  console.log(`No matches: ${noMatches.length}`);

  // Show unmatched
  if (noMatches.length > 0) {
    console.log('\n=== UNMATCHED DRUGS ===');
    for (const nm of noMatches.slice(0, 30)) {
      console.log(`  drug_id=${nm.drug_id} "${nm.name}" -> generic="${nm.generic}"`);
    }
    if (noMatches.length > 30) {
      console.log(`  ... and ${noMatches.length - 30} more`);
    }
  }

  // Check for multiple OpenMRS drugs matching same Dagu UUID
  const uuidCounts = {};
  for (const m of matches) {
    uuidCounts[m.dagu_uuid] = (uuidCounts[m.dagu_uuid] || 0) + 1;
  }
  const duplicates = Object.entries(uuidCounts).filter(([k, v]) => v > 1);
  if (duplicates.length > 0) {
    console.log('\n=== DUPLICATE DAGU UUID ASSIGNMENTS ===');
    for (const [uuid, count] of duplicates) {
      const drugs = matches.filter(m => m.dagu_uuid === uuid);
      console.log(`  UUID ${uuid} assigned to ${count} drugs:`);
      for (const d of drugs) {
        console.log(`    drug_id=${d.drug_id} "${d.drug_name}"`);
      }
    }
  }

  // Also generate drug UUID update SQL
  const updateLines = [
    '-- Update OpenMRS drug UUIDs to match Dagu item_unit UUIDs',
    '-- (so COALESCE fallback works even without mapping)',
    ''
  ];
  for (const m of matches) {
    updateLines.push(`UPDATE drug SET uuid = '${m.dagu_uuid}' WHERE drug_id = ${m.drug_id};`);
  }
  fs.writeFileSync('C:\\Users\\COMPUTER\\Documents\\emr\\update_drug_uuids.sql',
    updateLines.join('\n'), 'utf8');

  await mysqlConn.end();
}

main().catch(console.error);
