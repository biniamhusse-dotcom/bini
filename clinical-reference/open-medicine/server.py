from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

app = FastAPI(title="Bahmni Clinical Calculators & Guidelines", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CalculatorResult(BaseModel):
    name: str
    input: dict
    result: float
    interpretation: str
    source: str
    doi: Optional[str] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "open-medicine", "timestamp": datetime.now().isoformat()}

@app.get("/api/calculators/list")
async def list_calculators():
    calculators = [
        {"id": "bmi", "name": "BMI Calculator", "category": "Anthropometry", "inputs": ["weight_kg", "height_m"]},
        {"id": "map", "name": "Mean Arterial Pressure", "category": "Cardiology", "inputs": ["systolic", "diastolic"]},
        {"id": "gcs", "name": "Glasgow Coma Scale", "category": "Neurology", "inputs": ["eye", "verbal", "motor"]},
        {"id": "wells_pe", "name": "Wells Score for PE", "category": "Pulmonology", "inputs": ["clinical_signs_dvt", "pe_most_likely", "heart_rate", "immobilization", "previous_pe", "hemoptysis", "malignancy"]},
        {"id": "curb65", "name": "CURB-65 Score", "category": "Pulmonology", "inputs": ["confusion", "urea", "respiratory_rate", "blood_pressure", "age_65plus"]},
        {"id": "cha2ds2vasc", "name": "CHA2DS2-VASc Score", "category": "Cardiology", "inputs": ["chf", "hypertension", "age_75plus", "diabetes", "stroke", "vascular_disease", "age_65_74", "female"]},
        {"id": "hasbled", "name": "HAS-BLED Score", "category": "Cardiology", "inputs": ["hypertension", "abnormal_renal", "abnormal_liver", "stroke", "bleeding", "labile_inr", "elderly", "drugs", "alcohol"]},
        {"id": "sofa", "name": "SOFA Score", "category": "Critical Care", "inputs": ["pao2_fio2", "platelets", "bilirubin", "map", "gcs", "creatinine"]},
        {"id": "qsofa", "name": "qSOFA Score", "category": "Sepsis", "inputs": ["respiratory_rate", "altered_mentation", "systolic_bp"]},
        {"id": "phq9", "name": "PHQ-9 Depression", "category": "Psychiatry", "inputs": ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"]},
        {"id": "gad7", "name": "GAD-7 Anxiety", "category": "Psychiatry", "inputs": ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]},
        {"id": "child_pugh", "name": "Child-Pugh Score", "category": "Hepatology", "inputs": ["bilirubin", "albumin", "inr", "ascites", "encephalopathy"]}
    ]
    return {"count": len(calculators), "calculators": calculators}

@app.get("/api/calculators/bmi")
async def calculate_bmi(weight_kg: float = Query(...), height_m: float = Query(...)):
    bmi = weight_kg / (height_m ** 2)
    if bmi < 18.5:
        interp = "Underweight"
    elif bmi < 25:
        interp = "Normal weight"
    elif bmi < 30:
        interp = "Overweight"
    else:
        interp = "Obese"
    return CalculatorResult(name="BMI", input={"weight_kg": weight_kg, "height_m": height_m}, result=round(bmi, 1), interpretation=interp, source="WHO")

@app.get("/api/calculators/map")
async def calculate_map(systolic: float = Query(...), diastolic: float = Query(...)):
    map_val = diastolic + (systolic - diastolic) / 3
    interp = "Normal" if 70 <= map_val <= 100 else ("Hypotensive" if map_val < 70 else "Hypertensive")
    return CalculatorResult(name="MAP", input={"systolic": systolic, "diastolic": diastolic}, result=round(map_val, 1), interpretation=interp, source="ACE/ACC")

@app.get("/api/calculators/gcs")
async def calculate_gcs(eye: int = Query(...), verbal: int = Query(...), motor: int = Query(...)):
    gcs = eye + verbal + motor
    if gcs >= 13:
        interp = "Mild brain injury"
    elif gcs >= 9:
        interp = "Moderate brain injury"
    else:
        interp = "Severe brain injury"
    return CalculatorResult(name="GCS", input={"eye": eye, "verbal": verbal, "motor": motor}, result=float(gcs), interpretation=interp, source="Teasdale & Jennett")

@app.get("/api/calculators/wells_pe")
async def calculate_wells_pe(
    clinical_signs_dvt: int = Query(...), pe_most_likely: int = Query(...),
    heart_rate: int = Query(...), immobilization: int = Query(...),
    previous_pe: int = Query(...), hemoptysis: int = Query(...), malignancy: int = Query(...)
):
    score = clinical_signs_dvt + pe_most_likely + heart_rate + immobilization + previous_pe + hemoptysis + malignancy
    interp = "Low/Moderate - consider D-dimer" if score <= 4 else "High probability - proceed to CTPA"
    return CalculatorResult(name="Wells PE", input={"score": score}, result=float(score), interpretation=interp, source="Wells et al.")

