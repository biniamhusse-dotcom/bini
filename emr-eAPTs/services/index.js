const winston = require('winston');
const emr = require('../modules/emr');
const eapts = require('../modules/eapts');
const mapping = require('../modules/mapping');
const logger = require('../modules/logger');
const { checkOrdersExist, updatePatientPaymentType, updatePatientBillingInfo, findPatientByCardNumber } = require('../modules/daguDb');
const { getPatientPaymentType } = require('../modules/emr');

var emrResponse;
var mappingResponse;

module.exports.eaptsService = async () => {
  winston.info("eAPTs service triggered");
  winston.info("Connection established to send EMR data to eAPTs...");
  const responseBuilder = [];
  var url = process.env.API; // Ask for information from the recentEncounter encouneter
  try {
    var pn = await logger.readFile("../orderNumber.json");
    prescNo = JSON.parse(pn); // Read prescription no and order no
    var modifiedurl = url + "&orderNumber=" + prescNo.orderNumber;

    // Send data to EMR API
    try {
      emrResponse = await emr.get(modifiedurl);
      var orderNoArray = [];
      if (emrResponse.body != undefined) {
        emrData = JSON.parse(emrResponse.body);
        
        // Filter by checkpoint: only process orders with orderNumber > last checkpoint
        var lastOrderNumber = prescNo.orderNumber;
        var filteredData = {};
        for (var key in emrData) {
          if (emrData[key].orderNumber > lastOrderNumber) {
            var prescriptionNumber = emrData[key].rowGuid;
            if (!filteredData[prescriptionNumber]) {
              filteredData[prescriptionNumber] = [];
            }
            filteredData[prescriptionNumber].push(emrData[key]);
          }
        }
        var objectWithGroupByPN = filteredData;
        if (Object.keys(objectWithGroupByPN).length === 0) {
          winston.info("No new orders since checkpoint " + lastOrderNumber);
          return responseBuilder;
        }
        
        // Map data
        try {
          const eapts_url = process.env.EaptsURL;
          mappingResponse = await mapping.mappingRequest(objectWithGroupByPN);
          if (mappingResponse != undefined) {
            for (i = 0; i < mappingResponse.length; i++) {
              console.log(mappingResponse[i]);
              if (mappingResponse[i].prescriptionDetails != undefined) {
                // Send mapped data to eAPTs
                try {
                  const eaptsResponse = await eapts.post(eapts_url, mappingResponse[i]);
                  if (eaptsResponse.body != undefined && eaptsResponse.statusCode == 200) {
                    console.log("Prescription Sent! Response:", JSON.stringify(eaptsResponse.body));
                  } else {
                    console.log("Prescription Not Sent! Status:", eaptsResponse.statusCode, "Body:", JSON.stringify(eaptsResponse.body));
                  }
                } catch (postError) {
                  console.log("Prescription POST Error:", postError.message, postError.stack);
                }

                for (j = 0; j < mappingResponse[i].prescriptionDetails.length; j++) {
                  // Go inside the prescription to get order id
                  if (mappingResponse[i].prescriptionDetails[j] != undefined) {
                    var lastOrderNumber = mappingResponse[i].prescriptionDetails[j].orderNumber;
                    if (lastOrderNumber != null && lastOrderNumber != undefined) {
                      orderNoArray.push(lastOrderNumber);
                    }
                  }
                }
              }
            }

            // Once the eAPTs requests are done, take the maximum order number and write it to the file
            const max = orderNoArray.length != 0 ? Math.max(...orderNoArray) : null;
            var prescriptionNumber = {
              "orderNumber": max
            };
            console.log(orderNoArray.length);
            if (max != null && max != undefined) {
              logger.writeFile("../orderNumber.json", prescriptionNumber);
            }
          }
        } catch (error) {
          console.log(error + " " + "Failed on mapping response");
        }
      }
    } catch (error) {
      console.log(error + " " + "Failed on EMR response");
    }
  } catch (error) {
    console.log(error + " " + "Failed on reading from file");
  }

  return responseBuilder;
};

