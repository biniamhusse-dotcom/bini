# Lab Reception Stock-Out Workflow - Implementation Guide

## Overview

This document describes the implementation of the "In-Stock vs. Stock-Out" check workflow at the OpenELIS Lab Reception counter. The solution leverages OpenELIS's native Sample Collection screen with a small workflow adjustment to handle reagent stock-out situations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Lab Reception Workflow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Patient Arrives → OpenELIS Sample Collection Screen                 │
│                            │                                         │
│                            ▼                                         │
│                   ┌─────────────────┐                               │
│                   │  Test Available? │                               │
│                   └────────┬────────┘                               │
│                            │                                         │
│              ┌─────────────┴─────────────┐                         │
│              │                           │                         │
│              ▼                           ▼                         │
│    ┌─────────────────┐         ┌─────────────────┐                │
│    │  Collect Sample  │         │  Void Order     │                │
│    │  (Standard)      │         │  (Stock-Out)    │                │
│    └────────┬────────┘         └────────┬────────┘                │
│              │                           │                         │
│              ▼                           ▼                         │
│    ┌─────────────────┐         ┌─────────────────┐                │
│    │  Generate        │         │  Print Stock-   │                │
│    │  Barcode/Label   │         │  Out Notice     │                │
│    └────────┬────────┘         └────────┬────────┘                │
│              │                           │                         │
│              ▼                           ▼                         │
│    ┌─────────────────┐         ┌─────────────────┐                │
│    │  Proceed to      │         │  Hand Notice to │                │
│    │  Testing         │         │  Patient        │                │
│    └─────────────────┘         └────────┬────────┘                │
│                                          │                         │
│                                          ▼                         │
│                                ┌─────────────────┐                │
│                                │  Atomfeed Sync   │                │
│                                │  to Odoo         │                │
│                                └────────┬────────┘                │
│                                          │                         │
│                                          ▼                         │
│                                ┌─────────────────┐                │
│                                │  Cancel/Mark     │                │
│                                │  Non-Billable    │                │
│                                └─────────────────┘                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Files Modified/Created

### 1. Configuration Changes

**File:** `config/masterdata/configuration/globalproperties/gp_elisatomfeed.xml`
- **Change:** Enabled order cancellation sync by setting `elisatomfeedclient.discontinueCancelledOrders = true`
- **Added:** `elisatomfeedclient.voidReasonForStockOut` property with value "Reagent Stock Out"

### 2. Stock-Out Notice Templates

**Created Files:**
- `openelis-jsp/reports/stockOutNotice.jsp` - JSP template for printing stock-out notice
- `openelis-jsp/reports/StockOutNoticeAction.java` - Struts Action class for notice generation
- `openelis-jsp/reports/StockOutNoticeAPIAction.java` - API endpoint for AJAX calls
- `openelis-jsp/reports/StockOutNoticeService.java` - Business logic service

### 3. UI Components

**Created Files:**
- `openelis-jsp/dashboard/stockOutHandler.js` - JavaScript handler for UI interactions
- `openelis-jsp/dashboard/stockOutPanel.jsp` - UI panel for void operations

### 4. Database Migrations

**Created File:**
- `config/openelis/migrations/stock_out_notice_migration.sql` - Database schema changes

### 5. Localization

**Modified File:**
- `openelis-jsp/MessageResources.properties` - Added stock-out UI labels

### 6. Struts Configuration

**Modified File:**
- `openelis-jsp/struts-globalOpenELIS.xml` - Added action mappings for stock-out notice
- `openelis-jsp/tiles-defs.xml` - Added tile definition for stock-out notice page

### 7. Odoo Integration

**Modified File:**
- `bahmni_api_feed/models/api_event_worker.py` - Added handlers for order cancellation events

## Workflow Steps

### Step 1: Patient Arrival at Lab Reception

1. Receptionist searches for patient or order ID on OpenELIS Sample Collection screen
2. System displays list of ordered tests with availability status

### Step 2: Availability Check & Action

**For Available Tests:**
1. Receptionist clicks "Collect Sample"
2. System generates sample container barcode/number
3. Receptionist collects specimen
4. Process continues to testing phase

**For Out-of-Stock Tests:**
1. Receptionist selects test line item(s)
2. Clicks "Void Order (Stock-Out)" button
3. Confirms void reason: "Reagent Stock Out"
4. System generates stock-out notice

### Step 3: Printing the Stock-Out Slip

1. System displays confirmation with notice number
2. Auto-opens print window with formatted notice
3. Receptionist prints notice for patient
4. Notice includes:
   - Notice number and date
   - Patient information
   - List of voided tests
   - Required actions
   - Signature lines

### Step 4: Odoo Reconciliation

