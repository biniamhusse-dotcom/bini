'use strict';

Bahmni.Common.Domain.Diagnosis = function (codedAnswer, order, certainty, existingObsUuid, freeTextAnswer, diagnosisDateTime, voided) {
    var self = this;
    self.codedAnswer = codedAnswer;
    self.order = order;
    self.certainty = certainty;
    self.existingObs = existingObsUuid;
    self.freeTextAnswer = freeTextAnswer;
    self.diagnosisDateTime = diagnosisDateTime;
    self.diagnosisStatus = undefined;
    self.isNonCodedAnswer = false;
    if (self.codedAnswer) {
        self.conceptName = self.codedAnswer.name;
    }
    self.voided = voided;
    self.firstDiagnosis = null;
    self.comments = "";
    self.icd11Code = "";
    self.icd11Name = "";
    self.diagnosisOccurrence = "";

    self.getDisplayName = function () {
        if (self.freeTextAnswer) {
            return self.freeTextAnswer;
        } else {
            return self.codedAnswer.shortName || self.codedAnswer.name;
        }
    };

    self.isPrimary = function () {
        return self.order == "PRIMARY";
    };

    self.isSecondary = function () {
        return self.order == "SECONDARY";
    };

    self.isRuledOut = function () {
        return self.diagnosisStatus == $rootScope.diagnosisStatus;
    };

    self.answerNotFilled = function () {
        return !self.codedAnswer.name;
    };

    self.isValidAnswer = function () {
        return (self.codedAnswer.name && self.codedAnswer.uuid) ||
            (self.codedAnswer.name && !self.codedAnswer.uuid && self.isNonCodedAnswer) ||
            self.answerNotFilled();
    };
    self.isValidOrder = function () {
        return self.isEmpty() || self.order !== undefined;
    };

    self.isValidCertainty = function () {
        return self.isEmpty() || self.certainty !== undefined;
    };

    self.isEmpty = function () {
        return self.getDisplayName() === undefined || self.getDisplayName().length === 0;
    };

    self.diagnosisStatusValue = null;
    self.diagnosisStatusConcept = null;
    Object.defineProperty(this, 'diagnosisStatus', {
        get: function () {
            return this.diagnosisStatusValue;
        },
        set: function (newStatus) {
            if (newStatus) {
                this.diagnosisStatusValue = newStatus;
                this.diagnosisStatusConcept = { name: newStatus + " " + "Diagnosis"};
            } else {
                this.diagnosisStatusValue = null;
                this.diagnosisStatusConcept = null;
            }
        }
    });

    self.clearCodedAnswerUuid = function () {
        self.codedAnswer.uuid = undefined;
    };

    self.setAsNonCodedAnswer = function () {
        self.isNonCodedAnswer = !self.isNonCodedAnswer;
    };

    self.parseIcd11FromComments = function () {
        try {
            if (!self.comments || typeof self.comments !== 'string') {
                return;
            }
            var remaining = self.comments;
            var icd11Match = remaining.match(/^\[ICD11:([^\]]+)\]/);
            if (icd11Match) {
                self.icd11Code = icd11Match[1];
                remaining = remaining.substring(icd11Match[0].length);
            }
            var occMatch = remaining.match(/^\[OCC:([^\]]+)\]/);
            if (occMatch) {
                self.diagnosisOccurrence = occMatch[1];
                remaining = remaining.substring(occMatch[0].length);
            }
            self.comments = remaining.trim();
        } catch (error) {
        }
    };
};
