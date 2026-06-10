# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class SaleReport(models.Model):
    _inherit = 'sale.report'

    credit_company_name = fields.Many2one('credit.companys', string='Credit Company', readonly=True)
    cbhi_woreda_name = fields.Many2one('cbhi.woreda', string='CBHI Woreda', readonly=True)
    brigade_name = fields.Many2one('ethiopia.brigade', string='Brigade Name', readonly=True)
    campus_name = fields.Many2one('uog.campus', string='Campus Name', readonly=True)
    working_place = fields.Many2one('working.places', string='Workplace', readonly=True)
    battalion = fields.Char(string='Battalion', readonly=True)
    id_number = fields.Char(string='ID Number', readonly=True)
    payment_term_id = fields.Many2one('account.payment.term', string='Payment Terms', readonly=True)    
    partner_id = fields.Many2one('res.partner', string='Patient', readonly=True)
    categ_id = fields.Many2one('product.category', string='Service Type', readonly=True)
    product_id = fields.Many2one('product.product', string='Service', readonly=True)
    patient_detail = fields.Char(compute="_compute_fieldvalue", string="Patient Detail", store=True)
    patient_detail_without_date = fields.Char(compute="_compute_fieldvalue", string="Patient Detail Without Date", store=True)
    patient_kebele = fields.Char(compute="_compute_fieldvalue", string="Patient Kebele", store=True)

    def _select(self):
        return super(SaleReport, self)._select() + ", s.credit_company_name as credit_company_name, s.cbhi_woreda_name as cbhi_woreda_name, s.brigade_name as brigade_name, s.campus_name as campus_name, s.working_place as working_place, s.payment_term_id as payment_term_id, s.id_number as id_number, s.battalion as battalion, s.patient_kebele as patient_kebele, cast(s.patient_detail || ' ⟺ ' || ' [' || s.id_number || ']' || ' ⟺ ' || ' [' || s.date_order || ']' || ' ⟺ ' || ' [' || s.patient_kebele || ']'  as text) as patient_detail, cast(s.patient_detail_without_date || ' ⟺ ' || ' [' || s.id_number || ']' || ' ⟺ ' || ' [' || s.patient_kebele || ']' as text) as patient_detail_without_date"
    
    def _group_by(self):
        return super(SaleReport, self)._group_by() + ", s.credit_company_name, s.cbhi_woreda_name, s.brigade_name, s.campus_name, s.working_place, s.payment_term_id, s.id_number, s.battalion, s.patient_detail, s.patient_detail_without_date, s.patient_kebele"
