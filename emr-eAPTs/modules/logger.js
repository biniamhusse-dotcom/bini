const fs = require('fs');
const winston = require('winston');
const path = require('path');

const json2csv = require('json2csv').parse;

//Write File
const writef = (fileName, data) => {
  const toresolve = JSON.stringify(data);
  fs.writeFile(path.resolve(__dirname, fileName), toresolve, (err) => {
    if (err) {
      winston.info("Failed to write to file");
      throw err;
    }
    winston.info("Successfully wrote to file");
  });
};

//Write CSV
const writeCSV = (folderName, fileName, data) => {
  const newFolderPath = path.resolve(__dirname, folderName);
  fs.writeFile(path.resolve(newFolderPath, fileName), data, (err) => {
    if (err) {
      winston.info("Failed to write to file");
      throw err;
    }
    winston.info("Successfully wrote to file");
  });
};

//Read File
const readf = (fileName) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, fileName), 'utf8', (err, data) => {
      if (err) {
        winston.info(err);
        return;
      }
      resolve(data);
    });
  });
};

//Append to file
const appendFile = (fileName, data) => {
  const toresolve = JSON.stringify(data);
  fs.appendFile(path.resolve(__dirname, fileName), toresolve, (err) => {
    if (err) {
      winston.info("Failed to write to file");
      throw err;
    }
    winston.info("Successfully wrote to file");
  });
};

//Check if order number exist for dtp and dispense cases
const checkOrderNo = (orderNumber, fileName) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, fileName), 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      if (data.includes(orderNumber)) {
        console.log("Order number exists: " + orderNumber);
        resolve(true);
      } else {
        console.log("Order number does not exist");
        resolve(false);
      }
    });
  });
};

//Check if woreda UUID already exist in the address file file
const checkWoredaUUID = (uuid, fileName) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(__dirname, fileName), 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
        return;
      }
      if (data.includes(uuid)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
};

//Convert JSON to CSV format
function convertJSONtoCSV(jsonData, csvFilePath) {
  return new Promise((resolve, reject) => {
    try {
      // Convert JSON to CSV string
      const csvData = json2csv(jsonData, { header: true });
      // Write CSV data to file
      fs.writeFile(path.resolve(__dirname, csvFilePath), csvData, 'utf-8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  writeFile: writef,
  readFile: readf,
  appendFile,
  writeCSV,
  checkOrderNo,
  checkWoredaUUID,
  convertJSONtoCSV
};
