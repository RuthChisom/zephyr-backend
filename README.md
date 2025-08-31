---
run node index.js to start
---

## Endpoints
### Upload Record
- POST /records
---
  Body (JSON):
{
  "patient": "0xPatientAddress",
  "fileContent": "Sensitive record content"
}
___
- Response:
{
  "recordId": "2c7d562f74c888c81b1b1b249803d174",
  "filePath": "/uploads/2c7d562f74c888c81b1b1b249803d174.enc",
  "hash": "d2c9cc5daf79d37bed65c9fe801889a6f"
}
___
### Grant Consent
- POST /consents/grant
___
Body (JSON):
{
  "doctor": "0xDoctorAddress",
  "scope": "ALL",
  "expiry": 1735689600
}
___
- Response:
{
  "success": true
___
expiry is a UNIX timestamp.

### Fetch Record
- GET /records/:id?viewer=<viewerAddress>
___
GET /records/"recordId"?viewer=0xDoctorAddress
---
- Response:
{
  "filePath": "/uploads/2c7d562f74c888c81b1b1b249803d174.enc"
}
  "dek": "hex-encoded-AES-key",
  "iv": "hex-encoded-IV"
}
Only allowed if the viewer has consent from the patient.
