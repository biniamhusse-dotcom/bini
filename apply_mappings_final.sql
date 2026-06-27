-- FIX Co-trimoxazole 800+160mg (drug 167) and 200+40mg/5ml (drug 168)
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(167, '20c66d34-5a48-482b-b132-5ba37c7a65e8', 'Sulphamethoxazole+Trimethoprim (800+160)mg Tablet', NOW()),
(168, 'f6edf14e-2aca-458f-8fff-413f829af1e0', 'Sulphamethoxazole+Trimethoprim (200+40)mg/5ml Suspension', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- Fix Amoxicillin 250mg existing mapping (was pointing to 125mg)
UPDATE eapts_drug_mapping SET dagu_item_uuid='6567811b-a056-48e7-a9f2-d24a91954378', dagu_item_name='Amoxicillin 250mg Capsule', created_at=NOW() WHERE openmrs_drug_id=124;

-- NEW: Atenolol
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(292, '88054c4c-1e75-46f6-95fc-7f22154adbdf', 'Atenolol 50mg Tablet', NOW()),
(293, '0a2424fe-36d5-4288-bcf1-1c5b20d55ac2', 'Atenolol 100mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Amlodipine
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(289, '548d8d12-c924-480f-a273-28a13c932479', 'Amlodipine 2.5mg Tablet', NOW()),
(290, '3b30a543-d717-47e6-aaf1-ac72eac6bac9', 'Amlodipine 5mg Tablet', NOW()),
(291, '375de188-bd26-43cc-a113-dfbb0932ce71', 'Amlodipine 10mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Hydrochlorothiazide
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(297, '48247f48-061d-4e74-88dc-9580762e2b49', 'Hydrochlorothiazide 25mg Tablet', NOW()),
(350, '03586353-c9d1-423e-8340-acc88feea608', 'Hydrochlorothiazide 50mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Clotrimazole
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(319, 'dabd4d3a-0d27-48b7-89fd-13a2801efa8e', 'Clotrimazole 1% Cream', NOW()),
(185, 'cc3e9f2d-9ce0-4cfe-8eae-6a2f5406c8b6', 'Clotrimazole 100mg Vaginal Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Acetylsalicylic Acid
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(28, 'e98a41ea-b80e-4b33-a0dd-8ce913397128', 'Acetylsalicylic Acid 300mg Tablet', NOW()),
(29, 'a9730f31-cd1d-4190-ab32-9a755367d384', 'Acetylsalicylic Acid 500mg Tablet', NOW()),
(310, 'b531e1c8-6697-46c1-a11c-37aad2ff9664', 'Acetylsalicylic Acid 75mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Methyldopa
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(299, 'a0cc558d-3cba-483a-99aa-90765fb86f63', 'Methyldopa 250mg Tablet', NOW()),
(300, 'd26aa997-6214-40f3-8588-6c5d56c414cc', 'Methyldopa 500mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Acyclovir
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(196, 'da7edfc0-a7fb-4dd4-934d-cb0de7bdc656', 'Acyclovir 200mg Capsule', NOW()),
(197, '25790ec3-b341-497e-abdb-33e03cd3f14a', 'Acyclovir 400mg Capsule', NOW()),
(198, 'c0b198a0-ed6a-44e5-a6d6-a71976c39232', 'Acyclovir 250mg Injection', NOW()),
(199, '1ec318cf-b5c1-43b8-9b73-13c7478b3223', 'Acyclovir 500mg Injection', NOW()),
(412, '8fb3a528-8deb-4100-8bb8-6a8ccfa123c3', 'Acyclovir 3% Eye Ointment', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Metronidazole
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(210, '198bb1b8-dc95-4a65-9803-122dc3a4c656', 'Metronidazole 400mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Artesunate
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(218, 'bb1bdc6d-5222-44aa-ba78-71c3778e6f9d', 'Artesunate 60mg Injection', NOW()),
(221, 'bae812de-8f82-4756-8e01-d0f673c9e495', 'Artesunate 50mg Capsule', NOW()),
(222, '8c9d40a0-7e52-4e59-b5e5-a59cf4d7a29b', 'Artesunate 100mg Suppository', NOW()),
(224, 'ffad1c68-00b4-4e20-8908-bb6f1a8de076', 'Artesunate 200mg Capsule', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Betamethasone
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(444, 'c00b892a-c1d5-46f5-876a-defd2e643dfe', 'Betamethasone 4mg Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Nifedipine
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(445, 'e3af390c-c763-4d39-beb6-8d4abc8234d7', 'Nifedipine 10mg Capsule', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Amitriptyline
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(450, '48f38191-8add-4e45-90cc-8ab138184396', 'Amitriptyline 10mg Tablet', NOW()),
(451, '3735c2b1-42a0-452e-8e5c-7b98490fd429', 'Amitriptyline 25mg Tablet', NOW()),
(452, 'ed53364e-e695-4e00-bc46-eeabb01d806d', 'Amitriptyline 50mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Erythromycin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(415, '2bb13684-dadd-4acf-9fe1-e671db334134', 'Erythromycin 0.5% Eye Ointment', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Spironolactone
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(353, '0e09edd4-a194-461c-a010-aa44bd1c50db', 'Spironolactone 25mg Tablet', NOW()),
(354, '92e04d1e-dede-4569-b623-a95303f580ef', 'Spironolactone 50mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Bisacodyl
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(374, '49e297b4-6f01-4b71-8ffb-bc014bb806f4', 'Bisacodyl 5mg Tablet', NOW()),
(375, 'c904c25b-9298-488d-916a-f2bb79ba0568', 'Bisacodyl 5mg Suppository', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Ciprofloxacin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(162, '4e0cd7ea-2b95-4698-a484-b54c57c8d6d2', 'Ciprofloxacin 250mg Tablet', NOW()),
(163, '2e7bf8ac-7fb8-4e91-ac91-d46bbea6ca27', 'Ciprofloxacin 500mg Tablet', NOW()),
(165, '9855abb2-701d-4106-b313-0a458ae0d879', 'Ciprofloxacin 200mg Injection', NOW()),
(413, '11223f2a-e361-437a-8328-37b2e7234466', 'Ciprofloxacin 0.30% Eye Drop', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Metformin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(396, 'c2273e55-e980-4bb7-83bb-9fd771542bbc', 'Metformin 500mg Tablet', NOW()),
(397, '156555e3-45b7-421a-858d-8be3198c7ddf', 'Metformin 750mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Zinc Sulphate
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(378, 'a87907ad-83f5-4969-80b5-d9466aa2bf3f', 'Zinc Sulphate 20mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Griseofulvin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(193, '913621d1-f5a9-4339-ad0e-5b90d747c845', 'Griseofulvin 125mg Tablet', NOW()),
(194, 'fe94593c-5304-49d2-b0f1-f328d35625ad', 'Griseofulvin 250mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Carbamazepine
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(88, 'cb857cde-7ecf-4f6b-ad3d-0bfd01674654', 'Carbamazepine 100mg Tablet', NOW()),
(89, '68c439e5-8b02-4268-a974-6cd8ab54c85b', 'Carbamazepine 200mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Diazepam
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(93, 'd911abcc-9c0a-4913-bd0c-2c789c7a111e', 'Diazepam 2mg Tablet', NOW()),
(94, '7191326b-7bad-4c5c-ba91-00c6c7d46f44', 'Diazepam 5mg Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Prednisolone
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(72, 'cf98e6fe-b7cd-4d80-8aa7-1dfe3fbd1840', 'Prednisolone 5mg Tablet', NOW()),
(73, '0f3bad35-139f-46ee-935c-5c0f862fff67', 'Prednisolone 10mg Tablet', NOW()),
(75, '2f6945f2-1c7a-4e86-95e8-20f35deff144', 'Prednisolone 15mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Calcium Gluconate
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(78, '184f3e7c-2d2e-40be-ab98-d748bc1eb27a', 'Calcium Gluconate 100mg/ml Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Praziquantel
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(123, 'e1239202-65c9-41e9-b6e2-e2a3432d4680', 'Praziquantel 600mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Mebendazole
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(118, 'd37a00af-7079-410d-91f4-25ccaa796ded', 'Mebendazole 100mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Albendazole
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(116, '0e77cc78-2967-4073-9b7f-40d641259af6', 'Albendazole 400mg Tablet', NOW()),
(117, '7c56d211-c623-4207-b151-ff1e9c59cd6d', 'Albendazole 200mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Ibuprofen
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(35, '252fb520-589b-48df-82b3-05b6e5bad7d9', 'Ibuprofen 200mg Tablet', NOW()),
(36, 'a84ccb80-63aa-43a5-80ad-25d5a30f63dc', 'Ibuprofen 400mg Capsule', NOW()),
(37, '2f467a5e-525e-4b0c-8b45-7210393e94cf', 'Ibuprofen 100mg Syrup', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Allopurinol
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(50, 'f5d40fdf-33ba-4977-ba8f-aa69bf3c59b2', 'Allopurinol 100mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Dexamethasone
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(68, '49b1aa6b-72a8-4655-ae71-c67837506e1e', 'Dexamethasone 0.5mg Tablet', NOW()),
(69, 'eee8bc53-c573-4ffa-86d1-0d2c01efe688', 'Dexamethasone 4mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Chlorpheniramine Maleate
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(66, '0554d85e-9973-4c75-80f7-66b09edc35a7', 'Chlorpheniramine Maleate 4mg Tablet', NOW()),
(67, '0199b5f4-29da-4940-9ef1-196ec6b40ebf', 'Chlorpheniramine Maleate 2mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Gentamicin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(170, '3f126a01-64dd-4674-80a2-f48077645c34', 'Gentamicin 10mg Injection', NOW()),
(171, 'c6dea830-cfca-4967-9253-571561d92dd6', 'Gentamicin 40mg Injection', NOW()),
(416, 'e6c5600d-0ddd-47e7-887f-9b85a09a8cc3', 'Gentamicin 0.3% Ointment', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Doxycycline
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(169, '3f1c8c5a-beac-4f25-8576-0d03559c0bcb', 'Doxycycline 100mg Capsule', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Fluconazole
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(186, 'f5a01fe5-6879-40ab-ba36-9af611ad0c5e', 'Fluconazole 100mg Capsule', NOW()),
(187, 'aa90b49f-d561-4ecc-9e47-855bc52449ab', 'Fluconazole 50mg Capsule', NOW()),
(189, '9a8086a0-3bcf-43b4-824e-3a981ab507f9', 'Fluconazole 200mg Capsule', NOW()),
(190, '2c387516-a0bd-4914-966b-33d990f1eb92', 'Fluconazole 400mg Capsule', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Cefixime
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(142, '7ee986b4-ec4d-441a-b0c0-ae59b9fe3b5b', 'Cefixime 200mg Tablet', NOW()),
(143, '5aff73f2-d53d-473c-a23b-4d34a7dad1f4', 'Cefixime 400mg Capsule', NOW()),
(145, 'fd245099-e280-484a-a2ae-ac27579b173d', 'Cefixime 100mg Suspension', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Cefadroxil
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(137, 'ed6fe524-879e-4fe0-b60f-271f4440264d', 'Cefadroxil 500mg Tablet', NOW()),
(138, '344e4a71-f85e-4220-ba8e-ad3f4c97467b', 'Cefadroxil 1g Tablet', NOW()),
(139, '1d778d37-23c0-43e1-87a9-3e74f1868783', 'Cefadroxil 125mg Solution', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Ceftriaxone
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(151, '7170e4a9-e986-438c-9322-f8bf684411ed', 'Ceftriaxone 250mg Injection', NOW()),
(152, '8224005b-d71f-43f3-9898-f7a72548181f', 'Ceftriaxone 500mg Injection', NOW()),
(153, '26d5876b-9313-4ceb-8e0f-e10f14e5a455', 'Ceftriaxone 1g Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Folic Acid
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(247, 'e2ec78c3-a56a-474a-a0cc-e51426f3d990', 'Folic Acid 5mg Tablet', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Potassium Chloride
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(492, 'd73a2e2a-ab23-4fe9-9780-973786f8715a', 'Potassium Chloride 150mg Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();

-- NEW: Oxytocin
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES
(442, '34d13384-9ba1-41bc-8798-b7854e389bd3', 'Oxytocin 10 Units Injection', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();
