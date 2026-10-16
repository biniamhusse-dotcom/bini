#!/usr/bin/env python3
"""
Test script for Stock-Out to Odoo integration
Tests:
1. Available tests -> sent to Odoo as normal orders
2. Stock-Out tests -> marked as cancelled/non-billable in Odoo
"""

import json
import sys
from datetime import datetime

# Sample test data (simulating what OpenELIS would send)
test_data = {
    "orderId": "TEST-001",
    "patientId": "124258",
    "patientName": "Test Patient",
    "tests": [
        {"testId": "T001", "testName": "Complete Blood Count", "sampleType": "Blood", "status": "available"},
        {"testId": "T002", "testName": "Blood Glucose", "sampleType": "Blood", "status": "stockout"},
        {"testId": "T003", "testName": "Lipid Panel", "sampleType": "Blood", "status": "available"},
        {"testId": "T004", "testName": "Thyroid Function", "sampleType": "Blood", "status": "stockout"},
    ]
}

def test_odoo_integration():
    print("=" * 60)
    print("STOCK-OUT TO ODOO INTEGRATION TEST")
    print("=" * 60)
    
    available_tests = [t for t in test_data["tests"] if t["status"] == "available"]
    stockout_tests = [t for t in test_data["tests"] if t["status"] == "stockout"]
    
    print(f"\nOrder ID: {test_data['orderId']}")
    print(f"Patient: {test_data['patientName']} ({test_data['patientId']})")
    print(f"Total Tests: {len(test_data['tests'])}")
    print(f"Available: {len(available_tests)}")
    print(f"Stock-Out: {len(stockout_tests)}")
    
    print("\n--- AVAILABLE TESTS (Send to Odoo) ---")
    for t in available_tests:
        print(f"  [SEND TO ODOO] {t['testId']}: {t['testName']} ({t['sampleType']})")
    
    print("\n--- STOCK-OUT TESTS (Do NOT send to Odoo) ---")
    for t in stockout_tests:
        print(f"  [CANCEL/NOT BILLABLE] {t['testId']}: {t['testName']} ({t['sampleType']})")
    
    print("\n--- ODOO PAYLOAD (Available Tests Only) ---")
    odoo_payload = {
        "category": "create.sale.order",
        "order": {
            "origin": test_data["orderId"],
            "patient_id": test_data["patientId"],
            "patient_name": test_data["patientName"],
            "lines": [
                {
                    "product_id": t["testId"],
                    "product_name": t["testName"],
                    "quantity": 1,
                    "price_unit": 0,
                    "stock_out": False
                } for t in available_tests
            ]
        }
    }
    print(json.dumps(odoo_payload, indent=2))
    
    print("\n--- STOCK-OUT NOTICE (Print) ---")
    notice = {
        "noticeNumber": "SO-" + datetime.now().strftime("%H%M%S"),
        "date": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "orderId": test_data["orderId"],
        "patientId": test_data["patientId"],
        "patientName": test_data["patientName"],
        "voidedTests": [
            {"testName": t["testName"], "testCode": t["testId"], "voidReason": "Reagent Stock Out"}
            for t in stockout_tests
        ]
    }
    print(json.dumps(notice, indent=2))
    
    print("\n--- ODOO RECONCILIATION ---")
    print("Expected behavior:")
    for t in available_tests:
        print(f"  [CREATE] {t['testName']} -> Odoo draft quotation line")
    for t in stockout_tests:
        print(f"  [SKIP] {t['testName']} -> Marked non-billable in Odoo")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

def test_stockout_print():
    print("\n\n")
    print("=" * 60)
    print("STOCK-OUT NOTICE PRINT TEST")
    print("=" * 60)
    
    stockout_tests = [t for t in test_data["tests"] if t["status"] == "stockout"]
    
    html = """<!DOCTYPE html>
<html><head><title>Stock-Out Notice</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;font-size:12px;line-height:1.5}
h1{font-size:18px;text-align:center;border-bottom:2px solid #000;padding-bottom:10px}
h2{font-size:14px;text-align:center;color:#dc2626;margin:5px 0 15px 0}
table{width:100%;border-collapse:collapse;margin:15px 0}
td{border:1px solid #ccc;padding:8px}
td:first-child{background:#f5f5f5;font-weight:bold;width:30%}
.action-box{border:2px solid #dc2626;padding:15px;margin:15px 0;background:#fff5f5}
.sig-section{display:flex;justify-content:space-between;margin-top:40px}
.sig-box{width:45%;border-top:1px solid #000;padding-top:5px}
.footer{text-align:center;font-size:10px;color:#666;margin-top:20px}
</style></head><body>"""
    
    html += "<h1>LABORATORY STOCK-OUT NOTICE</h1>"
    html += "<h2>Non-Conformity Report for Reagent Unavailability</h2>"
    html += f"<table><tr><td>Notice Number:</td><td><strong>SO-TEST-001</strong></td><td>Date:</td><td>{datetime.now().strftime('%d/%m/%Y %H:%M')}</td></tr>"
    html += f"<tr><td>Order ID:</td><td>{test_data['orderId']}</td><td>Patient:</td><td>{test_data['patientName']}</td></tr></table>"
    
    html += "<h3>Affected Tests (Cancelled)</h3><table>"
    for t in stockout_tests:
        html += f"<tr><td>{t['testName']}</td><td>{t['testId']}</td><td>Reagent Stock Out</td><td>Cancelled</td></tr>"
    html += "</table>"
    
    html += """<div class="action-box"><strong>Required Actions:</strong><ol>
<li>Notify the ordering clinician about the reagent stock-out</li>
<li>Advise patient to return when reagents are available</li>
<li>Schedule follow-up appointment if clinically urgent</li>
</ol></div>"""
    
    html += """<div class="sig-section">
<div class="sig-box"><p>Receptionist Signature</p></div>
<div class="sig-box"><p>Patient/Guardian Signature</p></div>
</div>"""
    
    html += '<div class="footer"><p>This notice confirms that the above test(s) could not be performed due to reagent unavailability.</p></div>'
    html += "</body></html>"
    
    print("HTML NOTICE PREVIEW (first 500 chars):")
    print(html[:500] + "...")
    print("\n[Click 'Print' in browser to print the full notice]")

if __name__ == "__main__":
    test_odoo_integration()
    test_stockout_print()
