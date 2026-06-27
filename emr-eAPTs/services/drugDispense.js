const winston = require('winston');
const emr = require('../modules/emr');
const eapts = require('../modules/eapts');
const mapping = require('../modules/mapping_dispense');
const logger = require('../modules/logger');

module.exports.dispenseService = async () => {
  winston.info('Connection established to capture dispense Cases...');
  const responseBuilder = [];

  const fileName = '../DispenseLog/dispenseOrderNo.txt';
  const dispenseURL = process.env.DispenseURL;
  const url = process.env.DTP_API;
  const insert_dispense_url = process.env.INSERT_DTP;

  try {
    // Fetch dispense data from eapts
    const eaptsResponse = await eapts.get(dispenseURL);
    const { model: models } = JSON.parse(eaptsResponse.body);

    const dispenseCasesLog = { dispenseCases: [] };

    for (const model of models) {
      const { prescriptionDetails, modifiedBy } = model;

      // Collect dispense cases for logging
      prescriptionDetails.forEach((element) => {
        dispenseCasesLog.dispenseCases.push(element);
      });

      for (const prescriptionDetail of prescriptionDetails) {
        const { orderNumber, modifiedDate } = prescriptionDetail;

        // Check if orderNumber has been previously processed
        var temp = await logger.checkOrderNo(orderNumber, fileName);
        if (!temp) {
          var postOrderNo = {
            "orderNumber": orderNumber
          };

          const modifiedurl = url + '&orderNumber=' + orderNumber;
          console.log(modifiedurl);

          try {
            if (modifiedurl) {
              // Retrieve data from EMR using the modifiedurl
              const result = await emr.get(modifiedurl);
              const emrData = JSON.parse(result.body);
              console.log(modifiedDate);

              try {
                // Perform mapping of EMR data to DTP format
                const mappingResponse = await mapping.mappingRequest(emrData, modifiedDate);
                if (mappingResponse !== 0 && mappingResponse != undefined) {
                  for (const insertData of mappingResponse) {
                    // Insert dispense data into DTP system
                    const insertResponse = await emr.post(insert_dispense_url, insertData);
                    if (insertResponse.statusCode == 500) {
                      winston.error(insertResponse.body.error.message + " with orderNumber: " + orderNumber);
                    }
                    if (insertResponse.body.drugOrders && insertResponse.body.drugOrders.length !== 0) {
                      winston.info(insertResponse.body);
                      winston.info('Dispense inserted!' + " with orderNumber: " + orderNumber);
                    }
                  }
                } else {
                  winston.error('No mapped data');
                }
              } catch (error) {
                winston.error(error, 'Failed on mapping response');
              }
            }
          } catch (error) {
            winston.error(error, 'Failed on mapping response');
          }

          // Log the processed orderNumber and dispenseCases
          logger.appendFile(fileName, postOrderNo);
          logger.appendFile('../DispenseLog/dispenseLog.txt', dispenseCasesLog);
        } else {
          console.log("No new dispense case");
        }
      }
    }
  } catch (error) {
    winston.error(error, 'Failed on reading from file');
  }

  return responseBuilder;
};
