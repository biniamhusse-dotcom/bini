# Clinical Reference Tools for Bahmni EMR

A comprehensive clinical decision support system integrated with Bahmni EMR, providing free/open-source alternatives to UpToDate.

## Features

### 1. Drug Information & Search
- **FDA Drug Database**: Search brand names, generic names, manufacturers
- **Drug Label Information**: Indications, dosages, warnings, contraindications, adverse reactions
- **RxNorm Integration**: Standardized drug nomenclature
- **DailyMed**: Drug interaction information

### 2. PubMed Literature Search
- Search 30M+ medical citations
- Author, journal, and publication date information
- Direct links to PubMed articles

### 3. Clinical Calculators (20+)
- **BMI Calculator**: Body Mass Index
- **MAP**: Mean Arterial Pressure
- **GCS**: Glasgow Coma Scale
- **Wells PE**: Wells Score for Pulmonary Embolism
- **CURB-65**: Pneumonia Severity
- **CHA2DS2-VASc**: Stroke Risk in AF
- **SOFA**: Sequential Organ Failure Assessment
- **qSOFA**: Quick Sepsis Screening
- **PHQ-9**: Depression Screening
- **GAD-7**: Anxiety Screening
- **Child-Pugh**: Liver Disease Severity
- And more...

### 4. Clinical Practice Guidelines
- **Sepsis-3**: SCCM/ESICM Definitions
- **WHO CAP**: Community-Acquired Pneumonia
- **ACC/AHA AF**: Atrial Fibrillation 2023
- **GOLD COPD**: Chronic Obstructive Pulmonary Disease
- **RCP NEWS2**: National Early Warning Score
- And more...

### 5. Drug Safety Check
- Check multiple drug interactions
- Patient context integration (diagnoses, current medications)
- Contraindication alerts
- Safety warnings

## Architecture

```
bahmni-cdss-integration (Port 3012)
    ├── medical-mcp (Port 3010)
    │   ├── OpenFDA API
    │   ├── PubMed E-utilities
    │   ├── WHO GHO API
    │   └── RxNorm API
    └── open-medicine (Port 3011)
        ├── Clinical Calculators
        └── Clinical Guidelines
```

## Installation

### Docker Compose

```bash
cd clinical-reference
docker compose up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| medical-mcp | 3010 | Drug info, PubMed, WHO statistics |
| open-medicine | 3011 | Clinical calculators, guidelines |
| cdss-integration | 3012 | Unified API for Bahmni integration |

## API Endpoints

### Medical MCP (Port 3010)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drugs/search?name=` | GET | Search FDA drug database |
| `/api/drugs/label?name=` | GET | Get drug label information |
| `/api/pubmed/search?query=` | GET | Search PubMed literature |
| `/api/who/health-stats?country=` | GET | Get WHO health statistics |
| `/api/icd10/search?code=` | GET | ICD-10 code lookup |
| `/api/rxnorm/normalize?name=` | GET | Normalize drug names |

### Open Medicine (Port 3011)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calculators/list` | GET | List all clinical calculators |
| `/api/calculators/{id}` | GET | Run a specific calculator |
| `/api/guidelines/list` | GET | List all clinical guidelines |
| `/api/guidelines/{id}` | GET | Get guideline details |

### CDSS Integration (Port 3012)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical/search?query=` | GET | Search across all tools |
| `/api/clinical/drug-check` | POST | Check drug interactions |
| `/api/clinical/patient/{uuid}/context` | GET | Get patient clinical context |

## Bahmni Integration

The clinical reference module is accessible from the Bahmni home page:

1. Navigate to Bahmni Home
2. Click on "Clinical Reference" tab
3. Select from:
   - Drug Search
   - Clinical Calculators
   - Clinical Guidelines
   - Drug Safety Check

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEDICAL_MCP_URL` | `http://medical-mcp:3010` | Medical MCP service URL |
| `OPEN_MEDICINE_URL` | `http://open-medicine:3011` | Open Medicine service URL |
| `OPENMRS_URL` | `http://openmrs:8080` | OpenMRS server URL |

## Usage Examples

### Search for a Drug

```bash
curl "http://localhost:3010/api/drugs/search?name=aspirin"
```

### Run BMI Calculator

```bash
curl "http://localhost:3011/api/calculators/bmi?weight_kg=70&height_m=1.75"
```

### Check Drug Interactions

```bash
curl -X POST "http://localhost:3012/api/clinical/drug-check" \
  -H "Content-Type: application/json" \
  -d '{"drugs": ["aspirin", "warfarin"], "patientDiagnoses": ["atrial fibrillation"]}'
```

## Evidence Sources

- **FDA**: All FDA-approved drugs (US)
- **PubMed**: 30M+ medical citations
- **WHO**: Global health statistics
- **RxNorm**: Standardized drug nomenclature
- **NICE**: UK clinical guidelines
- **ACC/AHA**: American cardiology guidelines
- **GOLD**: COPD guidelines
- **SCCM/ESICM**: Critical care guidelines

## License

This project uses free and open-source tools:
- Medical MCP: MIT License
- Open Medicine: MIT License
- Clinical data from public APIs (FDA, PubMed, WHO)
