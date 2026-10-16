from odoo import models, fields, api
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)


class ApiEventWorker(models.Model):
    _name = 'api.event.worker'
    _auto = False

    @api.model
    def process_event(self, vals):
        '''Method getting triggered from Bahmni side'''
        _logger.debug("API Payload:" + str(vals))
        category = vals.get("category")
        try:
            if category == "create.customer":
                self._create_or_update_customer(vals)
                return "The customer have been successfully created / updated."
            elif category == "create.sale.order":
                self.env['order.save.service'].create_orders(vals)
                return "Sale order has been created successfully."
            elif category == "create.drug":
                self.env['drug.data.service'].create_or_update_drug(vals)
                return "The drug have been successfully created / updated."
            elif category == "create.radiology.test":
                self.env['reference.data.service'].create_or_update_ref_data(vals, 'Radiology')
                return "The rediology test have been successfully created / updated."
            elif category == "create.lab.test":
                self.env['reference.data.service'].create_or_update_ref_data(vals, 'Test')
                return "The lab test have been successfully created / updated."
            elif category == "create.lab.panel":
                self.env['reference.data.service'].create_or_update_ref_data(vals, 'Panel')
                return "The lab panel have been successfully created / updated."
            elif category == "create.service.saleable":
                self.env['reference.data.service'].create_or_update_ref_data(vals, 'Others')
                return "The service saleable have been successfully created / updated."
            elif category == "cancel.order":
                self._cancel_order(vals)
                return "Order has been cancelled successfully."
            elif category == "void.order":
                self._void_order(vals)
                return "Order has been voided successfully."
            else:
                raise UserError("Integration process is not defined. Kindly contact ERP tech team for support.")
        except Exception as err:
            _logger.info("\n Processing event threw error: %s", err)
            raise

    @api.model
    def _cancel_order(self, vals):
        """Handle order cancellation from OpenELIS/OpenMRS
        Supports per-test cancellation via stockOutTestNames parameter.
        If stockOutTestNames is provided, only those specific order lines are cancelled.
        Otherwise, all lines in the order are cancelled.
        """
        order_uuid = vals.get("orderUuid")
        accession_number = vals.get("accessionNumber")
        cancel_reason = vals.get("cancelReason", "Reagent Stock Out")
        stock_out_test_names = vals.get("stockOutTestNames", [])
        
        _logger.info("Processing order cancellation for order: %s, accession: %s, tests: %s", order_uuid, accession_number, stock_out_test_names)
        
        sale_order = None
        if order_uuid:
            sale_order = self.env['sale.order'].search([
                ('origin', 'ilike', order_uuid),
                ('state', '=', 'draft')
            ], limit=1)
        
        if not sale_order and accession_number:
            sale_order = self.env['sale.order'].search([
                ('origin', 'ilike', accession_number),
                ('state', '=', 'draft')
            ], limit=1)
        
        if not sale_order:
            _logger.warning("No draft sale order found for order: %s, accession: %s", order_uuid, accession_number)
            return
        
        if stock_out_test_names:
            for line in sale_order.order_line:
                product_name = (line.product_id.name or '').lower()
                for test_name in stock_out_test_names:
                    if test_name.lower() in product_name or product_name.startswith(test_name.lower()):
                        line.sudo().write({'price_subtotal': 0, 'price_unit': 0})
                        line.sudo().unlink()
                        _logger.info("Cancelled order line: %s for test: %s", line.id, test_name)
                        break
        else:
            for line in sale_order.order_line:
                line.sudo().unlink()
            _logger.info("Cancelled all lines in sale order: %s (no specific tests)", sale_order.name)
        
        if not sale_order.order_line:
            sale_order.action_cancel()
            _logger.info("Cancelled entire sale order %s - all lines removed", sale_order.name)

    @api.model
    def _void_order(self, vals):
        """Handle order void from OpenELIS
        Similar to cancel but may have different business logic
        """
        order_uuid = vals.get("orderUuid")
        accession_number = vals.get("accessionNumber")
        void_reason = vals.get("voidReason", "Reagent Stock Out")
        
        _logger.info("Processing order void for order: %s, accession: %s", order_uuid, accession_number)
        
        # Reuse cancel logic with void reason
        self._cancel_order({
            'orderUuid': order_uuid,
            'accessionNumber': accession_number,
            'cancelReason': void_reason
        })

    @api.model
    def _create_or_update_customer(self, vals):
        patient_ref = vals.get("ref")
        customer_vals = self._get_customer_vals(vals)
        # removing null values, as while updating null values in write method will remove old values

        for rec in list(customer_vals.keys()):
            if not customer_vals[rec]:
                del customer_vals[rec]
        address_data = vals.get('preferredAddress')
        # get validated address details
        address_details = self.env['address.mapping.service']._map_address_fields(address_data)
        # update address details
        customer_vals.update(address_details)
        _logger.info("Customer vals: %s", customer_vals)
        existing_customer = self.env['res.partner'].search([('ref', '=', patient_ref)])
        if existing_customer:
            existing_customer.write(customer_vals)
            self._create_or_update_person_attributes(existing_customer.id,vals)
        else:
            customer = self.env['res.partner'].create(customer_vals)
            self._create_or_update_person_attributes(customer.id,vals)

    def _get_customer_vals(self, vals):
        res = {}
        res.update({'ref': vals.get('ref'),
                    'name': vals.get('name'),
                    'local_name': vals.get('local_name') if vals.get('local_name') else False,
                    'uuid': vals.get('uuid'),
                    'customer_rank':  1})
        # update other details : for now there is only scope of updating contact.
        if vals.get('primaryContact'):
            res.update({'phone': vals['primaryContact']})
        return res

    def _create_or_update_person_attributes(self, cust_id, vals):
        attributes = vals.get("attributes", {})
        if isinstance(attributes, str):
            import json
            try:
                attributes = json.loads(attributes)
            except Exception:
                attributes = {}
        address_data = vals.get('preferredAddress')

        if attributes.get('email') and cust_id:
            customer_master = self.env['res.partner'].search([('id', '=', cust_id)])
            if customer_master:
                customer_master.email = attributes['email']



        for key in attributes:
            if key in [key for key in attributes]:
                column_dict = {'partner_id': cust_id}
                existing_attribute = self.env['res.partner.attributes'].search([('partner_id', '=', cust_id),('name', '=', key)])
                if any(existing_attribute):
                    existing_attribute.unlink()
                column_dict.update({"name": key, "value" : attributes[key]})
                self.env['res.partner.attributes'].create(column_dict)
