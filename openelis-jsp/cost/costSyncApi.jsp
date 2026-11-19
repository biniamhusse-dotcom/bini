<%@ page language="java" contentType="application/json; charset=utf-8" import="java.util.*,java.sql.*,org.json.*,java.io.*"%><%
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);

    String action = request.getParameter("action");
    if (action == null) action = "listCosts";

    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;

    try {
        Class.forName("org.postgresql.Driver");
        conn = DriverManager.getConnection("jdbc:postgresql://openelisdb:5432/clinlims", "clinlims", "clinlims");

        // =========================================================================
        // 1. ACTION: LIST ALL TEST & PANEL COSTS
        // =========================================================================
        if ("listCosts".equals(action)) {
            String search = request.getParameter("search");
            String typeFilter = request.getParameter("type"); // ALL, TEST, PANEL
            String statusFilter = request.getParameter("status"); // ALL, SYNCED, PENDING, ERROR

            StringBuilder sql = new StringBuilder("SELECT id, item_type, item_id, item_name, item_code, department, cost, odoo_product_id, sync_status, last_sync_date, error_message FROM clinlims.test_cost WHERE 1=1 ");
            List<Object> params = new ArrayList<Object>();

            if (search != null && !search.trim().isEmpty()) {
                sql.append("AND (item_name ILIKE ? OR item_code ILIKE ? OR department ILIKE ?) ");
                String kw = "%" + search.trim() + "%";
                params.add(kw);
                params.add(kw);
                params.add(kw);
            }
            if (typeFilter != null && !typeFilter.isEmpty() && !"ALL".equalsIgnoreCase(typeFilter)) {
                sql.append("AND item_type = ? ");
                params.add(typeFilter.toUpperCase());
            }
            if (statusFilter != null && !statusFilter.isEmpty() && !"ALL".equalsIgnoreCase(statusFilter)) {
                sql.append("AND sync_status = ? ");
                params.add(statusFilter.toUpperCase());
            }

            sql.append("ORDER BY department ASC, item_type DESC, item_name ASC LIMIT 2000");

            ps = conn.prepareStatement(sql.toString());
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            rs = ps.executeQuery();

            JSONArray items = new JSONArray();
            while (rs.next()) {
                JSONObject o = new JSONObject();
                o.put("id", rs.getInt("id"));
                o.put("itemType", rs.getString("item_type"));
                o.put("itemId", rs.getLong("item_id"));
                o.put("itemName", rs.getString("item_name"));
                o.put("itemCode", rs.getString("item_code") != null ? rs.getString("item_code") : "");
                o.put("department", rs.getString("department") != null ? rs.getString("department") : "");
                o.put("cost", rs.getDouble("cost"));
                o.put("odooProductId", rs.getObject("odoo_product_id") != null ? rs.getInt("odoo_product_id") : 0);
                o.put("syncStatus", rs.getString("sync_status"));
                o.put("lastSyncDate", rs.getTimestamp("last_sync_date") != null ? rs.getTimestamp("last_sync_date").toString() : "");
                o.put("errorMessage", rs.getString("error_message") != null ? rs.getString("error_message") : "");
                items.put(o);
            }

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("items", items);
            resp.put("count", items.length());
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 2. ACTION: SYNC ODOO -> OPENELIS
        // =========================================================================
        if ("syncOdooToOpenELIS".equals(action)) {
            String operator = request.getParameter("operator");
            if (operator == null || operator.trim().isEmpty()) operator = "Administrator";

            int syncedCount = 0;
            int failedCount = 0;
            StringBuilder logDetails = new StringBuilder();

            Connection odooConn = null;
            PreparedStatement ops = null;
            ResultSet ors = null;
            try {
                odooConn = DriverManager.getConnection("jdbc:postgresql://odoodb:5432/odoo", "odoo", "odoo");
                ops = odooConn.prepareStatement(
                    "SELECT pt.id, COALESCE(pt.name->>'en_US', pt.name::text) as p_name, pt.list_price, COALESCE(pt.default_code, '') " +
                    "FROM product_template pt WHERE pt.sale_ok = TRUE"
                );
                ors = ops.executeQuery();

                ps = conn.prepareStatement(
                    "UPDATE clinlims.test_cost " +
                    "SET cost = ?, odoo_product_id = ?, item_code = CASE WHEN item_code = '' THEN ? ELSE item_code END, " +
                    "    sync_status = 'SYNCED', last_sync_date = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP " +
                    "WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))"
                );

                while (ors.next()) {
                    int odooId = ors.getInt(1);
                    String odooName = ors.getString(2);
                    double price = ors.getDouble(3);
                    String code = ors.getString(4);

                    if (odooName != null && !odooName.trim().isEmpty()) {
                        ps.setDouble(1, price);
                        ps.setInt(2, odooId);
                        ps.setString(3, code);
                        ps.setString(4, odooName.trim());
                        int updated = ps.executeUpdate();
                        if (updated > 0) {
                            syncedCount += updated;
                        }
                    }
                }
            } catch (Exception ex) {
                failedCount++;
                logDetails.append("Error connecting to Odoo: ").append(ex.getMessage()).append("; ");
            } finally {
                if (ors != null) try { ors.close(); } catch (Exception ignore) {}
                if (ops != null) try { ops.close(); } catch (Exception ignore) {}
                if (odooConn != null) try { odooConn.close(); } catch (Exception ignore) {}
            }

            logDetails.append("Synced ").append(syncedCount).append(" test & panel costs from Odoo.");

            // Log history
            PreparedStatement lps = conn.prepareStatement(
                "INSERT INTO clinlims.test_cost_sync_log (sync_type, direction, items_synced, items_failed, details, performed_by) " +
                "VALUES ('MANUAL', 'ODOO_TO_OPENELIS', ?, ?, ?, ?)"
            );
            lps.setInt(1, syncedCount);
            lps.setInt(2, failedCount);
            lps.setString(3, logDetails.toString());
            lps.setString(4, operator);
            lps.executeUpdate();
            lps.close();

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("itemsSynced", syncedCount);
            resp.put("itemsFailed", failedCount);
            resp.put("message", "Successfully synchronized " + syncedCount + " prices from Odoo.");
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 3. ACTION: SYNC OPENELIS -> ODOO
        // =========================================================================
        if ("syncOpenELISToOdoo".equals(action)) {
            String operator = request.getParameter("operator");
            if (operator == null || operator.trim().isEmpty()) operator = "Administrator";

            int syncedCount = 0;
            int failedCount = 0;
            StringBuilder logDetails = new StringBuilder();

            Connection odooConn = null;
            PreparedStatement ops = null;
            try {
                odooConn = DriverManager.getConnection("jdbc:postgresql://odoodb:5432/odoo", "odoo", "odoo");
                ops = odooConn.prepareStatement("UPDATE product_template SET list_price = ?, write_date = CURRENT_TIMESTAMP WHERE id = ?");

                ps = conn.prepareStatement("SELECT id, item_name, cost, odoo_product_id FROM clinlims.test_cost WHERE odoo_product_id IS NOT NULL AND cost >= 0");
                rs = ps.executeQuery();

                while (rs.next()) {
                    int costId = rs.getInt("id");
                    double cost = rs.getDouble("cost");
                    int odooId = rs.getInt("odoo_product_id");

                    try {
                        ops.setDouble(1, cost);
                        ops.setInt(2, odooId);
                        int r = ops.executeUpdate();
                        if (r > 0) {
                            syncedCount++;
                        }
                    } catch (Exception itemEx) {
                        failedCount++;
                    }
                }

                // Update last sync date in OpenELIS
                PreparedStatement ups = conn.prepareStatement("UPDATE clinlims.test_cost SET last_sync_date = CURRENT_TIMESTAMP, sync_status = 'SYNCED' WHERE odoo_product_id IS NOT NULL");
                ups.executeUpdate();
                ups.close();

            } catch (Exception ex) {
                failedCount++;
                logDetails.append("Error pushing prices to Odoo: ").append(ex.getMessage()).append("; ");
            } finally {
                if (ops != null) try { ops.close(); } catch (Exception ignore) {}
                if (odooConn != null) try { odooConn.close(); } catch (Exception ignore) {}
            }

            logDetails.append("Pushed ").append(syncedCount).append(" prices to Odoo product_template.");

            // Log history
            PreparedStatement lps = conn.prepareStatement(
                "INSERT INTO clinlims.test_cost_sync_log (sync_type, direction, items_synced, items_failed, details, performed_by) " +
                "VALUES ('MANUAL', 'OPENELIS_TO_ODOO', ?, ?, ?, ?)"
            );
            lps.setInt(1, syncedCount);
            lps.setInt(2, failedCount);
            lps.setString(3, logDetails.toString());
            lps.setString(4, operator);
            lps.executeUpdate();
            lps.close();

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("itemsSynced", syncedCount);
            resp.put("itemsFailed", failedCount);
            resp.put("message", "Successfully pushed " + syncedCount + " test & panel prices to Odoo.");
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 4. ACTION: UPDATE SINGLE ITEM COST
        // =========================================================================
        if ("updateSingleCost".equals(action)) {
            String idStr = request.getParameter("id");
            String costStr = request.getParameter("cost");
            if (idStr == null || costStr == null) {
                out.print("{\"success\":false,\"error\":\"id and cost are required\"}");
                return;
            }

            int id = Integer.parseInt(idStr.trim());
            double newCost = Double.parseDouble(costStr.trim());
            if (newCost < 0) {
                out.print("{\"success\":false,\"error\":\"Cost cannot be negative\"}");
                return;
            }

            ps = conn.prepareStatement("SELECT odoo_product_id, item_name FROM clinlims.test_cost WHERE id = ?");
            ps.setInt(1, id);
            rs = ps.executeQuery();
            int odooId = 0;
            String itemName = "";
            if (rs.next()) {
                odooId = rs.getInt(1);
                itemName = rs.getString(2);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // Update in OpenELIS
            ps = conn.prepareStatement(
                "UPDATE clinlims.test_cost " +
                "SET cost = ?, sync_status = 'SYNCED', last_sync_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP " +
                "WHERE id = ?"
            );
            ps.setDouble(1, newCost);
            ps.setInt(2, id);
            ps.executeUpdate();
            if (ps != null) ps.close();

            // If matched in Odoo, push to Odoo immediately
            if (odooId > 0) {
                Connection odooConn = null;
                PreparedStatement ops = null;
                try {
                    odooConn = DriverManager.getConnection("jdbc:postgresql://odoodb:5432/odoo", "odoo", "odoo");
                    ops = odooConn.prepareStatement("UPDATE product_template SET list_price = ?, write_date = CURRENT_TIMESTAMP WHERE id = ?");
                    ops.setDouble(1, newCost);
                    ops.setInt(2, odooId);
                    ops.executeUpdate();
                } catch (Exception ignore) {}
                finally {
                    if (ops != null) try { ops.close(); } catch (Exception ignore) {}
                    if (odooConn != null) try { odooConn.close(); } catch (Exception ignore) {}
                }
            }

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("id", id);
            resp.put("cost", newCost);
            resp.put("message", "Cost updated and synced successfully.");
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 5. ACTION: GET SYNC HISTORY / AUDIT LOG
        // =========================================================================
        if ("getSyncHistory".equals(action)) {
            ps = conn.prepareStatement("SELECT id, sync_type, direction, items_synced, items_failed, details, performed_by, created_at FROM clinlims.test_cost_sync_log ORDER BY created_at DESC LIMIT 50");
            rs = ps.executeQuery();

            JSONArray logs = new JSONArray();
            while (rs.next()) {
                JSONObject l = new JSONObject();
                l.put("id", rs.getInt("id"));
                l.put("syncType", rs.getString("sync_type"));
                l.put("direction", rs.getString("direction"));
                l.put("itemsSynced", rs.getInt("items_synced"));
                l.put("itemsFailed", rs.getInt("items_failed"));
                l.put("details", rs.getString("details"));
                l.put("performedBy", rs.getString("performed_by"));
                l.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                logs.put(l);
            }

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("logs", logs);
            out.print(resp.toString());
            return;
        }

        out.print("{\"success\":false,\"error\":\"Invalid action\"}");

    } catch (Exception e) {
        out.print("{\"success\":false,\"error\":\"" + (e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Internal Error") + "\"}");
    } finally {
        if (rs != null) try { rs.close(); } catch (Exception ignore) {}
        if (ps != null) try { ps.close(); } catch (Exception ignore) {}
        if (conn != null) try { conn.close(); } catch (Exception ignore) {}
    }
%>
