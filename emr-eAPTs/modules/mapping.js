const winston = require('winston');
const path = require('path');
const fs = require('fs');

const FREQUENCY_UUID_MAP = {
  'd46ae114-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd46b3ffe-5e07-11ef-8f7c-0242ac120002': '1942d7a9-0039-4904-94bc-1cc87e9069cf',
  'd46b7993-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd46bafec-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd4704115-5e07-11ef-8f7c-0242ac120002': '9d8e6918-3f10-11e4-adec-0800271c1b75',
  'd556eaac-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5573edd-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd557a1e4-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5580383-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5585e8a-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd558c434-5e07-11ef-8f7c-0242ac120002': '334ea16c-8a92-11e4-977f-0800271c1b75',
  'd5592067-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5596cd5-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55a4fc8-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55aa463-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55af304-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55b3879-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55b7bda-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd55bc037-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5d7b695-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5d80cd5-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5d858de-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
  'd5d8b2a7-5e07-11ef-8f7c-0242ac120002': '44bead48-74a0-4107-a09d-e52be2c25803',
};

const DEFAULT_FREQUENCY_UUID = '44bead48-74a0-4107-a09d-e52be2c25803';

function resolveFrequencyTypeId(frequencyTypeId) {
  if (!frequencyTypeId || frequencyTypeId === '') return DEFAULT_FREQUENCY_UUID;
  const mapped = FREQUENCY_UUID_MAP[frequencyTypeId];
  if (mapped) {
    winston.info(`Frequency mapped: ${frequencyTypeId} -> ${mapped}`);
    return mapped;
  }
  winston.info(`Frequency passed through (already Dagu UUID): ${frequencyTypeId}`);
  return frequencyTypeId;
}

const configPath = path.resolve(__dirname, '../location-mapping.json');
const selectedInstitutionPath = path.resolve(__dirname, '../selected-institution.json');

function loadSelectedInstitution() {
  try {
    const data = fs.readFileSync(selectedInstitutionPath, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed.institutionId) return parsed.institutionId;
  } catch (e) {}
  return null;
}

function loadLocationConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    winston.warn('Failed to load location-mapping.json, using defaults:', e.message);
    return {
      defaultInstitutionId: 'c1704170-564b-4cdb-b742-11e05b6da50c',
      locationInstitutionMap: {},
      loginLocationMapping: [],
    };
  }
}

function resolveInstitutionId(locationName) {
  const selected = loadSelectedInstitution();
  if (selected) return selected;
  const config = loadLocationConfig();
  const { defaultInstitutionId, locationInstitutionMap, loginLocationMapping } = config;
  if (!locationName) return defaultInstitutionId;
  const name = locationName.toUpperCase();
  const direct = locationInstitutionMap[locationName];
  if (direct) return direct;
  for (const rule of loginLocationMapping) {
    if (!rule.keywords || !rule.dispUnit) continue;
    for (const kw of rule.keywords) {
      if (name.includes(kw)) {
        return locationInstitutionMap[rule.dispUnit] || defaultInstitutionId;
      }
    }
  }
  return defaultInstitutionId;
}

