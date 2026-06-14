from odoo import fields, models


class AddressMappingTable(models.Model):
    _name = 'address.mapping.table'
    _description = 'Address Mapping Table'

    openmrs_address_field = fields.Char(string="OpenMRS Address Field")
    odoo_address_field = fields.Selection([('country', 'Country'),
                                           ('state', 'State'),
                                           ('district', 'District'),
                                           ('subdistrict', 'Sub-District'),
                                           ('village', 'Village'),
                                           ('street', 'Street'),
                                           ('street2', 'Street 2'),
                                           ('zip', 'Zip')
                                           ], string="Odoo Address Field")
