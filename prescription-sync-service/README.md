# Bahmni Prescription Sync Service

Standalone service that connects Bahmni EMR with your pharmacy app (Dagu 2/eAPTS) for prescription dispensing - **no Odoo dependency**.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Bahmni EMR    │────▶│  Prescription Sync   │────▶│  Pharmacy App   │
│  (Frontend)     │     │     Service          │     │  (Dagu 2/eAPTS) │
└─────────────────┘     │    Port 3001         │     └─────────────────┘
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │     OpenMRS          │
                        │  (Direct REST API)   │
                        └──────────────────────┘
```

## Quick Start

### Local Development

```bash
cd prescription-sync-service
npm install
npm start
```

### Docker

The service is included in the Bahmni Docker Compose stack:

```bash
cd bahmni-docker/bahmni-standard
docker compose up prescription-sync -d
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/prescription/send` | Send single prescription to pharmacy |
| `POST` | `/api/prescription/bulk-send` | Send multiple prescriptions to pharmacy |
| `POST` | `/api/prescription/dtp-callback` | Receive DTP messages from pharmacy |
| `GET` | `/api/prescription/status/:uuid` | Get prescription status from OpenMRS |
| `GET` | `/health` | Health check |

## Send Prescription to Pharmacy

```bash
curl -X POST http://localhost:3001/api/prescription/send \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_uuid": "order-uuid-here",
    "patient": {
      "uuid": "patient-uuid",
      "identifier": "103555",
      "name": "endris m/d",
      "age": 45,
      "gender": "M"
    },
    "drug": {
      "bahmni_uuid": "drug-uuid",
      "drug_name": "Amoxicillin",
      "strength": "500mg",
      "dose": "500",
      "dose_units": "mg",
      "frequency": "TDS",
      "duration": "7",
      "duration_units": "days",
      "route": "Oral",
      "quantity": "21",
      "quantity_units": "tablets",
      "internal_code": "AMOX500"
    },
    "prescriber": "Dr. Smith",
    "dispenser": "Pharmacist",
    "instructions": "Take after meals",
    "status": "ISSUED",
    "unit_price": 25.50,
    "total_price": 535.50
  }'
```

## DTP Callback (Pharmacy → Bahmni)

Your pharmacy app can send DTP messages by POSTing to:

```bash
curl -X POST http://localhost:3001/api/prescription/dtp-callback \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_uuid": "order-uuid",
    "patient_uuid": "patient-uuid",
    "dtp_reason": "Drug not available in stock",
    "dtp_type": "DISCARDED",
    "drug_code": "AMOX500",
    "reported_by": "pharmacist_name",
    "reported_at": "2026-06-23T10:30:00.000Z"
  }'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Service port |
| `OPENMRS_URL` | `http://localhost:8080` | OpenMRS base URL |
| `OPENMRS_USER` | `admin` | OpenMRS username |
| `OPENMRS_PASS` | `Admin123` | OpenMRS password |
| `PHARMACY_APP_URL` | `http://localhost/dispensing-unit` | Pharmacy app base URL |

### Bahmni Config

In `config/openmrs/apps/registration/app.json`:

```json
"pharmacy_integration": {
    "enabled": true,
    "pharmacy_app_url": "http://localhost:3001",
    "send_on_save": true,
    "send_on_dispense": true,
    "dtp_callback_enabled": true
}
```

## How It Works

1. **Prescription Created**: When a pharmacist performs an action (evaluate, bill, dispense) in Bahmni, the frontend sends the prescription data to this service.

2. **Forward to Pharmacy**: The service forwards the prescription to your pharmacy app (Dagu 2/eAPTS) at the configured endpoint.

3. **DTP Callback**: When your pharmacy app needs to report a DTP (Drug-Target-Patient) issue, it sends a POST to the DTP callback endpoint.

4. **OpenMRS Update**: The service creates observations directly in OpenMRS via REST API - no Odoo involved.

## Drug Mapping

The `internal_code` field in the prescription maps to your pharmacy app's drug code. When a pharmacist enters the internal code during billing, it's sent to the pharmacy app as `drug.internal_code`.

## Troubleshooting

### Service not starting

```bash
# Check logs
docker compose logs prescription-sync

# Or locally
npm start
```

### Cannot connect to OpenMRS

Ensure OpenMRS is running and accessible:
```bash
curl http://localhost:8080/openmrs/ws/rest/v1/session
```

### Cannot connect to Pharmacy App

Ensure your pharmacy app is running:
```bash
curl http://localhost/dispensing-unit/login
```
