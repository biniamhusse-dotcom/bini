const winston = require('winston');
const eapts = require('../modules/eapts');
const emr = require('../modules/emr');
const modifyJson = require('../modules/modifyJson');

module.exports.drugSync = async () => {
  winston.info("Connection established to capture New Item (Drug)...");

  try {
    const responseBuilder = [];
    const drugSyncURL = process.env.DrugSyncEaptsURL;

    // Fetch drug sync data from eapts
    const eaptsResponse = await eapts.get(drugSyncURL);
    const resp = JSON.parse(eaptsResponse.body);
    const model = resp.model;
    const drugUploadURL = process.env.DrugUploadEMR;
    const conceptUploadURL = process.env.ConceptUploadEMR;
    const newDrug = [];

    // Check for new drugs that need to be synced
    for (const element of model) {
      const changedURL = drugUploadURL + "/" + element.itemUuid;

      try {
        const checkDrugAvailability = await emr.get(changedURL);
        if (checkDrugAvailability.statusCode === 404) {
          newDrug.push(element);
        }
      } catch (error) {
        // Handle any errors that occur during the execution
      }
    }

    try {
      if (newDrug.length == 0) {
        winston.info("No new drug to sync");
      }

      // Generate dosage form data and sync with EMR
      const dosageForm = modifyJson.generateDosageForm(newDrug);
      let responseDosage;
      for (const dosage of dosageForm) {
        responseDosage = await emr.post(conceptUploadURL, dosage);
        console.log(dosage);
        if (responseDosage.statusCode == 201) {
          winston.info("Dosage form added!");
        } else {
          winston.info("Dosage form already exists!");
        }
      }
    } catch (error) {
      winston.info("Dosage form sync failed!");
    }

    try {
      // Generate generic form data and sync with EMR
      const genericToUpload = newDrug;
      const genericForm = modifyJson.generateGenericForm(genericToUpload);
      let responseGeneric;
      for (const generic of genericForm) {
        responseGeneric = await emr.post(conceptUploadURL, generic);
        console.log(generic);
        if (responseGeneric.statusCode == 201) {
          winston.info("Generic form added!");
        } else {
          winston.info("Generic form already exists!");
        }
      }
    } catch (error) {
      winston.info("Generic form sync failed!");
    }

    try {
      // Sync new drug data with EMR
      const drugList = modifyJson.JsonAsString(newDrug);
      let responseDrug;
      for (const drug of drugList) {
        responseDrug = await emr.post(drugUploadURL, drug);
        console.log(drug);
        if (responseDrug.statusCode == 201) {
          winston.info("New drug added!");
        } else {
          winston.info("Drug already exists!");
        }
      }
    } catch (error) {
      winston.info("Drug sync failed!");
    }

    return responseBuilder;
  } catch (error) {
    winston.info("Drug fetch failed!");
    return [];
  }
};
