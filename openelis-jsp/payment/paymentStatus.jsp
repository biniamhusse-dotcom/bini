<%@ page language="java" contentType="application/json; charset=UTF-8" %>
<%@ page import="java.sql.*" %>
<%@ page import="java.io.*" %>
<%@ page import="java.util.Properties" %>
<%@ page import="org.json.simple.*" %>
<%
    response.setContentType("application/json");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) { return; }

    String method = request.getMethod();
    String patientId = request.getParameter("patientId");

    if (patientId == null || patientId.trim().isEmpty()) {
        response.setStatus(400);
        out.print("{\"error\":\"patientId is required\"}");
        return;
    }
    patientId = patientId.trim();

    String pgUrl = "jdbc:postgresql://bahmni-standard-openelisdb-1:5432/clinlims";
    String pgUser = "clinlims";
    String pgPass = "clinlims";

    // Read Odoo credentials from SystemConfiguration.properties or use verified defaults
    String odooUser = "emrsync";
    String odooPass = "Admin123";
    String odooDb = "odoo";
    String odooUrl = "http://odoo:8069";
    try {
        File cfg = new File("/run/bahmni-lab/bahmni-lab/WEB-INF/classes/SystemConfiguration.properties");
        if (cfg.exists()) {
            Properties p = new Properties();
            FileInputStream fis = new FileInputStream(cfg);
            p.load(fis);
            fis.close();
            if (p.getProperty("payment.odoo.username") != null && !p.getProperty("payment.odoo.username").trim().isEmpty()) {
                odooUser = p.getProperty("payment.odoo.username").trim();
            }
            if (p.getProperty("payment.odoo.password") != null && !p.getProperty("payment.odoo.password").trim().isEmpty()) {
                odooPass = p.getProperty("payment.odoo.password").trim();
            }
            if (p.getProperty("payment.odoo.db") != null && !p.getProperty("payment.odoo.db").trim().isEmpty()) {
                odooDb = p.getProperty("payment.odoo.db").trim();
            }
            if (p.getProperty("payment.odoo.url") != null && !p.getProperty("payment.odoo.url").trim().isEmpty()) {
                odooUrl = p.getProperty("payment.odoo.url").trim();
            }
        }
    } catch (Exception ignore) {}

    Connection pgConn = null;
    try {
        Class.forName("org.postgresql.Driver");
        pgConn = DriverManager.getConnection(pgUrl, pgUser, pgPass);

        if ("POST".equalsIgnoreCase(method)) {
            String action = request.getParameter("action");
            if ("pay".equalsIgnoreCase(action)) {
                PreparedStatement checkStmt = pgConn.prepareStatement(
                    "SELECT id FROM patient_payment WHERE patient_identifier = ? AND voided = false");
                checkStmt.setString(1, patientId);
                ResultSet rs = checkStmt.executeQuery();
                if (rs.next()) {
                    PreparedStatement updateStmt = pgConn.prepareStatement(
                        "UPDATE patient_payment SET payment_status = 'PAID', payment_date = NOW() WHERE patient_identifier = ? AND voided = false");
                    updateStmt.setString(1, patientId);
                    updateStmt.executeUpdate();
                    updateStmt.close();
                } else {
                    PreparedStatement insertStmt = pgConn.prepareStatement(
                        "INSERT INTO patient_payment (patient_identifier, payment_status, payment_date) VALUES (?, 'PAID', NOW())");
                    insertStmt.setString(1, patientId);
                    insertStmt.executeUpdate();
                    insertStmt.close();
                }
                rs.close();
                checkStmt.close();

                // Pay outstanding in Odoo
                String odooError = null;
                boolean odooPaid = false;
                try {
                    String pyScript =
                        "import xmlrpclib, sys\n" +
                        "common = xmlrpclib.ServerProxy('" + odooUrl + "/xmlrpc/2/common', allow_none=True)\n" +
                        "uid = common.authenticate('" + odooDb + "', '" + odooUser + "', '" + odooPass + "', {})\n" +
                        "if not uid:\n" +
                        "    print 'AUTH_FAIL'\n" +
                        "    sys.exit(0)\n" +
                        "models = xmlrpclib.ServerProxy('" + odooUrl + "/xmlrpc/2/object', allow_none=True)\n" +
                        "ctx = {'default_partner_type': 'customer'}\n" +
                        "partners = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'res.partner', 'search_read', [[['ref', '=', '" + patientId + "']]], {'fields': ['id', 'name'], 'limit': 1})\n" +
                        "if not partners:\n" +
                        "    print 'NO_PARTNER'\n" +
                        "    sys.exit(0)\n" +
                        "pid = partners[0]['id']\n" +
                        "invoices = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move', 'search_read', [[['partner_id', '=', pid], ['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']]], {'fields': ['id', 'name', 'amount_residual'], 'order': 'invoice_date_due ASC'})\n" +
                        "if not invoices:\n" +
                        "    print 'NO_OUTSTANDING'\n" +
                        "    sys.exit(0)\n" +
                        "total_residual = sum(inv['amount_residual'] for inv in invoices)\n" +
                        "journal_ids = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.journal', 'search', [[['type', '=', 'cash']]])\n" +
                        "if not journal_ids:\n" +
                        "    journal_ids = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.journal', 'search', [[['type', '=', 'bank']]])\n" +
                        "journal_id = journal_ids[0] if journal_ids else 6\n" +
                        "pm_ids = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.payment.method', 'search', [[['code', '=', 'manual']]])\n" +
                        "pm_id = pm_ids[0] if pm_ids else 1\n" +
                        "payment_vals = {\n" +
                        "    'payment_type': 'inbound',\n" +
                        "    'partner_type': 'customer',\n" +
                        "    'partner_id': pid,\n" +
                        "    'amount': total_residual,\n" +
                        "    'journal_id': journal_id,\n" +
                        "    'payment_method_id': pm_id,\n" +
                        "}\n" +
                        "payment_id = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.payment', 'create', [payment_vals], {'context': ctx})\n" +
                        "try:\n" +
                        "    models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.payment', 'action_post', [payment_id], {'context': ctx})\n" +
                        "except:\n" +
                        "    pass\n" +
                        "pay_rec = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.payment', 'read', [payment_id], {'fields': ['state']})\n" +
                        "if not pay_rec or pay_rec[0]['state'] != 'posted':\n" +
                        "    print 'POST_FAIL'\n" +
                        "    sys.exit(0)\n" +
                        "pay_lines = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move.line', 'search_read', [[['payment_id', '=', payment_id], ['partner_id', '=', pid], ['account_id.code', 'like', '121000']]], {'fields': ['id', 'credit', 'amount_residual']})\n" +
                        "if not pay_lines:\n" +
                        "    print 'NO_PAY_LINE'\n" +
                        "    sys.exit(0)\n" +
                        "pay_line_id = pay_lines[0]['id']\n" +
                        "for inv in invoices:\n" +
                        "    try:\n" +
                        "        models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move', 'js_assign_outstanding_line', [inv['id'], pay_line_id])\n" +
                        "    except:\n" +
                        "        pass\n" +
                        "print 'ODOO_OK'\n";

                    ProcessBuilder pb = new ProcessBuilder("python", "-c", pyScript);
                    pb.redirectErrorStream(true);
                    Process proc = pb.start();
                    BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()));
                    StringBuilder output = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) { output.append(line.trim()); }
                    proc.waitFor();
                    String result = output.toString();
                    if ("ODOO_OK".equals(result)) {
                        odooPaid = true;
                    } else if (!"NO_OUTSTANDING".equals(result) && !"NO_PARTNER".equals(result)) {
                        odooError = result;
                    }
                } catch (Exception e) {
                    odooError = e.getMessage();
                }

                JSONObject json = new JSONObject();
                json.put("status", "PAID");
                json.put("source", odooPaid ? "odoo" : "manual");
                if (odooError != null) json.put("odoo_error", odooError);
                out.print(json.toJSONString());
            } else if ("unpay".equalsIgnoreCase(action)) {
                PreparedStatement updateStmt = pgConn.prepareStatement(
                    "UPDATE patient_payment SET payment_status = 'UNPAID', payment_date = NULL WHERE patient_identifier = ? AND voided = false");
                updateStmt.setString(1, patientId);
                updateStmt.executeUpdate();
                updateStmt.close();
                out.print("{\"status\":\"UNPAID\"}");
            } else {
                response.setStatus(400);
                out.print("{\"error\":\"action must be 'pay' or 'unpay'\"}");
            }
        } else {
            // GET: Live Odoo Verification
            boolean odooPaid = false;
            String odooError = null;
            try {
                String pyScript =
                    "import xmlrpclib, sys\n" +
                    "proxy = xmlrpclib.ServerProxy('" + odooUrl + "/xmlrpc/2/common')\n" +
                    "uid = proxy.authenticate('" + odooDb + "', '" + odooUser + "', '" + odooPass + "', {})\n" +
                    "if not uid:\n" +
                    "    print 'AUTH_FAIL'\n" +
                    "    sys.exit(0)\n" +
                    "models = xmlrpclib.ServerProxy('" + odooUrl + "/xmlrpc/2/object')\n" +
                    "q = '" + patientId + "'\n" +
                    "is_uuid = ('-' in q and len(q) > 20)\n" +
                    "if is_uuid:\n" +
                    "    lines = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'sale.order.line', 'search_read', " +
                    "        [['|', ('external_id', '=', q), ('external_order_id', '=', q)]], " +
                    "        {'fields': ['id', 'order_id', 'state', 'invoice_status'], 'limit': 1})\n" +
                    "    if not lines:\n" +
                    "        print 'UNPAID'\n" +
                    "        sys.exit(0)\n" +
                    "    line = lines[0]\n" +
                    "    if line['state'] == 'draft' or line['invoice_status'] in ('no', 'to invoice'):\n" +
                    "        print 'UNPAID'\n" +
                    "        sys.exit(0)\n" +
                    "    so_id = line['order_id'][0]\n" +
                    "    so_rec = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'sale.order', 'search_read', " +
                    "        [[['id', '=', so_id]]], {'fields': ['invoice_ids'], 'limit': 1})\n" +
                    "    if not so_rec or not so_rec[0]['invoice_ids']:\n" +
                    "        print 'UNPAID'\n" +
                    "        sys.exit(0)\n" +
                    "    inv_ids = so_rec[0]['invoice_ids']\n" +
                    "    invs = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move', 'search_read', " +
                    "        [[['id', 'in', inv_ids]]], {'fields': ['state', 'payment_state', 'amount_residual']})\n" +
                    "    all_paid = True\n" +
                    "    for inv in invs:\n" +
                    "        if inv.get('state') != 'posted' or inv.get('payment_state') not in ('paid', 'in_payment') or inv.get('amount_residual', 0) > 0.01:\n" +
                    "            all_paid = False\n" +
                    "            break\n" +
                    "    if all_paid and invs:\n" +
                    "        print 'PAID'\n" +
                    "    else:\n" +
                    "        print 'UNPAID'\n" +
                    "    sys.exit(0)\n" +
                    "else:\n" +
                    "    partners = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'res.partner', 'search_read', " +
                    "        [[['ref', '=', q]]], {'fields': ['id', 'name'], 'limit': 1})\n" +
                    "    if not partners:\n" +
                    "        print 'NO_PARTNER'\n" +
                    "        sys.exit(0)\n" +
                    "    pid = partners[0]['id']\n" +
                    "    draft_orders = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'sale.order', 'search_read', " +
                    "        [[['partner_id', '=', pid], ['state', 'in', ['draft', 'sent']]]], {'fields': ['id'], 'limit': 5})\n" +
                    "    if draft_orders:\n" +
                    "        print 'UNPAID'\n" +
                    "        sys.exit(0)\n" +
                    "    unpaid_invs = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move', 'search_read', " +
                    "        [[['partner_id', '=', pid], ['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', '!=', 'paid']]], " +
                    "        {'fields': ['id', 'payment_state', 'amount_residual'], 'limit': 5})\n" +
                    "    for inv in unpaid_invs:\n" +
                    "        if inv.get('payment_state') != 'in_payment' and inv.get('amount_residual', 0) > 0.01:\n" +
                    "            print 'UNPAID'\n" +
                    "            sys.exit(0)\n" +
                    "    paid_invs = models.execute_kw('" + odooDb + "', uid, '" + odooPass + "', 'account.move', 'search_read', " +
                    "        [[['partner_id', '=', pid], ['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', 'in', ['paid', 'in_payment']]]], " +
                    "        {'fields': ['id'], 'limit': 1})\n" +
                    "    if paid_invs:\n" +
                    "        print 'PAID'\n" +
                    "    else:\n" +
                    "        print 'UNPAID'\n" +
                    "    sys.exit(0)\n";

                ProcessBuilder pb = new ProcessBuilder("python", "-c", pyScript);
                pb.redirectErrorStream(true);
                Process proc = pb.start();
                BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) { output.append(line.trim()); }
                proc.waitFor();
                String result = output.toString();
                if ("PAID".equals(result)) {
                    odooPaid = true;
                } else if (!"UNPAID".equals(result) && !"NO_PARTNER".equals(result)) {
                    odooError = result;
                }
            } catch (Exception e) {
                odooError = e.getMessage();
            }

            JSONObject json = new JSONObject();
            json.put("status", odooPaid ? "PAID" : "UNPAID");
            json.put("paymentDate", null);
            if (odooError != null) json.put("odoo_error", odooError);
            json.put("source", "odoo");
            out.print(json.toJSONString());
        }
    } catch (Exception e) {
        response.setStatus(500);
        out.print("{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}");
    } finally {
        if (pgConn != null) { try { pgConn.close(); } catch (SQLException e) {} }
    }
%>
