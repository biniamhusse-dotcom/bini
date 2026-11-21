'use strict';

Bahmni.Registration.UpdatePatientRequestMapper = (function () {
    var UpdatePatientRequestMapper = function (currentDate) {
        this.currentDate = currentDate;
    };

    UpdatePatientRequestMapper.prototype.currentDate = undefined;

    UpdatePatientRequestMapper.prototype.mapFromPatient = function (patientAttributeTypes, openMRSPatient, patient) {
        var cleanAddress = _.pick(patient.address || {}, Bahmni.Registration.Constants.allAddressFileds);
        if (openMRSPatient && openMRSPatient.person && openMRSPatient.person.addresses && openMRSPatient.person.addresses.length > 0) {
            if (!cleanAddress.uuid && openMRSPatient.person.addresses[0].uuid) {
                cleanAddress.uuid = openMRSPatient.person.addresses[0].uuid;
            }
        }
        if (!cleanAddress.uuid) {
            delete cleanAddress.uuid;
        }
        // Remove empty or null fields so Jackson doesn't fail deserialization
        Object.keys(cleanAddress).forEach(function (k) {
            if (cleanAddress[k] === null || cleanAddress[k] === undefined || cleanAddress[k] === '') {
                delete cleanAddress[k];
            }
        });

        var hasAddressContent = Object.keys(cleanAddress).length > 0;
        var addresses = undefined;
        if (hasAddressContent) {
            addresses = [cleanAddress];
        } else if (openMRSPatient && openMRSPatient.person && openMRSPatient.person.addresses && openMRSPatient.person.addresses.length > 0) {
            addresses = openMRSPatient.person.addresses;
        }

        var openMRSPatientProfile = {
            patient: {
                person: {
                    names: [
                        {
                            uuid: (openMRSPatient && openMRSPatient.person && openMRSPatient.person.names && openMRSPatient.person.names[0] && openMRSPatient.person.names[0].uuid) ? openMRSPatient.person.names[0].uuid : undefined,
                            givenName: patient.givenName,
                            middleName: patient.middleName,
                            familyName: patient.familyName,
                            display: patient.givenName + (patient.familyName ? " " + patient.familyName : ""),
                            "preferred": true
                        }
                    ],
                    birthdate: this.getBirthdate(patient.birthdate, patient.age),
                    birthdateEstimated: patient.birthdateEstimated,
                    birthtime: (patient.birthtime && moment(patient.birthtime).isValid()) ? Bahmni.Common.Util.DateUtil.parseLongDateToServerFormat(patient.birthtime) : null,
                    gender: patient.gender,
                    attributes: this.getMrsAttributes(openMRSPatient, patient, patientAttributeTypes),
                    dead: !!patient.dead,
                    deathDate: (patient.dead && patient.deathDate) ? Bahmni.Common.Util.DateUtil.getDateWithoutTime(patient.deathDate) : null,
                    causeOfDeath: (patient.dead && patient.causeOfDeath && patient.causeOfDeath.uuid) ? patient.causeOfDeath.uuid : null
                }
            }
        };

        if (addresses) {
            openMRSPatientProfile.patient.person.addresses = addresses;
        }

        var allIdentifiers = _.concat(patient.extraIdentifiers, patient.primaryIdentifier);
        var nonEmptyIdentifiers = _.filter(allIdentifiers, function (identifier) {
            return identifier.uuid || identifier.identifier;
        });

        openMRSPatientProfile.patient.identifiers = _.map(nonEmptyIdentifiers, function (identifier) {
            return {
                uuid: identifier.uuid,
                identifier: identifier.identifier,
                identifierType: identifier.identifierType.uuid,
                preferred: identifier.preferred,
                voided: identifier.voided
            };
        });

        this.setImage(patient, openMRSPatientProfile);

        var validRelationships = _.filter(patient.relationships || [], function (rel) {
            return rel && typeof rel === 'object' && (rel.relationshipType || rel.uuid);
        });
        openMRSPatientProfile.relationships = validRelationships;

        return openMRSPatientProfile;
    };

    UpdatePatientRequestMapper.prototype.setImage = function (patient, openMRSPatient) {
        if (patient.getImageData()) {
            openMRSPatient.image = patient.getImageData();
        }
    };

    UpdatePatientRequestMapper.prototype.getMrsAttributes = function (openMRSPatient, patient, patientAttributeTypes) {
        var attributes = [];
        patientAttributeTypes.forEach(function (attributeType) {
            var attr = {
                attributeType: {
                    uuid: attributeType.uuid
                }
            };
            var savedAttribute = (openMRSPatient && openMRSPatient.person && openMRSPatient.person.attributes) ? 
                openMRSPatient.person.attributes.filter(function (attribute) {
                    return attributeType.uuid === (attribute.attributeType && attribute.attributeType.uuid);
                })[0] : null;

            if (savedAttribute) {
                attr.uuid = savedAttribute.uuid;
                var patientAttrValue = patient[attributeType.name] !== undefined ? patient[attributeType.name] : patient[savedAttribute.attributeType.display];
                setAttributeValue(attributeType, attr, patientAttrValue);
                attributes.push(attr);
            } else if (patient[attributeType.name] !== undefined && patient[attributeType.name] !== null && patient[attributeType.name] !== "") {
                setAttributeValue(attributeType, attr, patient[attributeType.name]);
                if (!attr.voided && attr.value) {
                    attributes.push(attr);
                }
            }
        });
        return attributes;
    };

    var setAttributeValue = function (attributeType, attr, value) {
        var isConcept = attributeType.format === "org.openmrs.Concept";
        var isConceptEmpty = isConcept && (!value || (typeof value === 'object' && !value.conceptUuid));
        if (value === "" || value === null || value === undefined || isConceptEmpty) {
            attr.voided = true;
            attr.value = null;
            attr.hydratedObject = null;
        } else if (isConcept) {
            var conceptUuid = (typeof value === 'object') ? value.conceptUuid : value;
            if (conceptUuid === 'fd08aa37-e18d-415d-be41-f8bbbc81bea3') {
                conceptUuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4b';
            }
            attr.value = conceptUuid;
            attr.hydratedObject = conceptUuid;
        } else if (attributeType.format === "org.openmrs.util.AttributableDate" || attributeType.format === "org.openmrs.customdatatype.datatype.DateDatatype") {
            var mnt = moment(value);
            attr.value = mnt.isValid() ? mnt.format('YYYY-MM-DDTHH:mm:ss.SSSZZ') : null;
        } else {
            attr.value = value.toString();
        }
    };

    UpdatePatientRequestMapper.prototype.getBirthdate = function (birthdate, age) {
        var mnt;
        if (birthdate) {
            mnt = moment(birthdate);
        } else if (age !== undefined) {
            mnt = moment(this.currentDate).subtract('days', age.days).subtract('months', age.months).subtract('years', age.years);
        }
        return mnt.format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
    };

    return UpdatePatientRequestMapper;
})();
