// var showHideAgeBasedSections = function (patient) {
//     var returnValues = {
//         show: [],
//         hide: []
//     };
//         if (patient["age"].years >= 10) {
//         returnValues.show.push("education", "occupation", "maritalStatus")
//     }else if ((patient["age"].years < 10) && (patient["age"].years >= 4)) {
//         returnValues.hide.push("maritalStatus")
//         returnValues.show.push("education", "occupation")
//     } else if (patient["age"].years < 4) {
//         returnValues.hide.push("maritalStatus", "education", "occupation")
//     } else {
//         returnValues.hide.push("maritalStatus", "education", "occupation")
//     }
//     return returnValues
// };
// Bahmni.Registration.AttributesConditions.rules = {
//     // 'PaymentMethod': function(patient) {
//     //     var returnValues = {
//     //         show: [],
//     //         hide: []
//     //     };
//     //     if(patient["PaymentMethod"] && patient["PaymentMethod"].value && (patient["PaymentMethod"].value == "Credit" || patient["PaymentMethod"].value == "Free")){
//     //         returnValues.show.push("PaymentDetailsInformation");           
//     //     }
//     //     else {
//     //         returnValues.hide.push("PaymentDetailsInformation");
//     //     }
//     //     if(patient["PaymentMethod"] && patient["PaymentMethod"].value && patient["PaymentMethod"].value == "Free"){
//     //         returnValues.hide.push("SponsorInformation");           
//     //     }
//     //     else {
//     //         returnValues.hide.push("SponsorInformation");
//     //     }
//     //     return returnValues;
//     // },
//     // 'PaymentDetails': function(patient) {

//     //     var returnValues = {
//     //         show: [],
//     //         hide: []
//     //     };
//     //     if(patient["PaymentDetails"] && patient["PaymentDetails"].value && patient["PaymentMethod"].value !== "Free"){
//     //         returnValues.show.push("SponsorInformation");           
//     //     }
//     //     else {
//     //         returnValues.hide.push("SponsorInformation");
//     //     }
//     //     return returnValues;
//     // },
//     // 'age': function (patient) {
//     //     return showHideAgeBasedSections(patient);
//     // }
// };
