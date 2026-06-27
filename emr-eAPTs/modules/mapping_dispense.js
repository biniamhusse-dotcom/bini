const winston = require('winston')

//Mapping for order that was dispensed
function mappingRequest(emrData, dispenseDate) {
  var sendData = [];
  if (emrData.length != 0) {
    return new Promise(function (resolve, reject) {
      var providers = [];
      var provider = {
        "uuid": emrData[0].providers_uuid != undefined ? emrData[0].providers_uuid : null,
        "name": emrData[0].providers_name != undefined ? emrData[0].providers_name : null,
        "encounterRoleUuid": "a0b03050-c99b-11e0-9572-0800200c9a66" //is this for all facility
      }
      providers.push(provider);
      var dispenseCase = {
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
        "visitType": emrData[0].visitType,
        "bahmniDiagnoses": [],
        "orders": [],
        "drugOrders": [],
        "disposition": null,
        "observations": [{
          "value": true,
          "orderUuid": emrData[0].previousUUID,
          "concept": {
            "uuid": emrData[0].dispensed_uuid
          },
          "groupMembers": []
        }],

        "encounterTypeUuid": emrData[0].uuid
      }
      sendData.push(dispenseCase);
      return resolve(sendData)
    }
    )
  }
}




module.exports.mappingRequest = mappingRequest