1. Atomfeed-console detects order void in OpenELIS
2. Syncs cancellation back to OpenMRS and Odoo
3. Automatically drops or marks item as non-billable on patient's Odoo draft quotation
4. Billing team can see cancelled items in Odoo dashboard

## Required Configurations in OpenELIS & Bahmni

### 1. Enable Order Cancellation Sync

**File:** `gp_elisatomfeed.xml`
```xml
<globalProperty>
    <property>elisatomfeedclient.discontinueCancelledOrders</property>
    <value>true</value>
</globalProperty>
<globalProperty>
    <property>elisatomfeedclient.voidReasonForStockOut</property>
    <value>Reagent Stock Out</value>
</globalProperty>
```

### 2. Custom Printed Template in OpenELIS

**Location:** Administration > Report Templates
- Template: Stock-Out Notice (stockOutNotice.jsp)
- Format: Non-Conformity Report for Reagent Unavailability
- Includes: Notice number, patient info, voided tests, actions required

### 3. Database Schema Updates

**Tables Created:**
- `stock_out_notice` - Main notice header
- `stock_out_notice_item` - Line items for voided tests

**Views Created:**
- `stock_out_report_view` - Reporting view joining notice and items

### 4. Global Properties Added

| Property | Value | Description |
|----------|-------|-------------|
| `stockout.notice.enabled` | `true` | Enable stock-out notice feature |
| `stockout.default.void.reason` | `Reagent Stock Out` | Default void reason |
| `stockout.auto.sync.odo` | `true` | Auto-sync cancellations to Odoo |

## API Endpoints

### Generate Stock-Out Notice
**URL:** `/openelis/StockOutNoticeAPI.do`
**Method:** POST
**Parameters:**
- `action`: `generateNotice`
- `accessionNumber`: Lab number
- `voidedTestIds[]`: Array of test IDs to void
- `voidReason`: Reason for void (default: "Reagent Stock Out")

**Response:**
```json
{
    "success": true,
    "noticeNumber": "SO-12345",
    "noticeDate": "17/09/2026 10:30",
    "patientName": "John Doe",
    "patientId": "12345",
    "accessionNumber": "LAB-2026-001",
    "voidedTests": [
        {
            "testName": "Complete Blood Count",
            "testCode": "CBC",
            "sampleType": "Blood",
            "voidReason": "Reagent Stock Out",
            "voidTime": "17/09/2026 10:30"
        }
    ]
}
```

### Print Stock-Out Notice
**URL:** `/openelis/StockOutNotice.do`
**Method:** GET
**Parameters:**
- `accessionNumber`: Lab number

**Returns:** HTML page for printing

## Testing the Workflow

### Test Case 1: Void Order with Stock-Out
1. Navigate to OpenELIS Sample Collection screen
2. Search for a patient with pending tests
3. Select test(s) to void
4. Click "Void Order (Stock-Out)"
5. Confirm void reason
6. Verify stock-out notice is generated
7. Verify print window opens
8. Verify order is cancelled in Odoo

### Test Case 2: Verify Odoo Sync
1. Void an order in OpenELIS
2. Wait for atomfeed sync (typically < 1 minute)
3. Check Odoo draft quotation
4. Verify cancelled line item is marked as non-billable or removed

### Test Case 3: Print Stock-Out Notice
1. Generate a stock-out notice
2. Print the notice
3. Verify all fields are populated correctly
4. Verify notice is formatted for printing

## Troubleshooting

### Issue: Order not cancelling in Odoo
- Check atomfeed-console logs
- Verify `elisatomfeedclient.discontinueCancelledOrders = true`
- Check network connectivity between OpenMRS and Odoo

### Issue: Stock-out notice not printing
- Verify `stockOutNotice.jsp` is deployed correctly
- Check browser console for JavaScript errors
- Verify Struts action mapping is correct

### Issue: Database migration failed
- Check PostgreSQL permissions
- Verify migration script syntax
- Check for existing tables/columns

## Monitoring and Reporting

### Stock-Out Report
Use the `stock_out_report_view` to generate reports:
```sql
SELECT * FROM stock_out_report_view 
WHERE notice_date BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY notice_date DESC;
```

### Key Metrics
- Number of stock-outs per day/week/month
- Most common voided tests
- Average time to resolve stock-outs
- Impact on billing (cancelled amounts)

## Future Enhancements

1. **Email Notifications**: Auto-notify procurement when reagents are out of stock
2. **Dashboard Widget**: Real-time stock-out status on lab dashboard
3. **Reagent Tracking**: Link stock-outs to inventory management
4. **Analytics**: Detailed reporting on stock-out patterns
5. **Mobile App**: Stock-out notice delivery via SMS/mobile app

## Support

For issues or questions:
- Check OpenELIS logs: `/var/log/openelis/`
- Check Bahmni logs: `/var/log/bahmni/`
- Contact ERP tech team for Odoo integration issues
