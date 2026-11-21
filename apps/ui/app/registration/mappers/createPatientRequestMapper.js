'use strict';

Bahmni.Registration.CreatePatientRequestMapper = (function () {
    function CreatePatientRequestMapper (currentDate) {
        this.currentDate = currentDate;
    }

    // Helper: remove all null/undefined keys from a plain object (shallow)
    // Prevents OpenMRS/Jackson NPE in setConvertedProperties (HashMap.putMapEntries(null))
    // when null fields like birthtime/deathDate/causeOfDeath/identifier uuid are sent.
    var stripNulls = function (obj) {
        if (!obj || typeof obj !== 'object') { return obj; }
        Object.keys(obj).forEach(function (k) {
            if (obj[k] === null || obj[k] === undefined) {
                delete obj[k];
            }
        });
        return obj;
    };

    CreatePatientRequestMapper.prototype.mapFromPatient = function (patientAttributeTypes, patient) {
        var constants = Bahmni.Registration.Constants;
        var allIdentifiers = _.concat(patient.extraIdentifiers, patient.primaryIdentifier);
        var identifiers = _.filter(allIdentifiers, function (identifier) {
            return !_.isEmpty(identifier.selectedIdentifierSource) || (identifier.identifier !== undefined);
        });
        identifiers = _.map(identifiers, function (identifier) {
            var idObj = {
                identifier: identifier.identifier,
                identifierType: identifier.identifierType.uuid,
                preferred: identifier.preferred,
                voided: identifier.voided
            };
            // Only include source info when present
            if (identifier.selectedIdentifierSource) {
                idObj.identifierSourceUuid = identifier.selectedIdentifierSource.uuid;
                idObj.identifierPrefix = identifier.selectedIdentifierSource.prefix;
            }
            // Only include uuid when truthy — sending null uuid causes server NPE
            if (identifier.uuid) { idObj.uuid = identifier.uuid; }
            return stripNulls(idObj);
        });
        var cleanAddress = _.pick(patient.address || {}, constants.allAddressFileds);
        if (!cleanAddress.uuid) {
            delete cleanAddress.uuid;
        }
        Object.keys(cleanAddress).forEach(function (k) {
            if (cleanAddress[k] === null || cleanAddress[k] === undefined || cleanAddress[k] === '') {
                delete cleanAddress[k];
            }
        });

        // Build name object — omit null/undefined keys to avoid Jackson NPE on setConvertedProperties
        var nameObj = {
            givenName: patient.givenName,
            middleName: patient.middleName,
            familyName: patient.familyName,
            display: patient.givenName + (patient.familyName ? " " + patient.familyName : ""),
            "preferred": false
        };
        stripNulls(nameObj);

        var openMRSPatient = {
            patient: {
                person: {
                    names: [nameObj],
                    addresses: Object.keys(cleanAddress).length > 0 ? [cleanAddress] : [],
                    birthdate: this.getBirthdate(patient.birthdate, patient.age),
                    birthdateEstimated: patient.birthdateEstimated,
                    gender: patient.gender,
                    personDateCreated: patient.registrationDate,
                    attributes: new Bahmni.Common.Domain.AttributeFormatter().getMrsAttributes(patient, patientAttributeTypes),
                    dead: !!patient.dead
                },
                identifiers: identifiers,
                uuid: patient.uuid
            }
        };

        // Only add nullable person fields when they have actual values — sending null causes server NPE
        if (patient.birthtime && moment(patient.birthtime).isValid()) {
            openMRSPatient.patient.person.birthtime = Bahmni.Common.Util.DateUtil.parseLongDateToServerFormat(patient.birthtime);
        }
        if (patient.dead && patient.deathDate) {
            openMRSPatient.patient.person.deathDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(patient.deathDate);
        }
        if (patient.dead && patient.causeOfDeath && patient.causeOfDeath.uuid) {
            openMRSPatient.patient.person.causeOfDeath = patient.causeOfDeath.uuid;
        }

        this.setImage(patient, openMRSPatient);
        openMRSPatient.relationships = _.filter(patient.relationships || [], function (rel) {
            return rel && typeof rel === 'object' && (rel.relationshipType || rel.uuid);
        });
        return openMRSPatient;
    };

    CreatePatientRequestMapper.prototype.setImage = function (patient, openMRSPatient) {
        if (patient.getImageData()) {
            openMRSPatient.image = patient.getImageData();
        }
    };

    CreatePatientRequestMapper.prototype.getBirthdate = function (birthdate, age) {
        var mnt;
        if (birthdate) {
            mnt = moment(birthdate);
        } else if (age !== undefined) {
            mnt = moment(this.currentDate).subtract('days', age.days).subtract('months', age.months).subtract('years', age.years);
        }
        return mnt.format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
    };

    return CreatePatientRequestMapper;
})();
