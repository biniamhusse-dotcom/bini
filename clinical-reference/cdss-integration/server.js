const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3012;
const MEDICAL_MCP_URL = process.env.MEDICAL_MCP_URL || 'http://medical-mcp:3010';
const OPEN_MEDICINE_URL = process.env.OPEN_MEDICINE_URL || 'http://open-medicine:3011';
const OPENMRS_URL = process.env.OPENMRS_URL || 'http://openmrs:8080';

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'bahmni-cdss-integration',
    upstream: {
      medicalMcp: MEDICAL_MCP_URL,
      openMedicine: OPEN_MEDICINE_URL,
      openmrs: OPENMRS_URL
    },
    timestamp: new Date().toISOString()
  });
});

// ============= UNIFIED CLINICAL SEARCH =============

// Search across all clinical reference tools
app.get('/api/clinical/search', async (req, res) => {
  try {
    const { query, type = 'all' } = req.query;
    if (!query) return res.status(400).json({ error: 'query parameter required' });

    const results = {};

    // Search drugs
    if (type === 'all' || type === 'drugs') {
      try {
        const drugResponse = await axios.get(`${MEDICAL_MCP_URL}/api/drugs/search`, { params: { name: query } });
        results.drugs = drugResponse.data;
      } catch (e) {
        results.drugs = { error: 'Service unavailable' };
      }
    }

    // Search PubMed
    if (type === 'all' || type === 'literature') {
      try {
        const pubmedResponse = await axios.get(`${MEDICAL_MCP_URL}/api/pubmed/search`, { params: { query, max_results: 5 } });
        results.literature = pubmedResponse.data;
      } catch (e) {
        results.literature = { error: 'Service unavailable' };
      }
    }

    // Search guidelines
    if (type === 'all' || type === 'guidelines') {
      try {
        const guidelinesResponse = await axios.get(`${OPEN_MEDICINE_URL}/api/guidelines/list`);
        results.guidelines = guidelinesResponse.data;
      } catch (e) {
        results.guidelines = { error: 'Service unavailable' };
      }
    }

    // Search calculators
    if (type === 'all' || type === 'calculators') {
      try {
        const calcResponse = await axios.get(`${OPEN_MEDICINE_URL}/api/calculators/list`);
        results.calculators = calcResponse.data;
      } catch (e) {
        results.calculators = { error: 'Service unavailable' };
      }
    }

    res.json({ query, type, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Known drug interactions database (comprehensive clinically significant interactions)
function getKnownInteraction(drug1, drug2) {
  var d1 = drug1.toLowerCase().trim();
  var d2 = drug2.toLowerCase().trim();

  var interactions = [
    // ============= NSAIDs =============
    { drugs: ['aspirin', 'warfarin'], severity: 'high', description: 'Aspirin inhibits platelet aggregation and can displace warfarin from protein binding sites, significantly increasing the risk of bleeding. Concurrent use increases INR and bleeding risk.', recommendation: 'Avoid concurrent use unless specifically directed by a physician. Monitor INR closely if combination is necessary.' },
    { drugs: ['aspirin', 'ibuprofen'], severity: 'moderate', description: 'Ibuprofen can interfere with the cardioprotective antiplatelet effect of aspirin if taken before aspirin. Both are NSAIDs and concurrent use increases the risk of GI ulceration and bleeding.', recommendation: 'If both are needed, take aspirin at least 30 minutes before ibuprofen, or wait 8 hours after aspirin before taking ibuprofen.' },
    { drugs: ['aspirin', 'naproxen'], severity: 'moderate', description: 'Both are NSAIDs with antiplatelet effects. Concurrent use increases risk of GI bleeding, ulceration, and renal impairment without additional therapeutic benefit.', recommendation: 'Avoid combining NSAIDs. Use one agent at the lowest effective dose.' },
    { drugs: ['aspirin', 'methotrexate'], severity: 'high', description: 'Aspirin can reduce renal clearance of methotrexate, increasing the risk of methotrexate toxicity including bone marrow suppression, nephrotoxicity, and mucositis.', recommendation: 'Avoid concurrent use. Monitor CBC and renal function closely if co-administration is unavoidable.' },
    { drugs: ['aspirin', 'ACE inhibitors'], severity: 'moderate', description: 'Aspirin may reduce the antihypertensive effect of ACE inhibitors (enalapril, lisinopril, ramipril). Both affect renal prostaglandin synthesis.', recommendation: 'Monitor blood pressure. The cardioprotective benefit of low-dose aspirin generally outweighs this interaction.' },
    { drugs: ['ibuprofen', 'warfarin'], severity: 'high', description: 'Ibuprofen increases the risk of GI bleeding in patients on warfarin through antiplatelet effect and direct mucosal irritation. Also may displace warfarin from protein binding.', recommendation: 'Avoid concurrent use. If necessary, use lowest dose for shortest duration with gastroprotection.' },
    { drugs: ['ibuprofen', 'aspirin'], severity: 'moderate', description: 'Ibuprofen can interfere with the cardioprotective antiplatelet effect of aspirin if taken before aspirin. Both are NSAIDs and concurrent use increases GI bleeding risk.', recommendation: 'If both needed, take aspirin at least 30 minutes before ibuprofen.' },
    { drugs: ['naproxen', 'warfarin'], severity: 'high', description: 'Naproxen increases the risk of GI bleeding in patients on warfarin. Both inhibit platelet function and can cause GI mucosal damage.', recommendation: 'Avoid concurrent use. If necessary, use lowest dose with gastroprotection and monitor INR.' },
    { drugs: ['naproxen', 'ibuprofen'], severity: 'moderate', description: 'Both are NSAIDs. Concurrent use increases risk of GI bleeding, ulceration, and renal impairment without additional therapeutic benefit.', recommendation: 'Avoid combining NSAIDs. Use one agent at the lowest effective dose.' },
    { drugs: ['diclofenac', 'warfarin'], severity: 'high', description: 'Diclofenac increases the anticoagulant effect of warfarin and the risk of GI bleeding. NSAIDs can also impair renal function affecting drug clearance.', recommendation: 'Avoid concurrent use. Monitor INR closely if co-administration is necessary.' },
    { drugs: ['celecoxib', 'warfarin'], severity: 'moderate', description: 'Celecoxib (COX-2 inhibitor) can increase the anticoagulant effect of warfarin and may increase bleeding risk, though lower than traditional NSAIDs.', recommendation: 'Monitor INR closely when starting or stopping celecoxib. Use lowest effective dose.' },
    { drugs: ['indomethacin', 'lithium'], severity: 'high', description: 'Indomethacin reduces renal clearance of lithium, potentially causing lithium toxicity (tremor, confusion, renal impairment).', recommendation: 'Avoid concurrent use. If necessary, monitor lithium levels closely and adjust dose.' },
    { drugs: ['ibuprofen', 'lithium'], severity: 'high', description: 'Ibuprofen reduces renal clearance of lithium, potentially causing lithium toxicity. Risk increases with dehydration or renal impairment.', recommendation: 'Avoid concurrent use. Monitor lithium levels if combination unavoidable.' },
    { drugs: ['naproxen', 'lithium'], severity: 'high', description: 'Naproxen reduces renal clearance of lithium, potentially causing lithium toxicity.', recommendation: 'Avoid concurrent use. Monitor lithium levels closely.' },
    { drugs: ['aspirin', 'lithium'], severity: 'moderate', description: 'Aspirin can reduce renal clearance of lithium at high doses, potentially increasing lithium levels. At low cardioprotective doses, effect is usually minimal.', recommendation: 'Monitor lithium levels when starting or stopping aspirin.' },
    { drugs: ['ibuprofen', 'methotrexate'], severity: 'high', description: 'Ibuprofen can reduce renal clearance of methotrexate, increasing the risk of methotrexate toxicity including bone marrow suppression.', recommendation: 'Avoid concurrent use. Monitor CBC and renal function if co-administration is necessary.' },
    { drugs: ['naproxen', 'methotrexate'], severity: 'high', description: 'Naproxen reduces renal clearance of methotrexate, increasing risk of methotrexate toxicity.', recommendation: 'Avoid concurrent use. Monitor CBC and renal function if co-administration is necessary.' },
    { drugs: ['aspirin', 'ACE inhibitors'], severity: 'moderate', description: 'Aspirin may reduce the antihypertensive effect of ACE inhibitors by inhibiting prostaglandin synthesis.', recommendation: 'Generally safe to combine. Monitor blood pressure.' },
    { drugs: ['ibuprofen', 'ACE inhibitors'], severity: 'moderate', description: 'NSAIDs reduce the antihypertensive effect of ACE inhibitors and can increase risk of acute kidney injury, especially in elderly or dehydrated patients.', recommendation: 'Use with caution. Monitor blood pressure and renal function.' },
    { drugs: ['ibuprofen', 'diuretics'], severity: 'moderate', description: 'NSAIDs reduce the efficacy of diuretics by inhibiting renal prostaglandin synthesis. Can also increase risk of acute kidney injury.', recommendation: 'Monitor blood pressure and weight. Consider alternative analgesics.' },
    { drugs: ['ibuprofen', 'SSRIs'], severity: 'moderate', description: 'Combined use of NSAIDs and SSRIs (fluoxetine, sertraline, paroxetine, citalopram) increases the risk of GI bleeding by 2-4 fold.', recommendation: 'Consider gastroprotection with PPI if long-term combined use is necessary.' },

    // ============= Antibiotics =============
    { drugs: ['ciprofloxacin', 'warfarin'], severity: 'high', description: 'Ciprofloxacin inhibits the metabolism of warfarin (CYP1A2), significantly increasing INR and bleeding risk.', recommendation: 'Avoid combination or monitor INR very closely. Consider antibiotic alternative.' },
    { drugs: ['metronidazole', 'warfarin'], severity: 'high', description: 'Metronidazole inhibits the metabolism of warfarin (CYP2C9), significantly increasing INR and bleeding risk.', recommendation: 'Reduce warfarin dose by 25-50% when starting metronidazole. Monitor INR frequently.' },
    { drugs: ['fluconazole', 'warfarin'], severity: 'high', description: 'Fluconazole inhibits CYP2C9, the primary enzyme metabolizing warfarin, significantly increasing INR and bleeding risk.', recommendation: 'Reduce warfarin dose by 25-50%. Monitor INR closely during and after fluconazole therapy.' },
    { drugs: ['trimethoprim', 'warfarin'], severity: 'moderate', description: 'Trimethoprim-sulfamethoxazole can increase the anticoagulant effect of warfarin by inhibiting CYP2C9 metabolism.', recommendation: 'Monitor INR closely. Consider antibiotic alternative.' },
    { drugs: ['erythromycin', 'warfarin'], severity: 'moderate', description: 'Erythromycin inhibits CYP3A4, which may increase warfarin levels and anticoagulant effect.', recommendation: 'Monitor INR when starting or stopping erythromycin.' },
    { drugs: ['rifampin', 'warfarin'], severity: 'high', description: 'Rifampin is a potent CYP inducer that can significantly reduce warfarin levels, potentially leading to subtherapeutic anticoagulation and clotting risk.', recommendation: 'Increase warfarin dose as needed. Monitor INR frequently during rifampin therapy and after discontinuation.' },
    { drugs: ['ciprofloxacin', 'metformin'], severity: 'moderate', description: 'Ciprofloxacin may alter blood glucose levels unpredictably (hypo- or hyperglycemia). May also increase metformin levels slightly.', recommendation: 'Monitor blood glucose closely during concurrent use.' },
    { drugs: ['metronidazole', 'metformin'], severity: 'moderate', description: 'Metronidazole may increase the effect of metformin on blood glucose. Rare reports of disulfiram-like reaction if alcohol is consumed.', recommendation: 'Monitor blood glucose. Avoid alcohol during metronidazole use.' },
    { drugs: ['ciprofloxacin', 'theophylline'], severity: 'high', description: 'Ciprofloxacin inhibits the metabolism of theophylline (CYP1A2), potentially causing theophylline toxicity (seizures, arrhythmias, nausea).', recommendation: 'Reduce theophylline dose by 25-50% or use alternative antibiotic. Monitor theophylline levels.' },
    { drugs: ['erythromycin', 'theophylline'], severity: 'moderate', description: 'Erythromycin may increase theophylline levels through CYP3A4 inhibition.', recommendation: 'Monitor theophylline levels and adjust dose if needed.' },
    { drugs: ['azithromycin', 'warfarin'], severity: 'moderate', description: 'Azithromycin may slightly increase the anticoagulant effect of warfarin, though less than other macrolides.', recommendation: 'Monitor INR when starting or stopping azithromycin.' },
    { drugs: ['doxycycline', 'warfarin'], severity: 'moderate', description: 'Doxycycline may enhance the anticoagulant effect of warfarin by inhibiting vitamin K-producing gut flora.', recommendation: 'Monitor INR when starting or stopping doxycycline.' },
    { drugs: ['isoniazid', 'warfarin'], severity: 'moderate', description: 'Isoniazid inhibits the metabolism of warfarin, potentially increasing INR and bleeding risk.', recommendation: 'Monitor INR closely during isoniazid therapy.' },
    { drugs: ['isoniazid', 'paracetamol'], severity: 'moderate', description: 'Isoniazid increases the hepatotoxic potential of paracetamol by inducing cytochrome P450 enzymes that produce the toxic metabolite NAPQI.', recommendation: 'Avoid regular concurrent use. Limit paracetamol dose and monitor liver function.' },
    { drugs: ['isoniazid', 'metformin'], severity: 'moderate', description: 'Isoniazid may alter blood glucose levels unpredictably and can cause hepatotoxicity. Metformin is also hepatically metabolized.', recommendation: 'Monitor blood glucose and liver function regularly.' },

    // ============= Anticoagulants =============
    { drugs: ['warfarin', 'aspirin'], severity: 'high', description: 'Dual antithrombotic therapy significantly increases bleeding risk. Aspirin inhibits platelets while warfarin inhibits coagulation factors.', recommendation: 'Avoid unless specifically indicated (e.g., mechanical heart valve with AF). Use lowest effective doses.' },
    { drugs: ['warfarin', 'clopidogrel'], severity: 'high', description: 'Clopidogrel inhibits platelet aggregation. Combined with warfarin, it significantly increases the risk of major bleeding.', recommendation: 'Only use together under specialist supervision for defined indications (e.g., ACS/stenting). Limit duration.' },
    { drugs: ['warfarin', 'heparin'], severity: 'moderate', description: 'Overlapping anticoagulation therapy increases bleeding risk. Standard practice is to overlap during transition periods only.', recommendation: 'Only overlap during transition from heparin to warfarin. Monitor INR and aPTT.' },
    { drugs: ['heparin', 'aspirin'], severity: 'moderate', description: 'Combined anticoagulant and antiplatelet therapy increases bleeding risk.', recommendation: 'Use together only when specifically indicated. Monitor for bleeding.' },
    { drugs: ['rivaroxaban', 'aspirin'], severity: 'moderate', description: 'Combined anticoagulant and antiplatelet therapy increases bleeding risk. Risk depends on doses used.', recommendation: 'Use together only when specifically indicated. Use lowest effective doses.' },
    { drugs: ['apixaban', 'aspirin'], severity: 'moderate', description: 'Combined anticoagulant and antiplatelet therapy increases bleeding risk.', recommendation: 'Use together only when specifically indicated. Use lowest effective doses.' },

    // ============= Antihypertensives =============
    { drugs: ['metoprolol', 'verapamil'], severity: 'high', description: 'Combined beta-blocker and calcium channel blocker can cause severe bradycardia, heart block, and heart failure. Both depress cardiac conduction.', recommendation: 'Avoid combination or use with extreme caution with cardiac monitoring.' },
    { drugs: ['lisinopril', 'spironolactone'], severity: 'high', description: 'Combined ACE inhibitor and potassium-sparing diuretic can cause severe hyperkalemia (potassium >6.0 mEq/L), potentially fatal.', recommendation: 'Avoid combination or monitor potassium and renal function very closely. Max spironolactone 25mg with ACE inhibitor.' },
    { drugs: ['lisinopril', 'ibuprofen'], severity: 'moderate', description: 'NSAIDs reduce the antihypertensive effect of ACE inhibitors and can increase risk of acute kidney injury.', recommendation: 'Monitor blood pressure and renal function. Consider alternative analgesics.' },
    { drugs: ['metoprolol', 'verapamil'], severity: 'high', description: 'Both drugs depress cardiac conduction. Combined use can cause severe bradycardia, AV block, and cardiac arrest.', recommendation: 'Contraindicated in most patients. Avoid combination.' },
    { drugs: ['enalapril', 'potassium supplements'], severity: 'moderate', description: 'ACE inhibitors reduce potassium excretion. Combined with potassium supplements, risk of hyperkalemia increases.', recommendation: 'Monitor potassium levels regularly.' },
    { drugs: ['lisinopril', 'potassium supplements'], severity: 'moderate', description: 'ACE inhibitors reduce potassium excretion. Combined with potassium supplements, risk of hyperkalemia increases.', recommendation: 'Monitor potassium levels regularly.' },
    { drugs: ['amlodipine', 'simvastatin'], severity: 'moderate', description: 'Amlodipine inhibits CYP3A4, increasing simvastatin levels. High-dose simvastatin (>20mg) with amlodipine increases myopathy risk.', recommendation: 'Limit simvastatin dose to 20mg daily when used with amlodipine.' },
    { drugs: ['diltiazem', 'simvastatin'], severity: 'high', description: 'Diltiazem significantly increases simvastatin levels through CYP3A4 inhibition, greatly increasing the risk of rhabdomyolysis.', recommendation: 'Limit simvastatin dose to 20mg daily with diltiazem. Consider alternative statin.' },
    { drugs: ['losartan', 'ibuprofen'], severity: 'moderate', description: 'NSAIDs reduce the antihypertensive effect of ARBs and can increase risk of acute kidney injury.', recommendation: 'Monitor blood pressure and renal function.' },
    { drugs: ['propranolol', 'insulin'], severity: 'moderate', description: 'Beta-blockers can mask hypoglycemic symptoms (tachycardia) and may impair glucose recovery. However, they do not affect sweating.', recommendation: 'Use cardioselective beta-blockers when possible. Educate patient about masked hypoglycemia.' },
    { drugs: ['atenolol', 'insulin'], severity: 'moderate', description: 'Beta-blockers can mask hypoglycemic symptoms and may impair glucose recovery.', recommendation: 'Monitor blood glucose closely. Educate patient about masked hypoglycemia.' },

    // ============= Diabetes medications =============
    { drugs: ['metformin', 'warfarin'], severity: 'low', description: 'Metformin may slightly enhance the anticoagulant effect of warfarin, though this is rarely clinically significant.', recommendation: 'Generally safe to combine. Monitor INR when starting or stopping metformin.' },
    { drugs: ['metformin', 'ibuprofen'], severity: 'moderate', description: 'NSAIDs can impair renal function, which may increase metformin levels and risk of lactic acidosis. Can also counteract blood pressure-lowering effects.', recommendation: 'Use with caution. Monitor renal function. Avoid in patients with borderline renal function.' },
    { drugs: ['metformin', 'alcohol'], severity: 'high', description: 'Alcohol potentiates the effect of metformin on lactate metabolism, increasing the risk of lactic acidosis. Alcohol also impairs hepatic gluconeogenesis.', recommendation: 'Warn patients against excessive alcohol intake while on metformin.' },
    { drugs: ['glyburide', 'fluconazole'], severity: 'moderate', description: 'Fluconazole may increase glyburide levels through CYP2C9 inhibition, increasing hypoglycemia risk.', recommendation: 'Monitor blood glucose closely. Consider dose reduction of glyburide.' },
    { drugs: ['glipizide', 'fluconazole'], severity: 'moderate', description: 'Fluconazole may increase glipizide levels through CYP2C9 inhibition, increasing hypoglycemia risk.', recommendation: 'Monitor blood glucose closely. Consider dose reduction.' },
    { drugs: ['insulin', 'ACE inhibitors'], severity: 'low', description: 'ACE inhibitors may enhance the hypoglycemic effect of insulin by improving insulin sensitivity. This is usually beneficial.', recommendation: 'Monitor blood glucose when starting or adjusting ACE inhibitor dose.' },
    { drugs: ['insulin', 'corticosteroids'], severity: 'moderate', description: 'Corticosteroids increase insulin resistance and can significantly raise blood glucose levels, potentially requiring insulin dose increases.', recommendation: 'Monitor blood glucose closely. Anticipate need for insulin dose adjustment.' },
    { drugs: ['metformin', 'corticosteroids'], severity: 'moderate', description: 'Corticosteroids increase insulin resistance and can raise blood glucose levels, counteracting the effect of metformin.', recommendation: 'Monitor blood glucose. May need to increase metformin dose or add additional therapy.' },
    { drugs: ['metformin', 'contrast dye'], severity: 'high', description: 'Iodinated contrast dye can cause acute kidney injury, increasing metformin levels and risk of fatal lactic acidosis.', recommendation: 'Discontinue metformin 48 hours before and after contrast procedures. Monitor renal function before restarting.' },
    { drugs: ['empagliflozin', 'loop diuretics'], severity: 'moderate', description: 'Combined SGLT2 inhibitor and loop diuretic use can cause dehydration, hypotension, and acute kidney injury.', recommendation: 'Consider reducing diuretic dose. Monitor volume status, blood pressure, and renal function.' },
    { drugs: ['dapagliflozin', 'insulin'], severity: 'moderate', description: 'Combined SGLT2 inhibitor and insulin use increases risk of hypoglycemia and genital infections.', recommendation: 'Consider reducing insulin dose. Monitor blood glucose.' },
    { drugs: ['sitagliptin', 'warfarin'], severity: 'low', description: 'Sitagliptin may slightly increase INR when combined with warfarin. Effect is generally small.', recommendation: 'Monitor INR when starting or stopping sitagliptin.' },

    // ============= Psychiatric medications =============
    { drugs: ['lithium', 'ibuprofen'], severity: 'high', description: 'Ibuprofen reduces renal clearance of lithium, potentially causing lithium toxicity (tremor, confusion, renal impairment).', recommendation: 'Avoid concurrent use. Monitor lithium levels if combination unavoidable.' },
    { drugs: ['lithium', 'naproxen'], severity: 'high', description: 'Naproxen reduces renal clearance of lithium, potentially causing lithium toxicity.', recommendation: 'Avoid concurrent use. Monitor lithium levels closely.' },
    { drugs: ['lithium', 'diclofenac'], severity: 'high', description: 'Diclofenac reduces renal clearance of lithium, increasing toxicity risk.', recommendation: 'Avoid concurrent use. Monitor lithium levels.' },
    { drugs: ['lithium', 'indomethacin'], severity: 'high', description: 'Indomethacin significantly reduces renal clearance of lithium, high risk of lithium toxicity.', recommendation: 'Contraindicated combination. Use alternative analgesic.' },
    { drugs: ['lithium', 'ACE inhibitors'], severity: 'moderate', description: 'ACE inhibitors can reduce lithium clearance, potentially increasing lithium levels. Risk of nephrotoxicity with long-term use.', recommendation: 'Monitor lithium levels when starting or adjusting ACE inhibitor.' },
    { drugs: ['lithium', 'thiazide diuretics'], severity: 'high', description: 'Thiazide diuretics reduce renal clearance of lithium, significantly increasing the risk of lithium toxicity.', recommendation: 'Avoid combination. If necessary, reduce lithium dose by 25-50% and monitor levels closely.' },
    { drugs: ['lithium', 'metronidazole'], severity: 'moderate', description: 'Metronidazole may increase lithium levels through reduced renal clearance.', recommendation: 'Monitor lithium levels during metronidazole therapy.' },
    { drugs: ['SSRIs', 'MAOIs'], severity: 'high', description: 'Combined serotonergic drugs can cause serotonin syndrome (hyperthermia, rigidity, myoclonus, autonomic instability). Potentially fatal.', recommendation: 'Contraindicated. Allow 14-day washout between MAOI and SSRI therapy.' },
    { drugs: ['fluoxetine', 'MAOIs'], severity: 'high', description: 'Combined serotonergic drugs can cause serotonin syndrome. Fluoxetine has a long half-life requiring extended washout.', recommendation: 'Contraindicated. Allow 5-week washout after stopping fluoxetine before starting MAOI.' },
    { drugs: ['sertraline', 'MAOIs'], severity: 'high', description: 'Combined serotonergic drugs can cause serotonin syndrome.', recommendation: 'Contraindicated. Allow 14-day washout between drugs.' },
    { drugs: ['citalopram', 'MAOIs'], severity: 'high', description: 'Combined serotonergic drugs can cause serotonin syndrome.', recommendation: 'Contraindicated. Allow 14-day washout between drugs.' },
    { drugs: ['trazodone', 'MAOIs'], severity: 'high', description: 'Combined serotonergic drugs can cause serotonin syndrome.', recommendation: 'Contraindicated. Allow 14-day washout.' },
    { drugs: ['SSRIs', 'tramadol'], severity: 'moderate', description: 'Combined serotonergic drugs increase risk of serotonin syndrome. Tramadol also lowers seizure threshold.', recommendation: 'Use with caution. Start at lowest doses. Monitor for serotonin syndrome symptoms.' },
    { drugs: ['SSRIs', 'triptans'], severity: 'moderate', description: 'Combined serotonergic drugs increase risk of serotonin syndrome.', recommendation: 'Use with caution. Monitor for serotonin syndrome. Consider alternative migraine treatment.' },
    { drugs: ['carbamazepine', 'valproic acid'], severity: 'moderate', description: 'Valproic acid inhibits the metabolism of carbamazepine, potentially increasing levels and toxicity (diplopia, ataxia, nausea).', recommendation: 'Monitor carbamazepine levels. Consider dose adjustment.' },
    { drugs: ['carbamazepine', 'warfarin'], severity: 'moderate', description: 'Carbamazepine induces CYP enzymes, reducing warfarin levels and anticoagulant effect. May lead to subtherapeutic INR.', recommendation: 'Increase warfarin dose as needed. Monitor INR frequently.' },
    { drugs: ['carbamazepine', 'oral contraceptives'], severity: 'moderate', description: 'Carbamazepine induces CYP3A4, reducing the efficacy of oral contraceptives and increasing risk of pregnancy.', recommendation: 'Consider higher-dose OC or alternative contraceptive method.' },
    { drugs: ['phenytoin', 'warfarin'], severity: 'moderate', description: 'Phenytoin induces CYP enzymes, reducing warfarin levels. However, phenytoin also inhibits CYP2C9 at high levels, creating complex interaction.', recommendation: 'Monitor INR when adjusting phenytoin dose.' },
    { drugs: ['valproic acid', 'lamotrigine'], severity: 'high', description: 'Valproic acid inhibits the glucuronidation of lamotrigine, dramatically increasing lamotrigine levels (up to 200%) and risk of serious rash (SJS/TEN).', recommendation: 'Reduce lamotrigine dose by 50-75% when starting valproic acid. Titrate slowly.' },
    { drugs: ['clozapine', 'ciprofloxacin'], severity: 'high', description: 'Ciprofloxacin inhibits CYP1A2, significantly increasing clozapine levels and risk of seizures and agranulocytosis.', recommendation: 'Avoid combination. If necessary, reduce clozapine dose and monitor levels and WBC.' },
    { drugs: ['olanzapine', 'ciprofloxacin'], severity: 'moderate', description: 'Ciprofloxacin may increase olanzapine levels through CYP1A2 inhibition.', recommendation: 'Monitor for olanzapine side effects. Consider dose reduction.' },
    { drugs: ['benzodiazepines', 'opioids'], severity: 'high', description: 'Combined CNS depressants can cause profound sedation, respiratory depression, coma, and death.', recommendation: 'Avoid combination when possible. If necessary, use lowest effective doses for shortest duration.' },
    { drugs: ['alprazolam', 'ketoconazole'], severity: 'high', description: 'Ketoconazole inhibits CYP3A4, significantly increasing alprazolam levels and risk of excessive sedation and respiratory depression.', recommendation: 'Avoid combination or use alternative antifungal.' },
    { drugs: ['diazepam', 'omeprazole'], severity: 'low', description: 'Omeprazole may slightly inhibit CYP2C19, potentially increasing diazepam levels. Effect is usually minimal.', recommendation: 'Generally safe to combine. Monitor for increased sedation.' },

    // ============= Cardiovascular =============
    { drugs: ['amiodarone', 'warfarin'], severity: 'high', description: 'Amiodarone potently inhibits CYP2C9, dramatically increasing warfarin levels and anticoagulant effect for weeks to months after starting.', recommendation: 'Reduce warfarin dose by 30-50% when starting amiodarone. Monitor INR very closely for months.' },
    { drugs: ['amiodarone', 'digoxin'], severity: 'high', description: 'Amiodarone reduces renal and biliary clearance of digoxin, increasing levels by 70-100%. Risk of digoxin toxicity (arrhythmias, nausea, visual changes).', recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels.' },
    { drugs: ['amiodarone', 'simvastatin'], severity: 'high', description: 'Amiodarone potently inhibits CYP3A4, increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Limit simvastatin dose to 20mg daily with amiodarone. Consider alternative statin.' },
    { drugs: ['digoxin', 'amiodarone'], severity: 'high', description: 'Amiodarone reduces digoxin clearance, potentially causing digoxin toxicity.', recommendation: 'Reduce digoxin dose by 50% when starting amiodarone.' },
    { drugs: ['digoxin', 'verapamil'], severity: 'moderate', description: 'Verapamil increases digoxin levels by reducing renal clearance. Risk of digoxin toxicity.', recommendation: 'Reduce digoxin dose. Monitor levels.' },
    { drugs: ['digoxin', 'spironolactone'], severity: 'moderate', description: 'Spironolactone reduces renal clearance of digoxin and can interfere with digoxin assays, causing falsely elevated readings.', recommendation: 'Monitor digoxin levels (use method unaffected by spironolactone). Consider dose reduction.' },
    { drugs: ['digoxin', 'erythromycin'], severity: 'moderate', description: 'Erythromycin may increase digoxin levels by reducing gut bacteria that metabolize digoxin.', recommendation: 'Monitor digoxin levels during erythromycin therapy.' },
    { drugs: ['simvastatin', 'amiodarone'], severity: 'high', description: 'Amiodarone inhibits CYP3A4, increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Limit simvastatin to 20mg daily. Consider alternative statin (pravastatin, rosuvastatin).' },
    { drugs: ['simvastatin', 'diltiazem'], severity: 'high', description: 'Diltiazem inhibits CYP3A4, increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Limit simvastatin to 20mg daily. Consider alternative statin.' },
    { drugs: ['simvastatin', 'itraconazole'], severity: 'high', description: 'Itraconazole potently inhibits CYP3A4, dramatically increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Avoid combination. If antifungal needed, use fluconazole or stop simvastatin temporarily.' },
    { drugs: ['simvastatin', 'clarithromycin'], severity: 'high', description: 'Clarithromycin inhibits CYP3A4, increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Avoid combination. If antibiotic needed, use azithromycin or stop simvastatin temporarily.' },
    { drugs: ['atorvastatin', 'clarithromycin'], severity: 'moderate', description: 'Clarithromycin may increase atorvastatin levels through CYP3A4 inhibition.', recommendation: 'Monitor for muscle pain/weakness. Consider temporary statin interruption.' },
    { drugs: ['rosuvastatin', 'gemfibrozil'], severity: 'high', description: 'Gemfibrozil inhibits OATP1B1 transport of rosuvastatin, increasing levels by 200% and risk of rhabdomyolysis.', recommendation: 'Do not combine. Use fenofibrate instead of gemfibrozil if needed.' },
    { drugs: ['niacin', 'simvastatin'], severity: 'moderate', description: 'Combination increases risk of myopathy, especially at high-dose niacin (>1g/day).', recommendation: 'Use combination product at recommended doses. Monitor for muscle symptoms.' },
    { drugs: ['metoprolol', 'verapamil'], severity: 'high', description: 'Both depress cardiac conduction. Combined use can cause severe bradycardia, AV block, and cardiac arrest.', recommendation: 'Contraindicated in most patients. Avoid combination.' },
    { drugs: ['metoprolol', 'diltiazem'], severity: 'high', description: 'Both depress cardiac conduction. Combined use can cause severe bradycardia and heart block.', recommendation: 'Avoid combination or use with extreme caution with cardiac monitoring.' },
    { drugs: ['atenolol', 'verapamil'], severity: 'high', description: 'Both depress cardiac conduction. Combined use can cause severe bradycardia and AV block.', recommendation: 'Avoid combination.' },
    { drugs: ['flecainide', 'verapamil'], severity: 'moderate', description: 'Verapamil may increase flecainide levels, increasing risk of proarrhythmic effects.', recommendation: 'Monitor ECG and flecainide levels if combination is necessary.' },
    { drugs: ['disopyramide', 'amiodarone'], severity: 'moderate', description: 'Combined use increases risk of QT prolongation and ventricular arrhythmias.', recommendation: 'Avoid combination. If necessary, monitor ECG closely.' },

    // ============= Thyroid =============
    { drugs: ['levothyroxine', 'calcium supplements'], severity: 'moderate', description: 'Calcium supplements can reduce the absorption of levothyroxine, potentially causing hypothyroidism.', recommendation: 'Take levothyroxine at least 4 hours before or after calcium supplements.' },
    { drugs: ['levothyroxine', 'iron supplements'], severity: 'moderate', description: 'Iron supplements can reduce the absorption of levothyroxine, potentially causing hypothyroidism.', recommendation: 'Take levothyroxine at least 4 hours before or after iron supplements.' },
    { drugs: ['levothyroxine', 'antacids'], severity: 'moderate', description: 'Aluminum/magnesium-containing antacids can reduce levothyroxine absorption.', recommendation: 'Take levothyroxine at least 4 hours before or after antacids.' },
    { drugs: ['levothyroxine', 'omeprazole'], severity: 'low', description: 'PPIs may slightly reduce levothyroxine absorption, though effect is usually clinically insignificant.', recommendation: 'Monitor TSH. Generally safe to combine.' },

    // ============= Gastrointestinal =============
    { drugs: ['omeprazole', 'clopidogrel'], severity: 'high', description: 'Omeprazole inhibits CYP2C19, reducing the activation of clopidogrel to its active metabolite. This diminishes the antiplatelet effect by 40-50%.', recommendation: 'Avoid combination. Use pantoprazole instead (minimal CYP2C19 inhibition) if PPI needed with clopidogrel.' },
    { drugs: ['pantoprazole', 'clopidogrel'], severity: 'low', description: 'Pantoprazole has minimal CYP2C19 inhibition and is the preferred PPI with clopidogrel.', recommendation: 'Safe to combine. Preferred PPI choice with clopidogrel.' },
    { drugs: ['esomeprazole', 'clopidogrel'], severity: 'moderate', description: 'Esomeprazole may slightly reduce clopidogrel activation through CYP2C19 inhibition, though less than omeprazole.', recommendation: 'Monitor for antiplatelet effect. Consider pantoprazole if PPI needed.' },
    { drugs: ['ranitidine', 'omeprazole'], severity: 'low', description: 'Both reduce gastric acid. Combined use provides no additional acid suppression benefit.', recommendation: 'Use one agent only. No benefit from combining.' },
    { drugs: ['metoclopramide', 'omeprazole'], severity: 'low', description: 'Metoclopramide increases gastric motility, potentially reducing omeprazole exposure. However, omeprazole is typically given before meals.', recommendation: 'Generally safe to combine. Take omeprazole 30 min before meals.' },
    { drugs: ['omeprazole', 'methotrexate'], severity: 'moderate', description: 'PPIs may reduce renal clearance of methotrexate (especially high-dose), potentially increasing toxicity.', recommendation: 'Monitor for methotrexate toxicity. Consider H2 blocker alternative for high-dose methotrexate.' },

    // ============= Epilepsy =============
    { drugs: ['phenytoin', 'valproic acid'], severity: 'moderate', description: 'Valproic acid inhibits the metabolism of phenytoin, increasing levels. At high phenytoin levels, metabolism may actually increase (saturation kinetics).', recommendation: 'Monitor phenytoin levels closely when starting/stopping valproic acid.' },
    { drugs: ['carbamazepine', 'erythromycin'], severity: 'moderate', description: 'Erythromycin inhibits CYP3A4, increasing carbamazepine levels and risk of toxicity (diplopia, ataxia).', recommendation: 'Monitor carbamazepine levels. Consider azithromycin as alternative.' },
    { drugs: ['phenytoin', 'fluconazole'], severity: 'moderate', description: 'Fluconazole inhibits CYP2C9, increasing phenytoin levels and risk of toxicity.', recommendation: 'Monitor phenytoin levels closely.' },
    { drugs: ['valproic acid', 'carbamazepine'], severity: 'moderate', description: 'Carbamazepine induces metabolism of valproic acid, reducing its levels and potentially causing breakthrough seizures.', recommendation: 'Monitor valproic acid levels. May need dose increase.' },
    { drugs: ['lamotrigine', 'valproic acid'], severity: 'high', description: 'Valproic acid doubles lamotrigine levels by inhibiting glucuronidation. Increases risk of serious skin reactions.', recommendation: 'Reduce lamotrigine dose by 50-75% when adding valproic acid. Titrate very slowly.' },

    // ============= Paracetamol combinations =============
    { drugs: ['paracetamol', 'warfarin'], severity: 'moderate', description: 'Regular use of paracetamol (>2g/day for several days) may potentiate the anticoagulant effect of warfarin, increasing INR.', recommendation: 'Limit paracetamol to <2g/day. Monitor INR more frequently.' },
    { drugs: ['paracetamol', 'aspirin'], severity: 'low', description: 'Paracetamol and aspirin can generally be used together safely at standard doses. Available as combination products (e.g., Excedrin).', recommendation: 'Safe at recommended doses. Be aware of combination products.' },
    { drugs: ['paracetamol', 'ibuprofen'], severity: 'low', description: 'Paracetamol and ibuprofen can be used together safely. They work through different mechanisms and can provide additive pain relief.', recommendation: 'Safe to combine at recommended doses. Stagger dosing for optimal pain coverage.' },
    { drugs: ['paracetamol', 'codeine'], severity: 'low', description: 'Paracetamol is commonly combined with codeine in prescription products. Safe at recommended doses.', recommendation: 'Safe combination. Be aware of total paracetamol dose from all sources.' },
    { drugs: ['acetaminophen', 'warfarin'], severity: 'moderate', description: 'Regular use of acetaminophen (>2g/day for several days) may potentiate the anticoagulant effect of warfarin, increasing INR.', recommendation: 'Limit acetaminophen to <2g/day. Monitor INR more frequently.' },
    { drugs: ['acetaminophen', 'aspirin'], severity: 'low', description: 'Acetaminophen and aspirin can generally be used together safely at standard doses.', recommendation: 'Safe at recommended doses.' },
    { drugs: ['acetaminophen', 'ibuprofen'], severity: 'low', description: 'Acetaminophen and ibuprofen can be used together safely. Different mechanisms provide additive pain relief.', recommendation: 'Safe to combine at recommended doses.' },
    { drugs: ['acetaminophen', 'codeine'], severity: 'low', description: 'Acetaminophen is commonly combined with codeine. Safe at recommended doses.', recommendation: 'Safe combination. Monitor total acetaminophen intake from all sources.' },

    // ============= Gout =============
    { drugs: ['allopurinol', 'azathioprine'], severity: 'high', description: 'Allopurinol inhibits the metabolism of azathioprine, dramatically increasing levels and risk of severe myelosuppression (pancytopenia).', recommendation: 'Contraindicated combination. If both needed, reduce azathioprine dose by 75% and monitor CBC closely.' },
    { drugs: ['colchicine', 'clarithromycin'], severity: 'high', description: 'Clarithromycin inhibits CYP3A4 and P-glycoprotein, increasing colchicine levels and risk of fatal toxicity.', recommendation: 'Avoid combination. If necessary, reduce colchicine dose by at least 50%.' },
    { drugs: ['colchicine', 'erythromycin'], severity: 'high', description: 'Erythromycin increases colchicine levels, increasing risk of toxicity.', recommendation: 'Avoid combination or reduce colchicine dose significantly.' },
    { drugs: ['allopurinol', 'ampicillin'], severity: 'moderate', description: 'Allopurinol increases the risk of ampicillin-related skin rash.', recommendation: 'Be aware of increased rash risk. Use alternative antibiotic if possible.' },
    { drugs: ['febuxostat', 'azathioprine'], severity: 'high', description: 'Febuxostat inhibits xanthine oxidase, reducing the metabolism of azathioprine and increasing myelosuppression risk.', recommendation: 'Contraindicated combination. Use alternative immunosuppressant or gout therapy.' },

    // ============= Immunosuppressants =============
    { drugs: ['cyclosporine', 'simvastatin'], severity: 'high', description: 'Cyclosporine potently inhibits OATP1B1 and CYP3A4, dramatically increasing statin levels and risk of rhabdomyolysis.', recommendation: 'Use pravastatin (max 20mg) or rosuvastatin (max 5mg) instead of simvastatin.' },
    { drugs: ['tacrolimus', 'azole antifungals'], severity: 'high', description: 'Azole antifungals inhibit CYP3A4, increasing tacrolimus levels and risk of nephrotoxicity and neurotoxicity.', recommendation: 'Reduce tacrolimus dose by 50-75% when starting azole antifungal. Monitor levels closely.' },
    { drugs: ['methotrexate', 'NSAIDs'], severity: 'high', description: 'NSAIDs reduce renal clearance of methotrexate, potentially causing fatal toxicity (pancytopenia, mucositis).', recommendation: 'Avoid concurrent use, especially with high-dose methotrexate. Monitor CBC if combination necessary.' },
    { drugs: ['mycophenolate', 'antacids'], severity: 'low', description: 'Aluminum/magnesium-containing antacids may reduce mycophenolate absorption by about 20%.', recommendation: 'Take mycophenolate 1 hour before or 2 hours after antacids.' },
    { drugs: ['azathioprine', 'allopurinol'], severity: 'high', description: 'Allopurinol inhibits xanthine oxidase, the primary enzyme metabolizing azathioprine, dramatically increasing levels and myelosuppression risk.', recommendation: 'Contraindicated. If both needed, reduce azathioprine dose by 75% and monitor CBC weekly.' },

    // ============= Antifungals =============
    { drugs: ['fluconazole', 'warfarin'], severity: 'high', description: 'Fluconazole inhibits CYP2C9, the primary enzyme metabolizing warfarin, significantly increasing INR and bleeding risk.', recommendation: 'Reduce warfarin dose by 25-50%. Monitor INR closely.' },
    { drugs: ['fluconazole', 'phenytoin'], severity: 'moderate', description: 'Fluconazole inhibits CYP2C9, increasing phenytoin levels and risk of toxicity.', recommendation: 'Monitor phenytoin levels closely.' },
    { drugs: ['ketoconazole', 'alprazolam'], severity: 'high', description: 'Ketoconazole potently inhibits CYP3A4, significantly increasing alprazolam levels and risk of excessive sedation.', recommendation: 'Avoid combination or use alternative antifungal.' },
    { drugs: ['ketoconazole', 'simvastatin'], severity: 'high', description: 'Ketoconazole potently inhibits CYP3A4, dramatically increasing simvastatin levels and risk of rhabdomyolysis.', recommendation: 'Contraindicated. Stop simvastatin during ketoconazole therapy.' },
    { drugs: ['voriconazole', 'tacrolimus'], severity: 'high', description: 'Voriconazole potently inhibits CYP3A4, dramatically increasing tacrolimus levels.', recommendation: 'Reduce tacrolimus dose by 66%. Monitor levels very closely.' },

    // ============= Common OTC =============
    { drugs: ['omeprazole', 'aspirin'], severity: 'low', description: 'Omeprazole is often co-prescribed with aspirin for gastroprotection. PPIs reduce the risk of aspirin-induced GI ulceration.', recommendation: 'Beneficial combination. Omeprazole provides gastroprotection.' },
    { drugs: ['omeprazole', 'clopidogrel'], severity: 'high', description: 'Omeprazole inhibits CYP2C19, reducing clopidogrel activation and antiplatelet effect by 40-50%.', recommendation: 'Avoid combination. Use pantoprazole instead if PPI needed.' },
    { drugs: ['cetirizine', 'alcohol'], severity: 'moderate', description: 'Cetirizine (antihistamine) combined with alcohol increases CNS depression and drowsiness.', recommendation: 'Avoid alcohol or use with caution. Do not drive.' },
    { drugs: ['diphenhydramine', 'alcohol'], severity: 'moderate', description: 'Diphenhydramine combined with alcohol increases CNS depression, drowsiness, and impaired coordination.', recommendation: 'Avoid alcohol. Do not drive or operate machinery.' },
    { drugs: ['diphenhydramine', 'omeprazole'], severity: 'low', description: 'Both are metabolized by CYP2C19. No clinically significant interaction at standard doses.', recommendation: 'Safe to combine at recommended doses.' },
    { drugs: ['caffeine', 'ciprofloxacin'], severity: 'moderate', description: 'Ciprofloxacin inhibits CYP1A2, reducing caffeine metabolism. May cause jitteriness, insomnia, and tachycardia.', recommendation: 'Reduce caffeine intake during ciprofloxacin therapy.' },
    { drugs: ['caffeine', 'theophylline'], severity: 'moderate', description: 'Caffeine and theophylline have similar structures. High caffeine intake may reduce theophylline efficacy through competitive binding.', recommendation: 'Maintain consistent caffeine intake. Do not suddenly increase caffeine.' }
  ];

  for (var i = 0; i < interactions.length; i++) {
    var pair = interactions[i].drugs;
    if ((d1.includes(pair[0]) && d2.includes(pair[1])) || (d1.includes(pair[1]) && d2.includes(pair[0]))) {
      return interactions[i];
    }
  }
  return null;
}

// ============= DRUG SAFETY CHECK =============

// Check drug interactions and safety
app.post('/api/clinical/drug-check', async (req, res) => {
  try {
    const { drugs, patientDiagnoses = [] } = req.body;
    if (!drugs || drugs.length === 0) return res.status(400).json({ error: 'drugs array required' });

    const checks = [];

    for (const drug of drugs) {
      try {
        // Get drug label info
        const labelResponse = await axios.get(`${MEDICAL_MCP_URL}/api/drugs/label`, { params: { name: drug } });
        checks.push({
          drug,
          labelInfo: labelResponse.data,
          warnings: labelResponse.data.warnings || 'No warnings available',
          contraindications: labelResponse.data.contraindications || 'No contraindications found'
        });
      } catch (e) {
        checks.push({ drug, error: 'Unable to fetch drug information' });
      }
    }

    // Check for drug interactions and combinations
    const interactions = [];
    if (drugs.length > 1) {
      for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
          try {
            const interactionResponse = await axios.get(`${MEDICAL_MCP_URL}/api/drugs/interactions`, { params: { drug: drugs[i] } });
            const rawInteractions = interactionResponse.data.interactions || [];

            // Filter products that contain BOTH drugs
            const drugLower1 = drugs[i].toLowerCase();
            const drugLower2 = drugs[j].toLowerCase();
            const combinationProducts = rawInteractions.filter(function(item) {
              var name = (item.drug_name || '').toLowerCase();
              return name.includes(drugLower1) && name.includes(drugLower2);
            });

            // Get individual drug products
            const drug1Products = rawInteractions.filter(function(item) {
              var name = (item.drug_name || '').toLowerCase();
              return name.includes(drugLower1) && !name.includes(drugLower2);
            }).slice(0, 3);

            const drug2Products = rawInteractions.filter(function(item) {
              var name = (item.drug_name || '').toLowerCase();
              return name.includes(drugLower2) && !name.includes(drugLower1);
            }).slice(0, 3);

            // Determine interaction severity based on known drug interactions
            var severity = 'info';
            var description = '';
            var recommendation = '';

            var knownInteractions = getKnownInteraction(drugs[i], drugs[j]);
            if (knownInteractions) {
              severity = knownInteractions.severity;
              description = knownInteractions.description;
              recommendation = knownInteractions.recommendation;
            } else if (combinationProducts.length > 0) {
              severity = 'moderate';
              description = 'These drugs are available as combination products, indicating they are commonly used together. However, concurrent use may increase the risk of side effects.';
              recommendation = 'Consult a healthcare professional before combining these medications.';
            } else {
              severity = 'low';
              description = 'No well-documented direct interactions found between ' + drugs[i] + ' and ' + drugs[j] + ' in available databases.';
              recommendation = 'Always inform your healthcare provider of all medications you are taking.';
            }

            interactions.push({
              drug1: drugs[i],
              drug2: drugs[j],
              severity: severity,
              description: description,
              recommendation: recommendation,
              combinationProducts: combinationProducts.map(function(p) { return p.drug_name; }).slice(0, 5),
              relatedProducts: {
                drug1Only: drug1Products.map(function(p) { return p.drug_name; }),
                drug2Only: drug2Products.map(function(p) { return p.drug_name; })
              }
            });
          } catch (e) {
            interactions.push({
              drug1: drugs[i],
              drug2: drugs[j],
              severity: 'unknown',
              description: 'Unable to retrieve interaction data for these drugs.',
              recommendation: 'Please consult a pharmacist or physician for interaction information.',
              combinationProducts: [],
              relatedProducts: { drug1Only: [], drug2Only: [] }
            });
          }
        }
      }
    }

    res.json({ drugs, checks, interactions, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= CLINICAL CALCULATOR =============

app.get('/api/clinical/calculator/:calculatorId', async (req, res) => {
  try {
    const { calculatorId } = req.params;
    const params = req.query;

    const response = await axios.get(`${OPEN_MEDICINE_URL}/api/calculators/${calculatorId}`, { params });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= GUIDELINE LOOKUP =============

app.get('/api/clinical/guideline/:guidelineId', async (req, res) => {
  try {
    const { guidelineId } = req.params;
    const response = await axios.get(`${OPEN_MEDICINE_URL}/api/guidelines/${guidelineId}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= PATIENT CONTEXT =============

// Get patient clinical context from OpenMRS
app.get('/api/clinical/patient/:uuid/context', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Fetch patient info from OpenMRS
    const patientResponse = await axios.get(`${OPENMRS_URL}/openmrs/ws/rest/v1/patient/${uuid}`, {
      params: { v: 'full' }
    });

    // Fetch recent diagnoses
    const diagnosisResponse = await axios.get(`${OPENMRS_URL}/openmrs/ws/rest/v1/bahmnicore/diagnosis`, {
      params: { patientUuid: uuid }
    });

    // Fetch active medications
    const medicationResponse = await axios.get(`${OPENMRS_URL}/openmrs/ws/rest/v1/bahmnicore/activeDrugOrders`, {
      params: { patientUuid: uuid }
    });

    const patient = patientResponse.data;
    const diagnoses = (diagnosisResponse.data || []).slice(0, 5);
    const medications = (medicationResponse.data || []).filter(m => m.orderType === 'Drug order');

    res.json({
      patient: {
        uuid: patient.uuid,
        name: `${patient.person.preferredName.givenName} ${patient.person.preferredName.familyName}`,
        gender: patient.person.gender,
        age: patient.person.age
      },
      diagnoses: diagnoses.map(d => ({
        name: d.codedAnswer?.name?.display || d.freeTextAnswer,
        order: d.order,
        date: d.obsDatetime
      })),
      medications: medications.map(m => ({
        drug: m.drug?.name || m.drugName,
        dose: m.dose,
        units: m.units,
        frequency: m.frequency
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch patient context', details: error.message });
  }
});

// ============= WHO HEALTH STATS =============

app.get('/api/clinical/who-stats', async (req, res) => {
  try {
    const { country = 'ET' } = req.query;
    const response = await axios.get(`${MEDICAL_MCP_URL}/api/who/health-stats`, { params: { country } });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Bahmni CDSS Integration running on port ${PORT}`);
});