function mappingRequest(emrData) {
  return new Promise((resolve, reject) => {
    const sendData = [];

    const compareJSON = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

    const removeDuplicateJSON = (arr) => {
      const uniqueArray = [];
      arr.forEach((item) => {
        if (!uniqueArray.some((obj) => compareJSON(obj, item))) {
          uniqueArray.push(item);
        }
      });
      return uniqueArray;
    };

    for (let key in emrData) {
      const gender = emrData[key][0].sex === 'M' ? 'Male' : emrData[key][0].sex === 'F' ? 'Female' : 'Other';

      const PrescriptionDetails = [];
      const DiagnosisDetail = [];
      const date = emrData[key][0].prescriptionDate;

      const locationName = emrData[key][0].location_name;
      const institutionId = resolveInstitutionId(locationName);

      for (let i = 0; i < emrData[key].length; i++) {
        const dose = emrData[key][i].dose !== undefined ? emrData[key][i].dose : 1;
        const strengthVal = emrData[key][i].strength;
        const strength = strengthVal !== undefined ? String(strengthVal).match(/(\d+)/)[0] : 1;

        let quantity;
        if (emrData[key][i].dose !== '') {
          quantity = emrData[key][i].quantity / dose;
        } else {
          quantity = Math.ceil(emrData[key][i].quantity / strength);
        }

        let numberOfDuration = 1;
        if (emrData[key][i].duration_units === 53643 || emrData[key][i].duration_units === 11656) {
          numberOfDuration = emrData[key][i].numberOfDuration;
        } else if (emrData[key][i].duration_units === 53629) {
          numberOfDuration = emrData[key][i].numberOfDuration * 7;
        } else if (emrData[key][i].duration_units === 53588) {
          numberOfDuration = emrData[key][i].numberOfDuration * 30;
} else {
          numberOfDuration = emrData[key][i].numberOfDuration || 1;
        }

        let note = '';

        if (emrData[key][i].additionalNote !== undefined && emrData[key][i].additionalNote !== '') {
          const notes = emrData[key][i].additionalNote.replace(/[`~!@#$%^&*()_|+\=?;'"<>\{\}\[\]\\\/]/gi, '');
          const insts = notes.split(',');

          insts.forEach((inst) => {
            if (!inst.includes('DU:') && !inst.includes('instructions') && !inst.includes('morning') && !inst.includes('afternoon') && !inst.includes('evening') && !inst.includes('night') && !inst.includes('morningDose') && !inst.includes('additionalInstructions')) {
              note = inst;
            }
          });

          if (notes.includes('morningDose')) {
            const variableDoses = notes.split(',');
            note += ' Variable Dose:-';

            variableDoses.forEach((variableDose) => {
              if (!variableDose.includes('DU') && !variableDose.includes('instructions') && !variableDose.includes('additionalInstructions')) {
                note += ` ${variableDose}${emrData[key][i].dose_units}`;
              }
            });
          }
        }

        const val = PrescriptionDetails !== undefined && PrescriptionDetails.length !== 0 ?
          PrescriptionDetails.some((item) => item.orderNumber === emrData[key][i].orderNumber) :
          false;

        if (!val) {
          const presDetail = {
            numberOfDuration,
            administrationId: emrData[key][i].administrationId !== '' ? emrData[key][i].administrationId : '01d045a0-adf0-4065-9f5d-4fdc65c3ea92',
            frequencyTypeId: resolveFrequencyTypeId(emrData[key][i].frequencyTypeId),
            itemUnitId: emrData[key][i].itemUnitId,
            quantity: Math.floor(quantity),
            orderNumber: emrData[key][i].orderNumber,
            additionalNote: note,
          };

          PrescriptionDetails.push(presDetail);
        }

        if (emrData[key][i].diagnosises && emrData[key][i].diagnosises !== '') {
          if (emrData[key][i].diagnosises.includes('#')) {
            const newDiagnosis = emrData[key][i].diagnosises.split('#');

            for (let j = 0; j < newDiagnosis.length; j++) {
              const diagnosisDetail = {
                diagnosisTypeId: newDiagnosis[j].trim(),
                additionalInfo: emrData[key][i].additionalInfo.startsWith('#') ? '' : emrData[key][i].additionalInfo,
              };

              if (DiagnosisDetail) {
                DiagnosisDetail.push(diagnosisDetail);
              }
            }
          } else {
            const diagnosisDetail = {
              diagnosisTypeId: emrData[key][i].diagnosises.trim(),
              additionalInfo: emrData[key][i].additionalInfo.startsWith('#') ? '' : emrData[key][i].additionalInfo,
            };

            DiagnosisDetail.push(diagnosisDetail);
          }
        }
      }

      const toEapts = {
        prescriber: {
          firstName: emrData[key][0].prescriber_firstName,
          middleName: emrData[key][0].prescriber_middleName || '',
          lastName: emrData[key][0].prescriber_lastName || '',
          qualification: emrData[key][0].prescriber_role != undefined ? emrData[key][0].prescriber_role : '',
          registrationNumber: emrData[key][0].prescriber_registrationNumber,
          rowGuid: emrData[key][0].prescriber_rowGuid,
        },
        patient: {
          paymentTypeId: emrData[key][0].paymentType,
          sponsorName: emrData[key][0].sponsorName !== '' && emrData[key][0].sponsorName !== undefined ? emrData[key][0].sponsorName : '',
          patientTypeId: emrData[key][0].patientTypeId,
          firstName: emrData[key][0].firstName,
          middleName: emrData[key][0].middleName || 'N/A',
          lastName: emrData[key][0].lastName || 'N/A',
          phoneNumber: emrData[key][0].phoneNumber,
          age: emrData[key][0].age,
          ageType: 'Years',
          weight: emrData[key][0].weight === '' ? 0 : emrData[key][0].weight,
          sex: gender,
          houseNumber: emrData[key][0].houseNumber !== '' ? emrData[key][0].houseNumber : '',
          cardNumber: emrData[key][0].cardNumber,
          rowGuid: emrData[key][0].patient_rowGuid,
          woredaId: emrData[key][0].woredaId !== '' && emrData[key][0].woredaId !== undefined ? emrData[key][0].woredaId : null,
        },
        prescriptionDetails: PrescriptionDetails !== undefined ? PrescriptionDetails : [],
        rowGuid: emrData[key][0].rowGuid,
        institutionId: institutionId,
        prescriptionDiagnosis: removeDuplicateJSON(DiagnosisDetail),
        prescriptionDate: date,
      };

      sendData.push(toEapts);
    }

    return resolve(sendData);
  });
}

module.exports.mappingRequest = mappingRequest;


