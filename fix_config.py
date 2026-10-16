import json

config_path = "/etc/bahmni_config/openmrs/apps/registration/app.json"

with open(config_path, "r") as f:
    config = json.load(f)

hx = config.get("prescription_config", {}).get("hx_available", [])
for item in hx:
    if item.get("concept_name") == "Systolic":
        item["concept_name"] = "Systolic blood pressure"
    if item.get("concept_name") == "Diastolic":
        item["concept_name"] = "Diastolic blood pressure"
    if item.get("concept_name") == "Weight":
        item["concept_name"] = "Weight (kg)"
    if item.get("concept_name") == "HEIGHT":
        item["concept_name"] = "Height"
    if item.get("concept_name") == "Coded":
        item["concept_name"] = "Coded Diagnosis"

with open(config_path, "w") as f:
    json.dump(config, f, indent=4)

print("Config updated successfully")
