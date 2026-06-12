DO $$
DECLARE
    t_name TEXT;
    -- List of OpenERP/Odoo tables to truncate safely if they exist
    tables_to_truncate TEXT[] := ARRAY[
        -- Sales & Invoices
        'sale_order', 'sale_order_line', 'sale_make_invoice', 'sale_order_invoice_rel', 
        'sale_order_line_invoice_rel', 'sale_order_line_make_invoice', 'sale_order_line_property_rel', 
        'sale_order_tax', 'sale_order_group', 'account_invoice_line', 'ledger_journal_rel', 
        'reconcile_account_rel', 'validate_account_move', 'procurement_order', 

        -- Purchases
        'purchase_order', 'purchase_order_line', 'purchase_invoice_rel', 'purchase_order_line_invoice_rel', 
        'purchase_order_taxe',

        -- Stock & Inventory
        'stock_picking', 'stock_partial_picking', 'stock_partial_picking_line', 'stock_partial_move', 
        'stock_partial_move_line', 'stock_move', 'stock_move_split', 'stock_move_split_lines', 
        'stock_return_picking_memory', 'stock_inventory_move_rel', 'stock_move_history_ids', 'stock_warehouse_orderpoint',

        -- Accounting Invoices
        'account_invoice_line_tax', 'account_invoice', 'account_invoice_refund', 'account_invoice_tax', 
        'account_invoice_cancel', 'account_invoice_confirm', 

        -- Vouchers & Bank Statements
        'account_voucher', 'account_bank_statement_line', 'account_voucher_line', 'account_bank_statement_line_move_rel',

        -- Journal Entries & Analytics
        'account_move', 'account_move_line', 'account_move_line_relation', 'account_analytic_line', 'hr_analytic_timesheet',

        -- Partner Attributes
        'res_partner_attributes', 'res_partner_address', 'res_partner_bank_type_field', 
        'res_partner_res_partner_category_rel', 'res_partner_category',

        -- Event Offset Marker
        'event_records_offset_marker'
    ];
BEGIN
    -- 1. Safely truncate tables if they exist, cascading to prevent FK constraint failures
    FOREACH t_name IN ARRAY tables_to_truncate LOOP
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = t_name 
              AND table_schema = ANY(current_schemas(false))
        ) THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', t_name);
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
        WHERE category = 'product';
    END IF;

END $$;