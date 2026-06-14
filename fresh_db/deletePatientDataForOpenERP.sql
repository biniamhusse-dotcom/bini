DO $$
DECLARE
    t_name TEXT;
    -- List of OpenERP/Odoo tables to DELETE from safely if they exist
    -- DELETE instead of TRUNCATE CASCADE to avoid cascading into res_users/res_company
    tables_to_delete TEXT[] := ARRAY[
        -- Sales & Invoices
        'sale_order_line_invoice_rel', 'sale_order_line_property_rel',
        'sale_order_tax', 'sale_order_group', 'sale_make_invoice',
        'sale_order_line', 'sale_order',

        -- Purchases
        'purchase_order_line_invoice_rel', 'purchase_order_taxe',
        'purchase_order_line', 'purchase_order',

        -- Stock & Inventory
        'stock_warehouse_orderpoint', 'stock_move_history_ids',
        'stock_inventory_move_rel', 'stock_move_split_lines', 'stock_move_split',
        'stock_return_picking_memory', 'stock_partial_move_line', 'stock_partial_move',
        'stock_partial_picking_line', 'stock_partial_picking',
        'stock_move', 'stock_picking',

        -- Accounting Invoices
        'account_invoice_line_tax', 'account_invoice_refund', 'account_invoice_tax',
        'account_invoice_cancel', 'account_invoice_confirm',
        'account_invoice_line', 'account_invoice',

        -- Payments
        'account_payment_register_move_line_rel',
        'account_payment_outstanding_invoice_line', 'account_payment_credit_invoice_line',
        'account_payment_account_bank_statement_line_rel',
        'account_payment_register', 'account_payment',

        -- Vouchers & Bank Statements
        'account_voucher_line', 'account_bank_statement_line_move_rel',
        'account_voucher', 'account_bank_statement_line',

        -- Journal Entries & Analytics
        'account_move_line_relation', 'hr_analytic_timesheet',
        'account_analytic_line', 'account_move_line', 'account_move',

        -- Partner Attributes
        'res_partner_attributes', 'res_partner_address',
        'res_partner_bank_type_field', 'res_partner_res_partner_category_rel',
        'res_partner_category',

        -- Event Offset Marker
        'event_records_offset_marker'
    ];
BEGIN
    -- 1. Delete from tables (child tables FIRST to avoid FK constraint failures)
    FOREACH t_name IN ARRAY tables_to_delete LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = t_name
              AND table_schema = ANY(current_schemas(false))
        ) THEN
            EXECUTE format('DELETE FROM %I', t_name);
        END IF;
    END LOOP;

    -- 2. Clean up res_partner records safely without breaking system users or companies
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'res_partner' AND table_schema = ANY(current_schemas(false))
    ) THEN
        -- Nullify parent_id to prevent self-referential key violations
        UPDATE res_partner
        SET parent_id = NULL
        WHERE id != 1
          AND NOT EXISTS (SELECT 1 FROM res_users WHERE res_users.partner_id = res_partner.id)
          AND NOT EXISTS (SELECT 1 FROM res_company WHERE res_company.partner_id = res_partner.id);

        -- Delete partners that aren't tied to active users or companies
        DELETE FROM res_partner
        WHERE id != 1
          AND NOT EXISTS (SELECT 1 FROM res_users WHERE res_users.partner_id = res_partner.id)
          AND NOT EXISTS (SELECT 1 FROM res_company WHERE res_company.partner_id = res_partner.id);
    END IF;

    -- 3. Safely delete from markers table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'markers' AND table_schema = ANY(current_schemas(false))
    ) THEN
        DELETE FROM markers
        WHERE feed_uri LIKE '%atomfeed/encounter/recent%'
           OR feed_uri LIKE '%atomfeed/patient/recent%';
    END IF;

    -- 4. Safely delete from event_records table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'event_records' AND table_schema = ANY(current_schemas(false))
    ) THEN
        DELETE FROM event_records
        WHERE category::text = 'product';
    END IF;

END $$;
