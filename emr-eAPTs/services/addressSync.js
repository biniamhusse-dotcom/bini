const winston = require('winston');
const emr = require('../modules/emr');
const eapts = require('../modules/eapts');
const modifyJson = require('../modules/modifyJson');
const logger = require('../modules/logger');

module.exports.addressService = async () => {
  winston.info('Connection established to capture address sync...');
  const responseBuilder = [];
  const fileName_csv = '../AddressLog/addressHierarchy.csv';
  const addressURL = process.env.AddressEaptsURL;
  const insert_address_url = process.env.AddressUploadEMR;
  const login_url = process.env.InitalLogin;
  const username = process.env.EMRUserName;
  const password = process.env.EMRPassword;

  try {
    // Fetch address data from eapts
    const eaptsResponse = await eapts.get(addressURL);
    const { model: models } = JSON.parse(eaptsResponse.body);

    try {
      // Convert address data to CSV format
      const csvData = await modifyJson.addressToFormat(models);
      try {
        // Save address CSV to file
        await logger.convertJSONtoCSV(csvData, fileName_csv);
        winston.info('Address converted to CSV');
      } catch (error) {
        winston.error(error, 'Failed converting address to CSV');
      }

      const fileToPost = await logger.readFile(fileName_csv);

      const loginModel = {
        username: username,
        password: password,
        locale: "en"
      };

      try {
        // Perform login to obtain cookies
        const loginResponse = await emr.post(login_url, loginModel);
        console.log(loginResponse);
        try {
          // Upload the address data using the obtained cookies
          const insertResponse = await emr.postFile(insert_address_url, loginResponse.cookie[0]);
          winston.info(new Date());
          winston.info(insertResponse.statusCode);
        } catch (error) {
          winston.error(error, 'Failed posting the address');
        }
      } catch (error) {
        winston.error(error, 'Failed performing login');
      }
    } catch (error) {
      winston.error(error, 'Failed converting address to CSV or posting');
    }
  } catch (error) {
    winston.error(error, 'Failed on reading from file');
  }

  return responseBuilder;
};
