// Replaces all occurrences of a string within another string
function replaceString(str, toReplace, replaceWith) {
  return str.replace(new RegExp(toReplace, 'g'), replaceWith);
}

// Modifies JSON objects as strings
function JsonAsString(model) {
  return model.map(element => {
    const jsonString = JSON.stringify(element);
    const replacedString = replaceString(
      replaceString(
        replaceString(
          replaceString(
            replaceString(
              replaceString(jsonString, /"genericName"/g, '"concept"'),
              /"productName"/g, '"name"'
            ),
            /"dosage"/g, '"dosageForm"'
          ),
          /null/g, '"N/A"'
        ),
        / - /g, '-'
      ),
      /in\(/g, 'in ('
    );
    const parsedJson = JSON.parse(replacedString);

    parsedJson.uuid = parsedJson.itemUuid;
    parsedJson.combination = false;
    parsedJson.description = '';
    delete parsedJson.itemUuid;
    delete parsedJson.unit;
    delete parsedJson.names;
    delete parsedJson.datatype;
    delete parsedJson.conceptClass;

    return parsedJson;
  });
}

// Filters unique JSON objects based on an array property
function filterUniqueJSON(jsonArray, property) {
  const uniqueSet = new Set();
  const uniqueJSON = [];

  jsonArray.forEach(json => {
    const propertyValue = Array.isArray(json[property]) ? JSON.stringify(json[property]) : json[property];
    if (!uniqueSet.has(propertyValue)) {
      uniqueSet.add(propertyValue);
      uniqueJSON.push(json);
    }
  });

  return uniqueJSON;
}

// Generates dosage form based on the model
function generateDosageForm(model) {
  model.forEach(element => {
    element.conceptClass = "Misc";
    element.datatype = "N/A";
    element.names = [{
      name: element.dosage != null ? element.dosage : "N/A",
      locale: "en",
      localePreferred: true,
      conceptNameType: "FULLY_SPECIFIED"
    }];
  });

  const uniqueArray = filterUniqueJSON(model, "names");
  const newArray = filterJson(uniqueArray);
  return newArray;
}

// Filters unwanted properties from JSON objects
function filterJson(params) {
  const filteredParams = params.map(element => {
    const {
      genericName,
      productName,
      strength,
      dosage,
      unit,
      itemUuid,
      uuid,
      ...filteredElement
    } = element;
    return filteredElement;
  });

  return filteredParams;
}

// Generates generic form based on the model
function generateGenericForm(model) {
  model.forEach(element => {
    var genericName = element.genericName.replace(/\+/g, "&");
    element.conceptClass = "Drug";
    element.datatype = "N/A";
    element.names = [{
      "name": genericName != null ? genericName : "N/A",
      "locale": "en",
      "localePreferred": true,
      "conceptNameType": "FULLY_SPECIFIED"
    }]
  });

  const uniqueArray = filterUniqueJSON(model, "names");
  const newArray = filterJson(uniqueArray);
  return newArray;
}

// Converts address models to a specific format
function addressToFormat(models) {
  return new Promise((resolve, reject) => {
    const modifiedData = models.map(item => ({
      '': item.regionName + ">" + item.regionRowguid + "," + item.zoneName + ">" + item.zoneRowguid + "," + item.woredaName + ">" + item.woredaRowguid
    }));

    return resolve(modifiedData);
  });
}

// Exporting functions as module exports
module.exports.JsonAsString = JsonAsString;
module.exports.generateGenericForm = generateGenericForm;
module.exports.generateDosageForm = generateDosageForm;
module.exports.addressToFormat = addressToFormat;
