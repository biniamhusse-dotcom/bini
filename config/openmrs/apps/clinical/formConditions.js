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

    }
};