@app.get("/api/calculators/curb65")
async def calculate_curb65(
    confusion: int = Query(...), urea: float = Query(...),
    respiratory_rate: int = Query(...), blood_pressure: float = Query(...), age_65plus: int = Query(...)
):
    score = confusion
    if urea > 7: score += 1
    if respiratory_rate >= 30: score += 1
    if blood_pressure < 90: score += 1
    score += age_65plus
    if score <= 1:
        interp = "Low risk - consider outpatient"
    elif score == 2:
        interp = "Moderate risk - consider admission"
    else:
        interp = "High risk - consider ICU"
    return CalculatorResult(name="CURB-65", input={"score": score}, result=float(score), interpretation=interp, source="Lim et al.")

@app.get("/api/calculators/cha2ds2vasc")
async def calculate_cha2ds2vasc(
    chf: int = Query(...), hypertension: int = Query(...), age_75plus: int = Query(...),
    diabetes: int = Query(...), stroke: int = Query(...), vascular_disease: int = Query(...),
    age_65_74: int = Query(...), female: int = Query(...)
):
    score = chf + hypertension + age_75plus + diabetes + stroke + vascular_disease + age_65_74 + female
    if score == 0:
        interp = "Low risk - no anticoagulation"
    elif score == 1:
        interp = "Low-moderate risk - consider anticoagulation"
    else:
        interp = "Moderate-high risk - anticoagulation recommended"
    return CalculatorResult(name="CHA2DS2-VASc", input={"score": score}, result=float(score), interpretation=interp, source="Lip et al.")

@app.get("/api/calculators/sofa")
async def calculate_sofa(
    pao2_fio2: float = Query(...), platelets: float = Query(...), bilirubin: float = Query(...),
    map_val: float = Query(...), gcs: int = Query(...), creatinine: float = Query(...)
):
    score = 0
    if pao2_fio2 < 100: score += 4
    elif pao2_fio2 < 200: score += 3
    elif pao2_fio2 < 300: score += 2
    elif pao2_fio2 < 400: score += 1
    if platelets < 20: score += 4
    elif platelets < 50: score += 3
    elif platelets < 100: score += 2
    elif platelets < 150: score += 1
    if bilirubin > 12: score += 4
    elif bilirubin > 6: score += 3
    elif bilirubin > 2: score += 2
    elif bilirubin > 1.2: score += 1
    if map_val < 40: score += 4
    elif map_val < 70: score += 1
    if gcs < 6: score += 4
    elif gcs < 10: score += 3
    elif gcs < 13: score += 2
    elif gcs < 15: score += 1
    if creatinine > 5: score += 4
    elif creatinine > 3.5: score += 3
    elif creatinine > 2: score += 2
    elif creatinine > 1.2: score += 1
    if score <= 1: interp = "Minimal organ dysfunction"
    elif score <= 6: interp = "Moderate organ dysfunction"
    elif score <= 9: interp = "Severe organ dysfunction"
    else: interp = "Very severe organ dysfunction"
    return CalculatorResult(name="SOFA", input={"score": score}, result=float(score), interpretation=interp, source="Vincent et al.")

@app.get("/api/calculators/qsofa")
async def calculate_qsofa(respiratory_rate: int = Query(...), altered_mentation: int = Query(...), systolic_bp: float = Query(...)):
    score = 0
    if respiratory_rate >= 22: score += 1
    if altered_mentation: score += 1
    if systolic_bp <= 100: score += 1
    interp = "Low risk" if score < 2 else "High risk - assess for sepsis"
    return CalculatorResult(name="qSOFA", input={"score": score}, result=float(score), interpretation=interp, source="Sepsis-3")

@app.get("/api/calculators/phq9")
async def calculate_phq9(
    q1: int = Query(...), q2: int = Query(...), q3: int = Query(...), q4: int = Query(...), q5: int = Query(...),
    q6: int = Query(...), q7: int = Query(...), q8: int = Query(...), q9: int = Query(...)
):
    score = q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8 + q9
    if score <= 4: interp = "Minimal depression"
    elif score <= 9: interp = "Mild depression"
    elif score <= 14: interp = "Moderate depression"
    elif score <= 19: interp = "Moderately severe depression"
    else: interp = "Severe depression"
    return CalculatorResult(name="PHQ-9", input={"score": score}, result=float(score), interpretation=interp, source="Kroenke et al.")

