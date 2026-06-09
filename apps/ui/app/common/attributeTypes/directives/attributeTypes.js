'use strict';

angular.module('bahmni.common.attributeTypes', []).directive('attributeTypes', [function () {
    return {
        scope: {
            targetModel: '=',
            attribute: '=',
            fieldValidation: '=',
            isAutoComplete: '&',
            getAutoCompleteList: '&',
            getDataResults: '&',
            handleUpdate: '&',
            isReadOnly: '&',
            isForm: '=?'
        },
        templateUrl: '../common/attributeTypes/views/attributeInformation.html',
        restrict: 'E',
        controller: function ($scope, $translate) {
            $scope.getAutoCompleteList = $scope.getAutoCompleteList();
            $scope.getDataResults = $scope.getDataResults();
            // to avoid watchers in one way binding
            $scope.isAutoComplete = $scope.isAutoComplete() || function () { return false; };
            $scope.isReadOnly = $scope.isReadOnly() || function () { return false; };
            $scope.handleUpdate = $scope.handleUpdate() || function () { return false; };
            $scope.appendConceptNameToModel = function (attribute) {
                var attributeValueConceptType = $scope.targetModel[attribute.name];
                var concept = _.find(attribute.answers, function (answer) {
                    return answer.conceptId === attributeValueConceptType.conceptUuid;
                });
                attributeValueConceptType.value = concept && concept.fullySpecifiedName;
            };
            $scope.getTranslatedAttributeTypes = function (attribute) {
                var translatedName = Bahmni.Common.Util.TranslationUtil.translateAttribute(attribute, Bahmni.Common.Constants.patientAttribute, $translate);
                return translatedName;
            };
            $scope.getAmharicTransloation = function (attributeName) {
                var amhPlaceholder = "";
                if(attributeName.includes("phoneNumber")){
                    amhPlaceholder = "ስልክ ቁጥር";
                }
                if(attributeName.includes("Alternative Phone Number")){
                    amhPlaceholder = "አማራጭ ስልክ ቁጥር";
                }
                if(attributeName.includes("Primary Contact Name")){
                    amhPlaceholder = "የመጀመርያ ተጠሪ ስም";
                }
                if(attributeName.includes("Primary Contact Phone Number")){
                    amhPlaceholder = "የመጀመርያ ተጠሪ ስልክ ቁጥር";
                }
                if(attributeName.includes("email")){
                    amhPlaceholder = "የ ኢሜል አድራሻ";
                }
                if(attributeName.includes("primaryRelative")){
                    amhPlaceholder = "የባል/ሚስት ስም";
                }
                if(attributeName.includes("PaymentMethod")){
                    amhPlaceholder = "የመክፈያ ዘዴ";
                }
                if(attributeName.includes("Originofreferral")){
                    amhPlaceholder = "እንዴት መጣ";
                }
                if(attributeName.includes("Reference Number")){
                    amhPlaceholder = "የማጣቀሻ ቁጥር";
                }
                if(attributeName.includes("ReferredFrom")){
                    amhPlaceholder = "ከየት መጣ";
                }
                if(attributeName.includes("InsuranceName")){
                    amhPlaceholder = "የኢንሹራንስ ስም";
                }
                if(attributeName.includes("credit companies")){
                    amhPlaceholder = "የብድር ኩባንያዎች";
                }
                return amhPlaceholder;
            };

        }
    };
}]);
