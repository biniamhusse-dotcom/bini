# -*- coding: utf-8 -*-

from odoo import models, fields, api

class uog_care(models.Model):
    _inherit= 'res.company'

# custom_field = fields.Many2one('res.company', string='Custom Field')
#
    # name = fields.Char()
    # value = fields.Integer()
    # value2 = fields.Float(compute="_value_pc", store=True)
    # description = fields.Text()

    @api.depends('value')
    def _value_pc(self):
        self.value2 = float(self.value) / 100

    @api.model
    def create(self,vals):
        inherit_id = vals.get('inherit_id',False);
        if inherit_id:
            del vals['inherit_id']
            super(uog_care,self.browse(inherit_id)).write(vals);
            return  self
        return super(uog_care).create(vals)

