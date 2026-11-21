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
            return identifier && (!_.isEmpty(identifier.selectedIdentifierSource) || (identifier.identifier !== undefined) || (identifier.hasIdentifierSources && identifier.hasIdentifierSources()));
        });
        identifiers = _.map(identifiers, function (identifier) {
            var typeUuid = identifier.identifierType ? (identifier.identifierType.uuid || identifier.identifierType) : undefined;
            var idObj = {
                identifier: identifier.identifier,
                identifierType: typeUuid,
                preferred: identifier.preferred !== undefined ? identifier.preferred : true,
                voided: identifier.voided || false
            };
            // Only include source info when present and valid
            if (identifier.selectedIdentifierSource && identifier.selectedIdentifierSource.uuid) {
                idObj.identifierSourceUuid = identifier.selectedIdentifierSource.uuid;
                if (identifier.selectedIdentifierSource.prefix) {
                    idObj.identifierPrefix = identifier.selectedIdentifierSource.prefix;
                }
            } else if (!idObj.identifier) {
                // If no manual identifier and no selectedIdentifierSource.uuid, fallback to default sequential generator source
                var src = (identifier.identifierType && identifier.identifierType.identifierSources && identifier.identifierType.identifierSources[0])
                    ? identifier.identifierType.identifierSources[0]
                    : { uuid: "c5cf4b68-6529-43fc-a644-c775ae73745e", prefix: "ABC" };
                idObj.identifierSourceUuid = src.uuid;
                idObj.identifierPrefix = src.prefix;
            }
            // CRITICAL: NEVER send identifierPrefix without identifierSourceUuid!
            // BahmniPatientProfileResource only removes identifierPrefix when identifierSourceUuid is non-null.
            // If identifierPrefix is sent without identifierSourceUuid, OpenMRS throws ConversionException:
            // "Unable to convert object into response content" (HTTP 400).
            if (!idObj.identifierSourceUuid) {
                delete idObj.identifierPrefix;
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
            "preferred": true
        };
        stripNulls(nameObj);

        var openMRSPatient = {
            patient: {
                person: {
                    names: [nameObj],
                    birthdate: this.getBirthdate(patient.birthdate, patient.age),
                    birthdateEstimated: patient.birthdateEstimated,
                    gender: patient.gender,
                    personDateCreated: patient.registrationDate,
                    attributes: new Bahmni.Common.Domain.AttributeFormatter().getMrsAttributes(patient, patientAttributeTypes),
                    dead: !!patient.dead
                },
                identifiers: identifiers
            }
        };

        // Only include addresses when address data is present; sending empty array [] triggers
        // OpenMRS setConvertedProperties ConversionException: "Unable to convert object into response content" (HTTP 400)
        if (Object.keys(cleanAddress).length > 0) {
            openMRSPatient.patient.person.addresses = [cleanAddress];
        }

        if (patient.uuid) {
            openMRSPatient.patient.uuid = patient.uuid;
        }

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