@app.get("/api/calculators/gad7")
async def calculate_gad7(
    q1: int = Query(...), q2: int = Query(...), q3: int = Query(...), q4: int = Query(...),
    q5: int = Query(...), q6: int = Query(...), q7: int = Query(...)
):
    score = q1 + q2 + q3 + q4 + q5 + q6 + q7
    if score <= 4: interp = "Minimal anxiety"
    elif score <= 9: interp = "Mild anxiety"
    elif score <= 14: interp = "Moderate anxiety"
    else: interp = "Severe anxiety"
    return CalculatorResult(name="GAD-7", input={"score": score}, result=float(score), interpretation=interp, source="Spitzer et al.")

@app.get("/api/calculators/child_pugh")
async def calculate_child_pugh(
    bilirubin: float = Query(...), albumin: float = Query(...), inr: float = Query(...),
    ascites: int = Query(...), encephalopathy: int = Query(...)
):
    score = 0
    if bilirubin > 3: score += 3
    elif bilirubin > 2: score += 2
    else: score += 1
    if albumin < 2.8: score += 3
    elif albumin < 3.5: score += 2
    else: score += 1
    if inr > 2.3: score += 3
    elif inr > 1.7: score += 2
    else: score += 1
    score += ascites
    score += encephalopathy
    if score <= 6: interp = "Class A - 1 year survival ~100%"
    elif score <= 9: interp = "Class B - 1 year survival ~80%"
    else: interp = "Class C - 1 year survival ~45%"
    return CalculatorResult(name="Child-Pugh", input={"score": score}, result=float(score), interpretation=interp, source="Pugh et al.")

@app.get("/api/guidelines/list")
async def list_guidelines():
    guidelines = [
        {"id": "sepsis3", "name": "Sepsis-3 Definitions", "source": "SCCM/ESICM", "year": 2016},
        {"id": "who_cap", "name": "WHO Community-Acquired Pneumonia", "source": "WHO", "year": 2019},
        {"id": "acc_aha_af", "name": "ACC/AHA Atrial Fibrillation 2023", "source": "ACC/AHA", "year": 2023},
        {"id": "gold_copd", "name": "GOLD COPD 2024", "source": "GOLD", "year": 2024},
        {"id": "rcp_news2", "name": "RCP NEWS2 Score", "source": "Royal College of Physicians", "year": 2017}
    ]
    return {"count": len(guidelines), "guidelines": guidelines}

@app.get("/api/guidelines/{guideline_id}")
async def get_guideline(guideline_id: str):
    guidelines = {
        "sepsis3": {"id": "sepsis3", "name": "Sepsis-3 Definitions", "source": "Singer et al., JAMA 2016", "key_recommendations": ["Sepsis = life-threatening organ dysfunction from dysregulated host response to infection", "SOFA score >=2 indicates organ dysfunction", "qSOFA >=2 suggests high risk for poor outcome", "Septic shock: vasopressors for MAP >=65 AND lactate >2 mmol/L"]},
        "who_cap": {"id": "who_cap", "name": "WHO CAP Guidelines", "source": "WHO 2019", "key_recommendations": ["Mild: Amoxicillin 500mg TID 5-7 days", "Moderate: Amoxicillin-Clavulanate or Cephalosporin", "Severe: Fluoroquinolone or Macrolide + Beta-lactam", "Follow-up CXR at 6 weeks"]},
        "acc_aha_af": {"id": "acc_aha_af", "name": "ACC/AHA AF 2023", "source": "January et al., Circulation 2023", "key_recommendations": ["Anticoagulation for CHA2DS2-VASc >=2 (men) or >=3 (women)", "DOACs preferred over warfarin", "Rate control target: HR <110 bpm", "Catheter ablation first-line for paroxysmal AF"]},
        "gold_copd": {"id": "gold_copd", "name": "GOLD COPD 2024", "source": "GOLD", "key_recommendations": ["Spirometry: FEV1/FVC <0.70 for diagnosis", "Group A: Bronchodilator (LABA or LAMA)", "Group B: LABA + LAMA", "Group E: LABA + LAMA + ICS if eos >=300", "Smoking cessation most important intervention"]},
        "rcp_news2": {"id": "rcp_news2", "name": "RCP NEWS2", "source": "Royal College of Physicians 2017", "key_recommendations": ["Score 0: Low risk - routine monitoring", "Score 1-4: Low-moderate - increase monitoring", "Score 5-6: High risk - urgent clinical review", "Score >=7: Very high risk - emergency response"]}
    }
    if guideline_id in guidelines:
        return guidelines[guideline_id]
    return {"error": "Guideline not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3011)