module.exports.eaptsServiceSingle = async (encounterUuid) => {
  winston.info("eAPTs single-order service triggered for encounter: " + encounterUuid);
  const responseBuilder = [];
  var url = process.env.API;
  try {
    var pn = await logger.readFile("../orderNumber.json");
    prescNo = JSON.parse(pn);
    var modifiedurl = url + "&orderNumber=0";

    try {
      emrResponse = await emr.get(modifiedurl);
      if (emrResponse.body != undefined) {
        emrData = JSON.parse(emrResponse.body);

        var filteredData = {};
        for (var key in emrData) {
          if (emrData[key].rowGuid === encounterUuid) {
            var prescriptionNumber = emrData[key].rowGuid;
            if (!filteredData[prescriptionNumber]) {
              filteredData[prescriptionNumber] = [];
            }
            filteredData[prescriptionNumber].push(emrData[key]);
          }
        }

        if (Object.keys(filteredData).length === 0) {
          winston.warn("No order found with encounter UUID: " + encounterUuid);
          return responseBuilder;
        }

        try {
          const eapts_url = process.env.EaptsURL;
          mappingResponse = await mapping.mappingRequest(filteredData);
          if (mappingResponse != undefined) {
            var orderNoArray = [];
            for (i = 0; i < mappingResponse.length; i++) {
              if (mappingResponse[i].prescriptionDetails != undefined && mappingResponse[i].prescriptionDetails.length > 0) {
                const orderNumbers = mappingResponse[i].prescriptionDetails.map(d => String(d.orderNumber));
                const institutionId = mappingResponse[i].institutionId;

                const existingOrders = await checkOrdersExist(orderNumbers, institutionId);
                if (existingOrders.length > 0) {
                  const existingOrderNums = existingOrders.map(r => String(r.order_number));
                  const newOrderNums = orderNumbers.filter(n => !existingOrderNums.includes(String(n)));
                  if (newOrderNums.length === 0) {
                    winston.info("All orders already active in Dagu, skipping: " + orderNumbers.join(', ') + " (institution: " + institutionId + ")");
                    return responseBuilder;
                  }
                  winston.info("Some orders already in Dagu, sending only new orders: " + newOrderNums.join(', '));
                }

                try {
                  const eaptsResponse = await eapts.post(eapts_url, mappingResponse[i]);
                  if (eaptsResponse.body != undefined && eaptsResponse.statusCode == 200) {
                    console.log("Single Prescription Sent! Response:", JSON.stringify(eaptsResponse.body));
                    try {
                      const respBody = typeof eaptsResponse.body === 'string' ? JSON.parse(eaptsResponse.body) : eaptsResponse.body;
                      const patientId = respBody.model && respBody.model.patientId;
                      const patientRowGuid = mappingResponse[i].patient && mappingResponse[i].patient.rowGuid;
                      console.log("Billing update check: patientId=" + patientId + ", patientRowGuid=" + patientRowGuid);
                      if (patientId && patientRowGuid) {
                        const billingInfo = await getPatientPaymentType(patientRowGuid);
                        const sponsorId = await require('../modules/daguDb').resolveSponsorId(billingInfo.creditCompanyUuid);
                        console.log("Resolved billing: payment=" + billingInfo.paymentTypeUuid + ", sponsor=" + sponsorId + ", insurance=" + billingInfo.referenceNumber);
                        await updatePatientBillingInfo(patientId, billingInfo.paymentTypeUuid, sponsorId, billingInfo.referenceNumber);
                        console.log("Billing info updated for patient " + patientId);
                      }
                    } catch (updateErr) {
                      console.log("Billing update failed: " + updateErr.message);
                    }
                  } else {
                    console.log("Single Prescription Not Sent! Status:", eaptsResponse.statusCode, "Body:", JSON.stringify(eaptsResponse.body));
                  }
                } catch (postError) {
                  console.log("Single Prescription POST Error:", postError.message);
                }

                for (j = 0; j < mappingResponse[i].prescriptionDetails.length; j++) {
                  if (mappingResponse[i].prescriptionDetails[j] != undefined) {
                    var lastOrderNumber = mappingResponse[i].prescriptionDetails[j].orderNumber;
                    if (lastOrderNumber != null && lastOrderNumber != undefined) {
                      orderNoArray.push(lastOrderNumber);
                    }
                  }
                }
              }
            }

            const max = orderNoArray.length != 0 ? Math.max(...orderNoArray) : null;
            if (max != null && max != undefined && max > prescNo.orderNumber) {
              var prescriptionNumber = { "orderNumber": max };
              logger.writeFile("../orderNumber.json", prescriptionNumber);
            }
          }
        } catch (error) {
          console.log(error + " " + "Failed on single mapping response");
        }
      }
    } catch (error) {
      console.log(error + " " + "Failed on EMR response for single order");
    }
  } catch (error) {
    console.log(error + " " + "Failed on reading from file");
  }

  return responseBuilder;
};
