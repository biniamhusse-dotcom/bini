const winston = require('winston');
const emr = require('../modules/emr');
const eapts = require('../modules/eapts');
const mapping = require('../modules/mapping_dtp');
const logger = require('../modules/logger');

module.exports.dtpService = async () => {
  winston.info('Connection established to capture DTP Cases...');
  const responseBuilder = [];

  const dtpURL = process.env.DTPEaptsURL;
  const url = process.env.DTP_API;
  const fileName = '../DTPLog/dtpEaptsResponse.txt';
  const insert_dtp_url = process.env.INSERT_DTP;

  try {
    const eaptsResponse = await eapts.get(dtpURL);
    const { model: models } = JSON.parse(eaptsResponse.body);

    const dtpCasesLog = { dtpCases: [] };


    for (const model of models) {
      const { prescriptionDetails, codeOfDtps, modifiedBy } = model;

      prescriptionDetails.forEach((element) => {
        dtpCasesLog.dtpCases.push(element);
      });

      //console.log(codeOfDtps);
      const dtpCases = codeOfDtps
        .map((codeOfDtp) => `Code:-${codeOfDtp.dtp.code}, Description:-${codeOfDtp.fullDtpDescription}${codeOfDtp.dtpReason != null ? `, Other Reason: ${codeOfDtp.dtpReason}` : ''}`)
        .join(' ');
      //console.log(dtpCases)
      for (const prescriptionDetail of prescriptionDetails) {
        const { orderNumber, modifiedDate } = prescriptionDetail;
        //Check order no
        var temp = await logger.checkOrderNo(orderNumber, fileName);
        if (!temp) {
          var postOrderNo = {
            "orderNumber": orderNumber
          };
          const modifiedurl = url + '&orderNumber=' + orderNumber;
          console.log(modifiedurl);
          try {
            if (modifiedurl) {
              const result = await emr.get(modifiedurl);
              const emrData = JSON.parse(result.body);

              try {
                const mappingResponse = await mapping.mappingRequest(emrData, dtpCases, modifiedDate, modifiedBy);
                // console.log(mappingResponse.drugOrders);
                if (mappingResponse != undefined && mappingResponse.length != 0) {
                  for (const insertData of mappingResponse) {
                    if (insertData.length !== 0) {
                      const insertResponse = await emr.post(insert_dtp_url, insertData);
                      if (insertResponse.statusCode == 500) {
                        winston.error(insertResponse.body.error.message + " with orderNumber: " + orderNumber);
                        logger.appendFile('../DTPLog/errorDTP.txt', orderNumber);
                        logger.appendFile('../DTPLog/errorDTP.txt', insertResponse);
                      }

                      if (insertResponse.body.drugOrders && insertResponse.body.drugOrders.length !== 0) {
                        //winston.info(insertResponse.body);
                        winston.info('DTP inserted!' + " with orderNumber: " + orderNumber);
                        logger.appendFile('../DTPLog/successfulDTP.txt', insertResponse);
                      }
                    } else {
                      winston.error('No mapped data');
                    }
                  }
                }
                else {
                  console.log('No mapped data');
                }
              } catch (error) {
                winston.error(error, 'Failed on mapping response');
              }
            }
          } catch (error) {
            winston.error(error, 'Failed on mapping response');
          }
          logger.appendFile('../DTPLog/dtpEaptsResponse.txt', postOrderNo);
        }
        else {
          winston.info("No new dtp case");
        }

      }
    }



  } catch (error) {
    winston.error(error, 'Failed on reading from file');
  }

  return responseBuilder;
};
