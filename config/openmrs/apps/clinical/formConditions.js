Bahmni.ConceptSet.FormConditions.rules = {
    'Diastolic Data' : function (formName, formFieldValues) {
        var systolic = formFieldValues['Systolic'];
        var diastolic = formFieldValues['Diastolic'];
        if (diastolic || systolic) {
            return {
                enable: ["Posture"]
                // action: "Measure BP again after 10–15 minutes rest",
                // annotation: "Given high values (SBP ≥ 140 or DBP ≥ 90) upon first measure, blood pressure should be measured again"
            }
        } else {
            return {
                disable: ["Posture"],
            }
        }
    },
    'Systolic Data' : function (formName, formFieldValues) {
        var systolic = formFieldValues['Systolic'];
        var diastolic = formFieldValues['Diastolic'];
        if (systolic || diastolic) {
            return {
                enable: ["Posture"]
            }
        } else {
            return {
                disable: ["Posture"]
            }
        }
    },
//    'Do' : function (formName, formFieldValues) {
//         var cytology = formFieldValues['Do'];
//         if (cytology == 'GC-GYN Cytology') {
//             return {
//                 show: ["OB-GYN Cytology"],
// 				hide: ["OB-Biopsy", "OB-Fine Needle Aspiration Cytology", "OB-Body Fluid Cytology", "OB-Bone Marrow Aspiration Cytology"]
//             }
//         } else if (cytology == 'SP-Surgicalpathology'){
//             return {
//                 show: ["OB-Biopsy"],
// 				hide: ["OB-GYN Cytology", "OB-Fine Needle Aspiration Cytology", "OB-Body Fluid Cytology", "OB-Bone Marrow Aspiration Cytology"]
//             }
//         } else if (cytology == 'NG-Non-GYN Cytology'){
//             return {
//                 show: ["OB-Fine Needle Aspiration Cytology"],
//                 // , "How NG Specimen was obtained", "Pathologist/Technician perform"
// 				hide: ["OB-GYN Cytology", "OB-Biopsy", "OB-Body Fluid Cytology", "OB-Bone Marrow Aspiration Cytology"]
//             }
//         } else if (cytology == 'BF-Non-GYN Cytology'){
//             return {
//                 show: ["OB-Body Fluid Cytology"],
//                 // , "How BF Specimen was obtained", "Pathologist/Technician perform"
// 				hide: ["OB-GYN Cytology", "OB-Fine Needle Aspiration Cytology", "OB-Biopsy", "OB-Bone Marrow Aspiration Cytology"]
//             }
//         } else if (cytology == 'HP-Hematopathology'){
//             return {
//                 show: ["OB-Bone Marrow Aspiration Cytology"],
//                 // , "How HP Specimen was obtained", "Pathologist/Technician perform"
// 				hide: ["OB-GYN Cytology", "OB-Fine Needle Aspiration Cytology", "OB-Body Fluid Cytology", "OB-Biopsy"]
//             }
//         } else{
//             return {
// 				hide: ["OB-GYN Cytology", "OB-Fine Needle Aspiration Cytology", "OB-Body Fluid Cytology", "OB-Biopsy", "OB-Bone Marrow Aspiration Cytology"]
//                 // , "Pathologist/Technician perform"           
//             }
//         }
//     },
    // 'Pathologist/Technician perform' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['Pathologist/Technician perform'];
    //     if (!perform) {
    //         return {
    //             hide: ["Procedure Date", "who performs a procedure", "Procedures Performed"]
    //         }
    //     } else {
    //         return {
    //             show: ["Procedure Date", "who performs a procedure", "Procedures Performed"]
    //         }
    //     }
    // },	
    // 'How NG Specimen was obtained' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['How NG Specimen was obtained'];
    //     if (!perform) {
    //         return {
    //             hide: ["NG Specimen Source", "NG Specimen Source Free Text"]
    //         }
    //     } else {
    //         return {
    //             show: ["NG Specimen Source"],
    //             enable: ["NG Specimen Source Free Text"]
				
    //         }
    //     }
    // },
    // 'NG Specimen Source' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['NG Specimen Source'];
    //     if (!perform) {
    //         return {
    //             hide: ["NG Source Laterality"]
    //         }
    //     } else {
    //         return {
    //             show: ["NG Source Laterality"],
    //             disable: ["NG Specimen Source Free Text"]

    //         }
    //     }
    // },
    // 'NG Source Laterality' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['NG Source Laterality'];
    //     if (!perform) {
    //         return {
    //             hide: ["NG Specimen Source Detail"]
    //         }
    //     } else {
    //         return {
    //             show: ["NG Specimen Source Detail"]
    //         }
    //     }
    // },
    // 'How HP Specimen was obtained' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['How HP Specimen was obtained'];
    //     if (!perform) {
    //         return {
    //             hide: ["HP Specimen Source", "HP Specimen Source Free Text"]
    //         }
    //     } else {
    //         return {
    //             show: ["HP Specimen Source"],
    //             enable: ["HP Specimen Source Free Text"]
    //         }
    //     }
    // },
    // 'HP Specimen Source' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['HP Specimen Source'];
    //     if (!perform) {
    //         return {
    //             hide: ["HP Source Laterality"],
    //         }
    //     } else {
    //         return {
    //             show: ["HP Source Laterality"],
	// 			disable: ["HP Specimen Source Free Text"]
    //         }
    //     }
    // },
    // 'HP Source Laterality' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['HP Source Laterality'];
    //     if (!perform) {
    //         return {
    //             hide: ["HP Specimen Source Detail"]
    //         }
    //     } else {
    //         return {
    //             show: ["HP Specimen Source Detail"]
    //         }
    //     }
    // },
    // 'How BF Specimen was obtained' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['How BF Specimen was obtained'];
    //     if (!perform) {
    //         return {
    //             hide: ["BF Specimen Source", "BF Specimen Source Free Text"]
    //         }
    //     } else {
    //         return {
    //             show: ["BF Specimen Source"],
    //             enable: ["BF Specimen Source Free Text"]
    //         }
    //     }
    // },
    // 'BF Specimen Source' : function (formName, formFieldValues) {
    //     var perform = formFieldValues['BF Specimen Source'];
    //     if (!perform) {
    //         return {
    //             hide: ["BF Source Laterality"]
    //         }
    //     } else {
    //         return {
    //             show: ["BF Source Laterality"],
	// 			disable: ["BF Specimen Source Free Text"]
    //         }
    //     }
    // },
    'Select Ophthalmology Form' : function (formName, formFieldValues) {
        var selectForm = formFieldValues['Select Ophthalmology Form'];
        if (selectForm == 'OphthalmicVitals') {
            return {
                show: ["Ophthalmic Vitals"],
		hide: ["Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            }
        } else if (selectForm == 'OphthalmicHistory') {
            return {
                show: ["Ophthalmic History"],
		hide: ["Ophthalmic Vitals", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'PreliminaryEyeExamination') {
            return {
                show: ["Preliminary Eye examination"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'RefractionForm') {
            return {
                show: ["Refraction Form"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'BinocularVisionAndVisionTherapy') {
            return {
                show: ["Binocular vision and vision therapy patient examination"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'LowVisionAssessment') {
            return {
                show: ["Low Vision Assessment"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            }
           } else if (selectForm == 'ContactLensTrial') {
            return {
                show: ["Contact lens trial"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'FittingAssessment (Corneal RGP contact lens)') {
            return {
                show: ["Fitting assessment (Corneal RGP contact lens)"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            }
           } else if (selectForm == 'FittingAssessment (SSCL, SP/CCL STCL)') {
            return {
                show: ["Fitting assessment (SSCL, SP/CCL STCL)"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'FittingAssessment (Scleral contact lens)') {
            return {
                show: ["Fitting assessment (Scleral contact lens)"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Contact Lens Fitting"]
            } 
           } else if (selectForm == 'ContactLensFitting') {
            return {
                show: ["Contact Lens Fitting"],
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)"]
            } 
           } else {
                 return {
		hide: ["Ophthalmic Vitals", "Ophthalmic History", "Preliminary Eye examination", "Refraction Form", "Binocular vision and vision therapy patient examination", "Low Vision Assessment", "Contact lens trial", "Fitting assessment (Corneal RGP contact lens)", "Fitting assessment (SSCL, SP/CCL STCL)", "Fitting assessment (Scleral contact lens)", "Contact Lens Fitting"]
              }
           }
    },
    'ANC Visit Number' : function (formName, formFieldValues) {
        var visitNumber = formFieldValues['ANC Visit Number'];
        if (visitNumber == "Visit 1") {
            return {
                show: ["ANC First Visit", "ANC General Evaluation", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC Second Visit", "ANC Third Visit", "ANC Fourth Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        } 
        else if (visitNumber == "Visit 2") {
            return {
                show: ["ANC Second Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Fourth Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 3") {
            return {
                show: ["ANC Third Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Second Visit", "ANC Fourth Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 4") {
            return {
                show: ["ANC Fourth Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Second Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 5") {
            return {
                show: ["ANC Fifth Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Second Visit", "ANC Fourth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 6") {
            return {
                show: ["ANC Sixth Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Second Visit", "ANC Fifth Visit", "ANC Fourth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 7") {
            return {
                show: ["ANC Seventh Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Second Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Fourth Visit", "ANC Eighth Visit"]
            }
        }
        else if (visitNumber == "Visit 8") {
            return {
                show: ["ANC Eighth Visit", "Present pregnancy follow up schedule of ANC contacts"],
                hide: ["ANC General Evaluation", "ANC First Visit", "ANC Third Visit", "ANC Second Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Fourth Visit"]
            }
        }else {
            return {
                hide: ["Present pregnancy follow up schedule of ANC contacts", "ANC General Evaluation", "ANC First Visit", "ANC Second Visit", "ANC Third Visit", "ANC Fourth Visit", "ANC Fifth Visit", "ANC Sixth Visit", "ANC Seventh Visit", "ANC Eighth Visit"]
            }
        }

    },
    'WHO Trauma, Airway Status' : function (formName, formFieldValues) {
        var airway = formFieldValues['WHO Trauma, Airway Status'];
        if (airway && airway !== 'NML') {
            return {
                show: ["WHO Trauma, Airway Obstructed By", "WHO Trauma, Airway Management"],
                enable: ["WHO Trauma, Airway Obstructed By", "WHO Trauma, Airway Management"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Airway Obstructed By", "WHO Trauma, Airway Management"],
                disable: ["WHO Trauma, Airway Obstructed By", "WHO Trauma, Airway Management"]
            }
        }
    },
    'WHO Trauma, Airway Obstructed By' : function (formName, formFieldValues) {
        var obstructed = formFieldValues['WHO Trauma, Airway Obstructed By'];
        if (obstructed) {
            return {
                show: ["WHO Trauma, Airway Management"],
                enable: ["WHO Trauma, Airway Management"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Airway Management"],
                disable: ["WHO Trauma, Airway Management"]
            }
        }
    },
    'WHO Trauma, Chest Examination' : function (formName, formFieldValues) {
        var chest = formFieldValues['WHO Trauma, Chest Examination'];
        if (chest && chest !== 'Negative') {
            return {
                show: ["WHO Trauma, Pneumothorax Side", "WHO Trauma, Pleural Fluid Side", "WHO Trauma, Pericardial Effusion"],
                enable: ["WHO Trauma, Pneumothorax Side", "WHO Trauma, Pleural Fluid Side", "WHO Trauma, Pericardial Effusion"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Pneumothorax Side", "WHO Trauma, Pleural Fluid Side", "WHO Trauma, Pericardial Effusion"],
                disable: ["WHO Trauma, Pneumothorax Side", "WHO Trauma, Pleural Fluid Side", "WHO Trauma, Pericardial Effusion"]
            }
        }
    },
    'WHO Trauma, FAST Performed' : function (formName, formFieldValues) {
        var fast = formFieldValues['WHO Trauma, FAST Performed'];
        if (fast && fast !== 'Not indicated' && fast !== 'NML') {
            return {
                show: ["WHO Trauma, Peritoneum", "WHO Trauma, Free Fluid"],
                enable: ["WHO Trauma, Peritoneum", "WHO Trauma, Free Fluid"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Peritoneum", "WHO Trauma, Free Fluid"],
                disable: ["WHO Trauma, Peritoneum", "WHO Trauma, Free Fluid"]
            }
        }
    },
    'WHO Trauma, Peritoneum' : function (formName, formFieldValues) {
        var peritoneum = formFieldValues['WHO Trauma, Peritoneum'];
        if (peritoneum && peritoneum !== 'Negative') {
            return {
                show: ["WHO Trauma, Free Fluid"],
                enable: ["WHO Trauma, Free Fluid"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Free Fluid"],
                disable: ["WHO Trauma, Free Fluid"]
            }
        }
    },
    'WHO Trauma, Condition Same' : function (formName, formFieldValues) {
        var conditionSame = formFieldValues['WHO Trauma, Condition Same'];
        if (conditionSame === false || conditionSame === 'false') {
            return {
                show: ["WHO Trauma, Condition Changes"],
                enable: ["WHO Trauma, Condition Changes"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Condition Changes"],
                disable: ["WHO Trauma, Condition Changes"]
            }
        }
    },
    'WHO Trauma, Checklist Completed' : function (formName, formFieldValues) {
        var checklist = formFieldValues['WHO Trauma, Checklist Completed'];
        if (checklist) {
            return {
                show: ["WHO Trauma, ED Departure Date", "WHO Trauma, ED Departure Time", "WHO Trauma, Diagnoses List", "WHO Trauma, Serious Injuries Count"],
                enable: ["WHO Trauma, ED Departure Date", "WHO Trauma, ED Departure Time", "WHO Trauma, Diagnoses List", "WHO Trauma, Serious Injuries Count"]
            }
        } else {
            return {
                hide: ["WHO Trauma, ED Departure Date", "WHO Trauma, ED Departure Time", "WHO Trauma, Diagnoses List", "WHO Trauma, Serious Injuries Count"],
                disable: ["WHO Trauma, ED Departure Date", "WHO Trauma, ED Departure Time", "WHO Trauma, Diagnoses List", "WHO Trauma, Serious Injuries Count"]
            }
        }
    },
    'WHO Trauma, Serious Injuries Count' : function (formName, formFieldValues) {
        var injuries = formFieldValues['WHO Trauma, Serious Injuries Count'];
        if (injuries && injuries !== '0') {
            return {
                show: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"],
                enable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        } else {
            return {
                show: ["WHO Trauma, Discharge Planned"],
                enable: ["WHO Trauma, Discharge Planned"],
                hide: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"],
                disable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        }
    },
    'WHO Trauma, Discharge Planned' : function (formName, formFieldValues) {
        var discharge = formFieldValues['WHO Trauma, Discharge Planned'];
        if (discharge) {
            return {
                show: ["WHO Trauma, Discharge Discussion"],
                enable: ["WHO Trauma, Discharge Discussion"]
            }
        } else {
            return {
                hide: ["WHO Trauma, Discharge Discussion"],
                disable: ["WHO Trauma, Discharge Discussion"]
            }
        }
    },
    'WHO Trauma, Admit Ward' : function (formName, formFieldValues) {
        var admitWard = formFieldValues['WHO Trauma, Admit Ward'];
        if (admitWard) {
            return {
                hide: ["WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"],
                disable: ["WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        } else {
            return {
                enable: ["WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        }
    },
    'WHO Trauma, Admit ICU' : function (formName, formFieldValues) {
        var admitICU = formFieldValues['WHO Trauma, Admit ICU'];
        if (admitICU) {
            return {
                hide: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"],
                disable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        } else {
            return {
                enable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        }
    },
    'WHO Trauma, Admit OT' : function (formName, formFieldValues) {
        var admitOT = formFieldValues['WHO Trauma, Admit OT'];
        if (admitOT) {
            return {
                hide: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"],
                disable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        } else {
            return {
                enable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To", "WHO Trauma, Left Without Treatment"]
            }
        }
    },
    'WHO Trauma, Transfer To' : function (formName, formFieldValues) {
        var transfer = formFieldValues['WHO Trauma, Transfer To'];
        if (transfer) {
            return {
                hide: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Left Without Treatment"],
                disable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Left Without Treatment"]
            }
        } else {
            return {
                enable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Left Without Treatment"]
            }
        }
    },
    'WHO Trauma, Left Without Treatment' : function (formName, formFieldValues) {
        var leftWithout = formFieldValues['WHO Trauma, Left Without Treatment'];
        if (leftWithout) {
            return {
                hide: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To"],
                disable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To"]
            }
        } else {
            return {
                enable: ["WHO Trauma, Admit Ward", "WHO Trauma, Admit ICU", "WHO Trauma, Admit OT", "WHO Trauma, Discharge Planned", "WHO Trauma, Transfer To"]
            }
        }
    }
};