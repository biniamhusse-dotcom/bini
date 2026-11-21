================================================================================
BAHMNI PATIENT SAVE FIX - SERVER-SIDE PATCH
================================================================================

PROBLEM:
--------
Saving a new patient on remote server 192.168.10.5 fails with:
  "There was an unexpected issue on the server. Please try again
   Unable to convert object into response content"

Server logs show TWO bugs in BahmniPatientProfileResource.java:

1. ConversionException: The patient property is missing
   - at HashMap.putMapEntries(HashMap.java:502)
   - at BaseDelegatingResource.setConvertedProperties(BaseDelegatingResource.java:582)
   - Caused by null values in nested maps (birthtime, deathDate, causeOfDeath)

2. NullPointerException
   - at BahmniPatientProfileResource.getRelationships(BahmniPatientProfileResource.java:232)
   - at BahmniPatientProfileResource.mapForCreatePatient(BahmniPatientProfileResource.java:200)
   - Caused by null "relationships" field in new patient payload

FIXES APPLIED TO BahmniPatientProfileResource.java:
====================================================

Fix 1: create() - Null-safe handling of patient map and identifiers (line 79-83)
Fix 2: mapForCreatePatient() - Null check for patient from getPatient() (line 203-205)
Fix 3: getRelationships() - Return empty list when relationships is null (line 245-248)
Fix 4: mapForUpdatePatient() - Strip nulls from patient map before getPatientForUpdate (line 222, 224-231)
Fix 5: stripNullsFromMaps() - New helper method to remove null values from nested maps (line 269-292)

CLIENT-SIDE FIX (ALREADY DEPLOYED):
===================================
apps/ui/app/registration/mappers/createPatientRequestMapper.js
  - Added stripNulls helper to remove null/undefined from payload
  - Only include birthtime/deathDate/causeOfDeath when they have values
  - Only include identifier uuid when truthy
  - Deployed to /opt/emr/apps/ui/app/registration/mappers/ on 192.168.10.5
  - Synced to bahmni-standard-bahmni-web-1 container
  - Proxy cache cleared at /var/cache/mod_proxy/

================================================================================
DEPLOYMENT INSTRUCTIONS
================================================================================

STEP 1: Compile the patched Java source
-----------------------------------------
You need a machine with JDK 8 or 11 and Maven, plus all OpenMRS/Bahmni
dependencies. The source file is: BahmniPatientProfileResource.java

Required dependencies (from the remote server's bahmnicore.jar):
  - openmrs-api-2.5.12.jar
  - openmrs-web-2.5.12.jar
  - emrapi module JAR
  - bahmnicore-api-1.2.0.jar
  - commons-beanutils, commons-lang3, jackson, spring-web, etc.

Compile command example:
  javac -cp "path/to/all/dependencies/*" BahmniPatientProfileResource.java

Or use Maven if you have the full Bahmni source project:
  mvn -pl bahmnicore compile

STEP 2: Replace the class in bahmnicore.jar
---------------------------------------------
On the remote server (192.168.10.5):

  # Back up the original JAR
  cp /openmrs/data/.openmrs-lib-cache/bahmnicore/bahmnicore.jar \
     /openmrs/data/.openmrs-lib-cache/bahmnicore/bahmnicore.jar.bak.$(date +%s)

  # Extract the JAR, replace the class, repack
  cd /tmp
  mkdir -p bahmnicore-patch
  cd bahmnicore-patch
  jar xf /openmrs/data/.openmrs-lib-cache/bahmnicore/bahmnicore.jar
  cp /path/to/BahmniPatientProfileResource.class \
     org/bahmni/module/bahmnicore/web/v1_0/controller/BahmniPatientProfileResource.class
  jar uf /openmrs/data/.openmrs-lib-cache/bahmnicore/bahmnicore.jar \
     org/bahmni/module/bahmnicore/web/v1_0/controller/BahmniPatientProfileResource.class

  # Verify the class was replaced
  unzip -l /openmrs/data/.openmrs-lib-cache/bahmnicore/bahmnicore.jar | grep BahmniPatientProfileResource

STEP 3: Restart OpenMRS container
----------------------------------
  docker restart bahmni-standard-openmrs-1

  # Wait for OpenMRS to start (check logs)
  docker logs bahmni-standard-openmrs-1 --tail 20 -f

STEP 4: Verify the fix
-----------------------
  # Test the patient creation endpoint
  curl -sk -u admin:Admin123 -X POST \
    https://192.168.10.5/openmrs/ws/rest/v1/bahmnicore/patientprofile \
    -H 'Content-Type: application/json' \
    -d '{"patient":{"person":{"names":[{"givenName":"Test","familyName":"Patient","preferred":false}],"gender":"M","birthdate":"1990-01-01","addresses":[],"attributes":[]},"identifiers":[]}}'

  Expected: HTTP 201 or 200 (patient created successfully)
  Before fix: HTTP 400 "Unable to convert object into response content"

STEP 5: Clear browser cache
----------------------------
Users must hard-refresh the registration page (Ctrl+F5) to load the
updated createPatientRequestMapper.js.

================================================================================
FILES INCLUDED:
====================================================
- BahmniPatientProfileResource.java  (patched server-side source)
- bppr.java                          (original decompiled source, for reference)

================================================================================
SUMMARY OF CHANGES IN BahmniPatientProfileResource.java:
====================================================

1. create() (line 79-83):
   BEFORE: List identifiers = ((ArrayList) ((LinkedHashMap) propertiesToCreate.get("patient")).get("identifiers"));
   AFTER:  Null-safe patientMap extraction with empty ArrayList fallback

2. mapForCreatePatient() (line 203-205):
   BEFORE: delegate.setPatient(patientResource1_9.getPatient(...));
   AFTER:  Null check: if patient == null, create new Patient()

3. getRelationships() (line 245-248):
   BEFORE: List<Map<String, Object>> relationshipProperties = (List) relationshipsList;
   AFTER:  Null check: if relationshipsList == null, return empty ArrayList

4. mapForUpdatePatient() (line 222, 224-231):
   BEFORE: Patient patient = patientResource1_9.getPatientForUpdate(uuid, (Map) propertiesToUpdate.get("patient"));
   AFTER:  Strip nulls from patientMap before passing to getPatientForUpdate
           Null-safe identifiers list with empty ArrayList fallback
           Skip non-Map identifier entries

5. stripNullsFromMaps() (line 269-292):
   NEW: Recursive helper to remove null values from nested maps,
   preventing HashMap.putMapEntries(null) NPE in setConvertedProperties

================================================================================
