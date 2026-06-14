import functools
import logging
import werkzeug.wrappers
import json
import base64
import datetime
import functools
from odoo import http
from odoo.addons.restful_api.common import (
    extract_arguments,
    invalid_response,
    valid_response,
)
from odoo.http import request

_logger = logging.getLogger(__name__)

def default(o):
    if isinstance(o, (datetime.date, datetime.datetime)):
        return o.isoformat()

def _parse_json_request(data):
    try:
        return json.loads(data)
    except (UnicodeDecodeError, TypeError):
        return json.loads(data.decode('latin-1'))

class RestFullService(http.Controller):
    @http.route('/api/bahmni-saleorder', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_saleorder_creation(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-customer', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_customer_feed(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-drug', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_drug_feed(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-radiology-test', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_rediology_test(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-lab-test', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_lab_test(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-ophtha-test', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_ophtha_test(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-lab-panel', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_lab_panel(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}

    @http.route('/api/bahmni-service-sale', type="json", auth="user", methods=["POST","OPTIONS"], csrf=False, cors='*')
    def bahmni_service_sale(self, **kw):
        json_data = _parse_json_request(request.httprequest.data)
        try:
            if json_data:
               return {'status':200,'message': request.env['api.event.worker'].process_event(json_data)}
        except Exception as e:
            return {"status":417,'error': 'Expectation Failed: ' + str(e)}
