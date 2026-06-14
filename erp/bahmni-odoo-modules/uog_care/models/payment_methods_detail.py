# -*- coding: utf-8 -*-

import json
import logging
import urllib.request
import urllib.error
import base64

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

OPENMRS_URL = 'http://openmrs:8080/openmrs'
OPENMRS_USER = 'admin'
OPENMRS_PASS = 'Admin123'


class SaleOrderInherited(models.Model):
    _inherit = _inherit = 'sale.order'

    partner_id = fields.Many2one('res.partner', string='Patient Name', readonly=True, states={'draft': [('readonly', False)], 'sent': [('readonly', False)]}, required=True, change_default=True, index=True, track_visibility='always')
    partner_village = fields.Many2one("village.village", string="Patient Kebele")
    shop_id = fields.Many2one('sale.shop', string='Service Unit', required=True)
    date_order = fields.Datetime(string='Charge Date', required=True, readonly=True, index=True, states={'draft': [('readonly', False)], 'sent': [('readonly', False)]}, copy=False, default=fields.Datetime.now)
    credit_type = fields.Many2one('credit.type', string='Credit Type')
    free_service = fields.Many2one('free.service', string='Free Service')
    credit_company_name = fields.Many2one('credit.company', string='Credit Company')
    cbhi_woreda_name = fields.Many2one('cbhi.woreda', string='CBHI Woreda')
    brigade_name = fields.Many2one('ethiopia.brigade', string='Brigade Name')
    campus_name = fields.Many2one('uog.campus', string='Campus Name')
    working_place = fields.Many2one('working.place', string='Workplace')
    battalion = fields.Char(string='Battalion')
    id_number = fields.Char(string='ID Number')
    payment_method = fields.Many2one('payment.method', string='Payment Method')
    patient_detail = fields.Char(compute="_compute_fieldvalue", string="Patient Detail", store=True)
    patient_detail_without_date = fields.Char(compute="_compute_fieldvalue", string="Patient Detail Without Date", store=True)
    patient_kebele = fields.Char(compute="_compute_fieldvalue", string="Patient Kebele", store=True)
    attribute_ids = fields.One2many('res.partner.attributes', 'partner_id', string='Attributes')

    @api.depends('partner_id.display_name', 'id_number', 'date_order', 'partner_id.street2', 'payment_term_id', 'working_place', 'campus_name')
    def _compute_fieldvalue(self):
        for each in self:

         if each.partner_id.street2 == '':
            each.patient_kebele  = 'N/A'
            each.patient_detail  = each.partner_id.display_name
            each.patient_detail_without_date  = each.partner_id.display_name
         elif each.credit_company_name.id == 3:
            each.patient_kebele  = each.campus_name.name
            each.patient_detail  = each.partner_id.display_name
            each.patient_detail_without_date  = each.partner_id.display_name
         elif each.payment_term_id.id == 5:
            each.patient_kebele  = each.working_place.name
            each.patient_detail  = each.partner_id.display_name
            each.patient_detail_without_date  = each.partner_id.display_name   
         else:   
            each.patient_kebele  = each.partner_id.street2
            each.patient_detail  = each.partner_id.display_name
            each.patient_detail_without_date  = each.partner_id.display_name

    def action_fetch_payment_info(self):
        for order in self:
            if not order.partner_id:
                raise UserError("Please select a patient first.")

            patient_uuid = order.partner_id.uuid
            if not patient_uuid:
                raise UserError("Patient UUID not found. Please ensure the patient is synced from OpenMRS.")

            attrs = self._fetch_openmrs_person_attributes(patient_uuid)
            if not attrs:
                raise UserError("No payment attributes found for this patient in OpenMRS.")

            vals = {}

            if 'PaymentMethod' in attrs:
                pm_name = attrs['PaymentMethod']
                pm = self.env['payment.method'].search([('ilike', pm_name)], limit=1)
                if pm:
                    vals['payment_method'] = pm.id

            if 'CreditType' in attrs:
                ct_name = attrs['CreditType']
                ct = self.env['credit.type'].search([('ilike', ct_name)], limit=1)
                if ct:
                    vals['credit_type'] = ct.id

            if 'CBHIAgreedWoreda' in attrs:
                cw_name = attrs['CBHIAgreedWoreda']
                cw = self.env['cbhi.woreda'].search([('ilike', cw_name)], limit=1)
                if cw:
                    vals['cbhi_woreda_name'] = cw.id

            if 'CreditCompany' in attrs:
                cc_name = attrs['CreditCompany']
                cc = self.env['credit.company'].search([('ilike', cc_name)], limit=1)
                if cc:
                    vals['credit_company_name'] = cc.id

            if 'Reference Number' in attrs:
                vals['id_number'] = attrs['Reference Number']

            if vals:
                order.write(vals)

    def _fetch_openmrs_person_attributes(self, patient_uuid):
        url = f"{OPENMRS_URL}/ws/rest/v1/person/{patient_uuid}?v=full"
        try:
            auth_string = base64.b64encode(f"{OPENMRS_USER}:{OPENMRS_PASS}".encode()).decode()
            req = urllib.request.Request(url)
            req.add_header('Authorization', f'Basic {auth_string}')
            req.add_header('Accept', 'application/json')

            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))

            attrs = {}
            for attr in data.get('attributes', []):
                attr_type = attr.get('attributeType', {})
                type_name = attr_type.get('display', '')
                value = attr.get('value', '')

                if hasattr(value, 'get'):
                    display = value.get('display', '')
                elif isinstance(value, str):
                    display = value
                else:
                    display = str(value) if value else ''

                if display and type_name:
                    attrs[type_name] = display

            return attrs
        except Exception as e:
            _logger.error("Failed to fetch OpenMRS person attributes: %s", str(e))
            raise UserError(f"Could not fetch data from OpenMRS: {str(e)}")
