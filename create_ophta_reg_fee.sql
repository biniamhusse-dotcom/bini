-- Create Ophta Registration Fee concept
INSERT INTO concept (class_id, datatype_id, creator, date_created, uuid, retired)
VALUES (11, 13, 1, NOW(), UUID(), 0);

SET @ophta_concept_id = (SELECT MAX(concept_id) FROM concept);

-- Add English name
INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, uuid, concept_name_type)
VALUES (@ophta_concept_id, 'Ophta Registration Fee', 'en', 1, 1, NOW(), UUID(), 'FULLY_SPECIFIED');

-- Add as child of Registration Fee (57400) concept set
INSERT INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
VALUES (@ophta_concept_id, 57400, 4, 1, NOW(), UUID());

SELECT @ophta_concept_id AS 'Created Ophta Registration Fee concept_id';
