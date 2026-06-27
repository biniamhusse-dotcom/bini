const winston = require('winston')

//Mapping for DTP (Rejected Prescription)
function mappingRequest(emrData, dtpCases, dtpDate, cancellerID) {
  var sendData = [];
  if (emrData.length != 0) {
    var today = new Date(); //Change dateActivated, autoExpire & scheduledDate with dtpDate
    //Change to this on deployment var newDTPDate = new Date(dtpDate);
    return new Promise(function (resolve, reject) {
      var providers = [];
      var drugOrders = [];
      var provider = {
        "uuid": emrData[0].providers_uuid != undefined ? emrData[0].providers_uuid : null,
        "name": emrData[0].providers_name != undefined ? emrData[0].providers_name : null,
        "encounterRoleUuid": "a0b03050-c99b-11e0-9572-0800200c9a66" //is this for all facility
      }
      var drugOrder = {
        "visit": {
          "uuid": emrData[0].visitUuid != undefined ? emrData[0].visitUuid : null,
          "startDateTime": emrData[0].startDateTime != undefined ? emrData[0].startDateTime : null,
        },
        "provider": {
          provider
        },
        "orderAttributes": null,
        "retired": false,
        "creatorName": emrData[0].providers_name != undefined ? emrData[0].providers_name : null,
        "concept": {
          "uuid": emrData[0].concept_uuid != undefined ? emrData[0].concept_uuid : null,
          "name": emrData[0].concept_name != undefined ? emrData[0].concept_name : null,
          "dataType": emrData[0].dataType != undefined ? emrData[0].dataType : null,
          "shortName": emrData[0].concept_name != undefined ? emrData[0].concept_name : null,
          "conceptClass": emrData[0].conceptClass != undefined ? emrData[0].conceptClass : null,
          "hiNormal": null,
          "lowNormal": null,
          "set": false,
          "mappings": []
        },
        "orderGroup": null,
        "instructions": null,
        "dateActivated": today,
        "autoExpireDate": today,
        "dateStopped": null,
        "scheduledDate": today,
        //"autoExpireDate": emrData[0].autoExpireDate!=undefined ? emrData[0].autoExpireDate : null,
        //"scheduledDate": emrData[0].scheduledDate!=undefined ? emrData[0].scheduledDate : null,

        "commentToFulfiller": cancellerID, //ID of the person who modified the prescription 
        "orderNumber": emrData[0].order_number,
        "careSetting": "OUTPATIENT",
        "orderType": "Drug Order",
        "effectiveStartDate": emrData[0].dateCreated,
        "effectiveStopDate": emrData[0].autoExpireDate,
        "sortWeight": null,
        "drug": {
          "name": emrData[0].drug_name,
          "uuid": emrData[0].drug_uuid,
          "form": emrData[0].form,
          "strength": emrData[0].strength
        },
        "dosingInstructions": {
          "dose": emrData[0].dose,
          "doseUnits": emrData[0].dose_units,
          "route": emrData[0].route,
          "frequency": emrData[0].frequency,
          "asNeeded": emrData[0].asNeeded,
          "administrationInstructions": emrData[0].dosing_instructions,
          "quantity": emrData[0].quantity,
          "quantityUnits": emrData[0].dose_units,
          "numberOfRefills": null
        },
        "durationUnits": emrData[0].durationUnits,
        "drugNonCoded": null,
        "orderReasonConcept": {
          "name": "DTP Case",
          "uuid": emrData[0].orderReasonConcept_uuid,
        },
        "orderReasonText": dtpCases, //DTP
        "dosingInstructionType": emrData[0].dosingInstructionType,
        "previousOrderUuid": emrData[0].previousUUID,
        "duration": emrData[0].duration,
        "action": "DISCONTINUE" //Change
      }

      providers.push(provider);
      drugOrders.push(drugOrder);

      var dtpCase = {
        "locationUuid": emrData[0].locationUuid,
        "patientUuid": emrData[0].patientUuid,
        "encounterUuid": emrData[0].encounterUuid,
        "visitUuid": emrData[0].visitUuid,
        "providers": providers,
        "encounterDateTime": new Date(emrData[0].encounter_datetime),
        "extensions": {
          "mdrtbSpecimen": []
        },
        "context": {},
        "visitType": "OPD",
        "bahmniDiagnoses": [],
        "orders": [],
        drugOrders,
        "disposition": null,
        "observations": [],
        "encounterTypeUuid": emrData[0].uuid
      }
      sendData.push(dtpCase);
      return resolve(sendData)

    })
  }
}

module.exports.mappingRequest = mappingRequest
