<%@ page language="java" contentType="text/html; charset=utf-8"
    import="java.sql.*, java.util.*, us.mn.state.health.lims.login.valueholder.UserSessionData"%>
<%@ taglib uri="/tags/struts-bean" prefix="bean" %>
<%@ taglib uri="/tags/struts-html" prefix="html" %>
<%@ taglib uri="/tags/struts-logic" prefix="logic" %>

<style>
    #tmTable { border-collapse: collapse; width: 100%; }
    #tmTable th, #tmTable td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    #tmTable th { background: #486086; color: white; cursor: pointer; white-space: nowrap; }
    #tmTable th:hover { background: #3a4f6f; }
    #tmTable tr:nth-child(even) { background: #f9f9f9; }
    #tmTable tr:hover { background: #e8f0fe; }
    .tm-btn { padding: 6px 14px; cursor: pointer; border: 1px solid #999; background: #f0f0f0; margin: 2px; font-size: 13px; }
    .tm-btn-primary { background: #486086; color: white; border: none; }
    .tm-btn-secondary { background: #6c757d; color: white; border: none; }
    .tm-btn-danger { background: #c0392b; color: white; border: none; }
    .tm-btn-success { background: #27ae60; color: white; border: none; }
    .tm-btn-warning { background: #e67e22; color: white; border: none; }
    .tm-btn-sm { padding: 3px 8px; font-size: 11px; }

    /* Advanced Filter Card Styling */
    .tm-filter-card {
        background: #ffffff;
        border: 1px solid #d0d7de;
        border-radius: 8px;
        padding: 14px 18px;
        margin: 12px 0 16px 0;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .tm-search-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 12px;
    }
    .tm-search-input-wrap {
        position: relative;
        flex: 1;
        min-width: 280px;
        display: flex;
        align-items: center;
    }
    .tm-search-input-wrap input {
        width: 100%;
        padding: 8px 30px 8px 34px;
        font-size: 13px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .tm-search-input-wrap input:focus {
        border-color: #486086;
        box-shadow: 0 0 0 3px rgba(72,96,134,0.15);
    }
    .tm-search-icon {
        position: absolute;
        left: 10px;
        color: #8c9ba5;
        font-size: 14px;
        pointer-events: none;
    }
    .tm-search-clear-btn {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
    }
    .tm-search-clear-btn:hover { color: #333; }
    .tm-filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 10px 14px;
        margin-bottom: 12px;
        padding-top: 12px;
        border-top: 1px solid #eef2f6;
    }
    .tm-filter-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .tm-filter-item label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #475569;
    }
    .tm-filter-item select {
        padding: 6px 8px;
        font-size: 12px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: white;
        outline: none;
    }
    .tm-filter-item select:focus {
        border-color: #486086;
    }
    .tm-preset-row {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        padding-top: 10px;
        border-top: 1px solid #eef2f6;
    }
    .tm-preset-chip {
        padding: 4px 10px;
        border-radius: 14px;
        border: 1px solid #d0d7de;
        background: #ffffff;
        color: #486086;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
    }
    .tm-preset-chip:hover {
        background: #e8f0fe;
        border-color: #486086;
    }
    .tm-preset-chip.active {
        background: #486086;
        color: #ffffff;
        border-color: #486086;
    }
    .tm-active-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #e8f0fe;
        color: #1967d2;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 600;
    }

    .tm-filter-bar { margin: 12px 0; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .tm-filter-bar label { font-weight: bold; font-size: 13px; }
    .tm-filter-bar select, .tm-filter-bar input[type="text"] { padding: 5px 8px; font-size: 13px; border: 1px solid #ccc; border-radius: 3px; }
    .tm-count { background: #486086; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; }
    .tm-status-y { color: green; font-weight: bold; }
    .tm-status-n { color: #999; }
    .tm-sort-indicator { margin-left: 4px; font-size: 10px; }
    .tm-pagination { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .tm-action-bar { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
    .tm-msg { padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-weight: bold; }
    .tm-msg-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .tm-msg-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .tm-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; }
    .tm-modal { background: white; border-radius: 8px; padding: 20px; width: 600px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .tm-modal h3 { margin-top: 0; color: #486086; }
    .tm-form-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
    .tm-form-row label { font-weight: bold; width: 160px; font-size: 13px; }
    .tm-form-row input, .tm-form-row select { flex: 1; padding: 5px 8px; font-size: 13px; border: 1px solid #ccc; border-radius: 3px; }
    .tm-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
    .tm-edit-btn { color: #486086; cursor: pointer; text-decoration: underline; font-size: 12px; }
    .tm-edit-btn:hover { color: #2c3e50; }
    .tm-del-btn { color: #c0392b; cursor: pointer; text-decoration: underline; font-size: 12px; }
    .tm-del-btn:hover { color: #922b21; }
</style>

<%
    String dbUrl = "jdbc:postgresql://openelisdb:5432/clinlims";
    String dbUser = "clinlims";
    String dbPass = "clinlims";

    String selectedLocationId = (String) session.getAttribute("selectedLabLocationId");
    String selectedLocationName = (String) session.getAttribute("selectedLabLocationName");
    boolean isLocationAdmin = false;
    int sessionUserId = 0;
    try {
        us.mn.state.health.lims.login.valueholder.UserSessionData usd =
            (us.mn.state.health.lims.login.valueholder.UserSessionData) session.getAttribute("userSessionData");
        if (usd != null) {
            sessionUserId = usd.getSystemUserId();
        }
    } catch (Exception e) {}

    try {
        if (sessionUserId > 0) {
            Connection chkConn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
            PreparedStatement chkPs = chkConn.prepareStatement(
                "SELECT 1 FROM system_user_role sur JOIN system_role sr ON sur.role_id = sr.id " +
                "WHERE sur.system_user_id = ? AND sr.name IN ('Maintenance Admin','User Admin') AND sr.active = true LIMIT 1");
            chkPs.setInt(1, sessionUserId);
            ResultSet chkRs = chkPs.executeQuery();
            if (chkRs.next()) isLocationAdmin = true;
            chkRs.close(); chkPs.close(); chkConn.close();
        }
    } catch (Exception e) {}
%>

<div style="margin-bottom:15px;">
    <a href="MasterListsPage.do" style="color:#486086;text-decoration:none;font-weight:bold;font-size:14px;">&#8592; Back to Master Lists</a>
</div>

<% if (!isLocationAdmin && selectedLocationName != null && !selectedLocationName.isEmpty()) { %>
<div style="background:#d1ecf1;border:1px solid #bee5eb;color:#0c5460;padding:6px 12px;border-radius:4px;margin-bottom:10px;font-size:13px;">
    Showing tests for location: <strong><%= selectedLocationName %></strong>
    (<a href="LocationSelect.do" style="color:#0c5460;">Change Location</a>)
</div>
<% } else if (!isLocationAdmin && (selectedLocationId == null || selectedLocationId.isEmpty())) { %>
<div style="background:#fff3cd;border:1px solid #ffc107;color:#856404;padding:6px 12px;border-radius:4px;margin-bottom:10px;font-size:13px;">
    No location selected. <a href="LocationSelect.do" style="color:#856404;">Select a location</a> to filter tests.
</div>
<% } %>

<%
    String action = request.getParameter("action") != null ? request.getParameter("action") : "";
    String msgType = "";
    String msgText = "";

    // Handle CRUD actions before rendering
    if ("add".equals(action) || "update".equals(action)) {
        Connection actConn = null;
        try {
            Class.forName("org.postgresql.Driver");
            actConn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
            actConn.setAutoCommit(false);

            String testName = request.getParameter("testName") != null ? request.getParameter("testName").trim() : "";
            String testDesc = request.getParameter("testDesc") != null ? request.getParameter("testDesc").trim() : "";
            String testSectionId = request.getParameter("testSectionId") != null ? request.getParameter("testSectionId") : "";
            String methodId = request.getParameter("methodId") != null ? request.getParameter("methodId") : "";
            String uomId = request.getParameter("uomId") != null ? request.getParameter("uomId") : "";
            String isActive = request.getParameter("isActive") != null ? request.getParameter("isActive") : "Y";
            String isReportable = request.getParameter("isReportable") != null ? request.getParameter("isReportable") : "N";
            String isReferredOut = request.getParameter("isReferredOut") != null ? request.getParameter("isReferredOut") : "false";
            String sortOrder = request.getParameter("sortOrder") != null ? request.getParameter("sortOrder") : "2147483647";
            String localAbbrev = request.getParameter("localAbbrev") != null ? request.getParameter("localAbbrev").trim() : "";
            String labLocationId = request.getParameter("labLocationId") != null ? request.getParameter("labLocationId") : "";
            String timeAverage = request.getParameter("timeAverage") != null ? request.getParameter("timeAverage").trim() : "";
            String timeWarning = request.getParameter("timeWarning") != null ? request.getParameter("timeWarning").trim() : "";
            String timeMax = request.getParameter("timeMax") != null ? request.getParameter("timeMax").trim() : "";
            String openmrsTestName = request.getParameter("openmrsTestName") != null ? request.getParameter("openmrsTestName").trim() : "";
            String openmrsShortName = request.getParameter("openmrsShortName") != null ? request.getParameter("openmrsShortName").trim() : "";
            String openmrsSampleCategory = request.getParameter("openmrsSampleCategory") != null ? request.getParameter("openmrsSampleCategory").trim() : "";

            if (testName.isEmpty() || testDesc.isEmpty()) {
                msgType = "error";
                msgText = "Test Name and Description are required.";
            } else {
                if ("add".equals(action)) {
                    // Check unique description
                    PreparedStatement dupChk = actConn.prepareStatement("SELECT 1 FROM test WHERE description = ?");
                    dupChk.setString(1, testDesc);
                    ResultSet dupRs = dupChk.executeQuery();
                    if (dupRs.next()) {
                        msgType = "error";
                        msgText = "A test with this Description already exists.";
                    } else {
                        PreparedStatement ins = actConn.prepareStatement(
                            "INSERT INTO test (id, name, description, test_section_id, method_id, uom_id, is_active, is_reportable, is_referred_out, sort_order, local_abbrev, lab_location_id, time_ta_average, time_ta_warning, time_ta_max, openmrs_test_name, openmrs_short_name, openmrs_sample_category) " +
                            "VALUES ((SELECT COALESCE(MAX(id),0)+1 FROM test), ?, ?, ?::numeric, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::numeric END, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::numeric END, " +
                            "?, ?, ?::boolean, ?::numeric, ?, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::int END, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::numeric END, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::numeric END, " +
                            "CASE WHEN ? = '' THEN NULL ELSE ?::numeric END, ?, ?, ?)");
                        ins.setString(1, testName);
                        ins.setString(2, testDesc);
                        ins.setString(3, testSectionId);
                        ins.setString(4, methodId); ins.setString(5, methodId);
                        ins.setString(6, uomId); ins.setString(7, uomId);
                        ins.setString(8, isActive);
                        ins.setString(9, isReportable);
                        ins.setString(10, isReferredOut);
                        ins.setString(11, sortOrder);
                        ins.setString(12, localAbbrev);
                        ins.setString(13, labLocationId); ins.setString(14, labLocationId);
                        ins.setString(15, timeAverage); ins.setString(16, timeAverage);
                        ins.setString(17, timeWarning); ins.setString(18, timeWarning);
                        ins.setString(19, timeMax); ins.setString(20, timeMax);
                        ins.setString(21, openmrsTestName);
                        ins.setString(22, openmrsShortName);
                        ins.setString(23, openmrsSampleCategory);
                        ins.executeUpdate();
                        ins.close();
                        actConn.commit();
                        msgType = "success";
                        msgText = "Test created successfully.";
                    }
                    dupRs.close();
                    dupChk.close();
                } else if ("update".equals(action)) {
                    String editId = request.getParameter("editId") != null ? request.getParameter("editId") : "";
                    if (editId.isEmpty()) {
                        msgType = "error";
                        msgText = "Missing test ID for update.";
                    } else {
                        // Check unique description for other tests
                        PreparedStatement dupChk = actConn.prepareStatement("SELECT 1 FROM test WHERE description = ? AND id != ?::numeric");
                        dupChk.setString(1, testDesc);
                        dupChk.setString(2, editId);
                        ResultSet dupRs = dupChk.executeQuery();
                        if (dupRs.next()) {
                            msgType = "error";
                            msgText = "Another test with this Description already exists.";
                        } else {
                        PreparedStatement upd = actConn.prepareStatement(
                            "UPDATE test SET name=?, description=?, test_section_id=?::numeric, " +
                            "method_id=CASE WHEN ?='' THEN NULL ELSE ?::numeric END, " +
                            "uom_id=CASE WHEN ?='' THEN NULL ELSE ?::numeric END, " +
                            "is_active=?, is_reportable=?, is_referred_out=?::boolean, " +
                            "sort_order=?::numeric, local_abbrev=?, " +
                            "lab_location_id=CASE WHEN ?='' THEN NULL ELSE ?::int END, " +
                            "time_ta_average=CASE WHEN ?='' THEN NULL ELSE ?::numeric END, " +
                            "time_ta_warning=CASE WHEN ?='' THEN NULL ELSE ?::numeric END, " +
                            "time_ta_max=CASE WHEN ?='' THEN NULL ELSE ?::numeric END, " +
                            "openmrs_test_name=?, openmrs_short_name=?, openmrs_sample_category=?, " +
                            "lastupdated=NOW() WHERE id=?::numeric");
                        upd.setString(1, testName);
                        upd.setString(2, testDesc);
                        upd.setString(3, testSectionId);
                        upd.setString(4, methodId); upd.setString(5, methodId);
                        upd.setString(6, uomId); upd.setString(7, uomId);
                        upd.setString(8, isActive);
                        upd.setString(9, isReportable);
                        upd.setString(10, isReferredOut);
                        upd.setString(11, sortOrder);
                        upd.setString(12, localAbbrev);
                        upd.setString(13, labLocationId); upd.setString(14, labLocationId);
                        upd.setString(15, timeAverage); upd.setString(16, timeAverage);
                        upd.setString(17, timeWarning); upd.setString(18, timeWarning);
                        upd.setString(19, timeMax); upd.setString(20, timeMax);
                        upd.setString(21, openmrsTestName);
                        upd.setString(22, openmrsShortName);
                        upd.setString(23, openmrsSampleCategory);
                        upd.setString(24, editId);
                        upd.executeUpdate();
                        upd.close();
                            actConn.commit();
                            msgType = "success";
                            msgText = "Test updated successfully.";
                        }
                        dupRs.close();
                        dupChk.close();
                    }
                }
            }
        } catch (Exception e) {
            msgType = "error";
            msgText = "Error: " + e.getMessage();
            if (actConn != null) try { actConn.rollback(); } catch (Exception ex) {}
        } finally {
            if (actConn != null) try { actConn.close(); } catch (Exception ex) {}
        }
        action = "";
    } else if ("delete".equals(action)) {
        String delId = request.getParameter("delId") != null ? request.getParameter("delId") : "";
        if (!delId.isEmpty()) {
            Connection delConn = null;
            try {
                Class.forName("org.postgresql.Driver");
                delConn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
                delConn.setAutoCommit(false);

                // Check for real patient analysis rows
                PreparedStatement chk = delConn.prepareStatement(
                    "SELECT (SELECT COUNT(*) FROM analysis WHERE test_id = ?::numeric) + " +
                    "(SELECT COUNT(*) FROM result r JOIN test_result tr ON r.test_result_id = tr.id WHERE tr.test_id = ?::numeric)");
                chk.setString(1, delId); chk.setString(2, delId);
                ResultSet chkRs = chk.executeQuery();
                int refCount = 0;
                if (chkRs.next()) refCount = chkRs.getInt(1);
                chkRs.close(); chk.close();

                if (refCount > 0) {
                    msgType = "error";
                    msgText = "Cannot delete: test has " + refCount + " patient record(s) (analysis/findings). Please deactivate instead.";
                } else {
                    // Clean up test configuration tables
                    String[] cleanTables = {"test_result", "result_limits", "test_analyte", "sampletype_test", "panel_item", "external_reference"};
                    for (String tbl : cleanTables) {
                        try {
                            String col = "external_reference".equals(tbl) ? "item_id" : "test_id";
                            String extra = "external_reference".equals(tbl) ? " AND type = 'Test'" : "";
                            PreparedStatement cln = delConn.prepareStatement("DELETE FROM " + tbl + " WHERE " + col + " = ?::numeric" + extra);
                            cln.setString(1, delId);
                            cln.executeUpdate();
                            cln.close();
                        } catch (Exception ignore) {}
                    }

                    PreparedStatement del = delConn.prepareStatement("DELETE FROM test WHERE id = ?::numeric");
                    del.setString(1, delId);
                    int rows = del.executeUpdate();
                    del.close();
                    delConn.commit();

                    msgType = rows > 0 ? "success" : "error";
                    msgText = rows > 0 ? "Test deleted successfully." : "Test not found.";
                }
            } catch (Exception e) {
                msgType = "error";
                msgText = "Delete error: " + e.getMessage();
                if (delConn != null) try { delConn.rollback(); } catch (Exception rx) {}
            } finally {
                if (delConn != null) try { delConn.close(); } catch (Exception ex) {}
            }
        }
        action = "";
    } else if ("bulkdelete".equals(action)) {
        String[] ids = request.getParameterValues("selectedIDs");
        if (ids != null && ids.length > 0) {
            Connection delConn = null;
            try {
                Class.forName("org.postgresql.Driver");
                delConn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
                delConn.setAutoCommit(false);
                int deleted = 0;
                int skipped = 0;
                for (String idVal : ids) {
                    if (idVal == null || idVal.trim().isEmpty()) continue;
                    // Check for real patient analysis rows
                    PreparedStatement chk = delConn.prepareStatement(
                        "SELECT (SELECT COUNT(*) FROM analysis WHERE test_id = ?::numeric) + " +
                        "(SELECT COUNT(*) FROM result r JOIN test_result tr ON r.test_result_id = tr.id WHERE tr.test_id = ?::numeric)");
                    chk.setString(1, idVal.trim()); chk.setString(2, idVal.trim());
                    ResultSet chkRs = chk.executeQuery();
                    int refCount = 0;
                    if (chkRs.next()) refCount = chkRs.getInt(1);
                    chkRs.close(); chk.close();

                    if (refCount == 0) {
                        String[] cleanTables = {"test_result", "result_limits", "test_analyte", "sampletype_test", "panel_item", "external_reference"};
                        for (String tbl : cleanTables) {
                            try {
                                String col = "external_reference".equals(tbl) ? "item_id" : "test_id";
                                String extra = "external_reference".equals(tbl) ? " AND type = 'Test'" : "";
                                PreparedStatement cln = delConn.prepareStatement("DELETE FROM " + tbl + " WHERE " + col + " = ?::numeric" + extra);
                                cln.setString(1, idVal.trim());
                                cln.executeUpdate();
                                cln.close();
                            } catch (Exception ignore) {}
                        }

                        PreparedStatement del = delConn.prepareStatement("DELETE FROM test WHERE id = ?::numeric");
                        del.setString(1, idVal.trim());
                        del.executeUpdate();
                        del.close();
                        deleted++;
                    } else {
                        skipped++;
                    }
                }
                delConn.commit();
                msgType = "success";
                msgText = "Deleted " + deleted + " test(s)." + (skipped > 0 ? " Skipped " + skipped + " (has patient analysis/results)." : "");
            } catch (Exception e) {
                msgType = "error";
                msgText = "Bulk delete error: " + e.getMessage();
                if (delConn != null) try { delConn.rollback(); } catch (Exception rx) {}
            } finally {
                if (delConn != null) try { delConn.close(); } catch (Exception ex) {}
            }
        }
        action = "";
    } else if ("bulkactivate".equals(action) || "bulkdeactivate".equals(action)) {
        String[] ids = request.getParameterValues("selectedIDs");
        String targetActive = "bulkactivate".equals(action) ? "Y" : "N";
        if (ids != null && ids.length > 0) {
            Connection actConn2 = null;
            try {
                Class.forName("org.postgresql.Driver");
                actConn2 = DriverManager.getConnection(dbUrl, dbUser, dbPass);
                PreparedStatement ps = actConn2.prepareStatement("UPDATE test SET is_active = ?, lastupdated = NOW() WHERE id = ?::numeric");
                int updated = 0;
                for (String idVal : ids) {
                    if (idVal == null || idVal.trim().isEmpty()) continue;
                    ps.setString(1, targetActive);
                    ps.setString(2, idVal.trim());
                    ps.executeUpdate();
                    updated++;
                }
                ps.close();
                msgType = "success";
                msgText = (targetActive.equals("Y") ? "Activated " : "Deactivated ") + updated + " test(s).";
            } catch (Exception e) {
                msgType = "error";
                msgText = "Bulk status update error: " + e.getMessage();
            } finally {
                if (actConn2 != null) try { actConn2.close(); } catch (Exception ex) {}
            }
        }
        action = "";
    } else if ("toggleactive".equals(action)) {
        String toggleId = request.getParameter("toggleId") != null ? request.getParameter("toggleId") : "";
        if (!toggleId.isEmpty()) {
            Connection togConn = null;
            try {
                Class.forName("org.postgresql.Driver");
                togConn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
                PreparedStatement tog = togConn.prepareStatement("UPDATE test SET is_active = CASE WHEN UPPER(TRIM(COALESCE(is_active,'N'))) = 'Y' THEN 'N' ELSE 'Y' END, lastupdated = NOW() WHERE id = ?::numeric");
                tog.setString(1, toggleId);
                int rows = tog.executeUpdate();
                tog.close();
                msgType = rows > 0 ? "success" : "error";
                msgText = rows > 0 ? "Test status toggled." : "Test not found.";
            } catch (Exception e) {
                msgType = "error";
                msgText = "Toggle error: " + e.getMessage();
            } finally {
                if (togConn != null) try { togConn.close(); } catch (Exception ex) {}
            }
        }
        action = "";
    }

    // Read filter params for listing
    String filterSection = request.getParameter("filterSection") != null ? request.getParameter("filterSection") : "";
    String filterActive = request.getParameter("filterActive") != null ? request.getParameter("filterActive") : "";
    String filterReportable = request.getParameter("filterReportable") != null ? request.getParameter("filterReportable") : "";
    String filterReferredOut = request.getParameter("filterReferredOut") != null ? request.getParameter("filterReferredOut") : "";
    String filterSampleCategory = request.getParameter("filterSampleCategory") != null ? request.getParameter("filterSampleCategory").trim() : "";
    String filterShortName = request.getParameter("filterShortName") != null ? request.getParameter("filterShortName").trim() : "";
    String filterLocation = request.getParameter("filterLocation") != null ? request.getParameter("filterLocation").trim() : "";
    String searchField = request.getParameter("searchField") != null ? request.getParameter("searchField").trim() : "all";
    String searchName = request.getParameter("searchName") != null ? request.getParameter("searchName").trim() : "";
    String sortBy = request.getParameter("sortBy") != null ? request.getParameter("sortBy") : "t.description";
    String sortDir = request.getParameter("sortDir") != null ? request.getParameter("sortDir") : "ASC";
    String pageSizeParam = request.getParameter("pageSize");
    int pageSize = 20;
    if (pageSizeParam != null && !pageSizeParam.trim().isEmpty()) {
        try {
            pageSize = Integer.parseInt(pageSizeParam.trim());
            if (pageSize <= 0) pageSize = 20;
            if (pageSize > 1000) pageSize = 1000;
        } catch (Exception e) { pageSize = 20; }
    }

    Set<String> validSortCols = new HashSet<String>(Arrays.asList(
        "t.description", "t.name", "t.openmrs_test_name", "ts.description", "t.is_active", "t.is_reportable", "t.is_referred_out", "t.sort_order", "t.openmrs_short_name", "t.openmrs_sample_category"
    ));
    if (!validSortCols.contains(sortBy)) sortBy = "t.description";
    if (!"ASC".equalsIgnoreCase(sortDir) && !"DESC".equalsIgnoreCase(sortDir)) sortDir = "ASC";

    StringBuilder where = new StringBuilder("WHERE 1=1");
    List<String> params = new ArrayList<String>();

    if (filterSection != null && !filterSection.isEmpty()) {
        where.append(" AND t.test_section_id = ?::numeric");
        params.add(filterSection);
    }
    if (filterActive != null && !filterActive.isEmpty()) {
        where.append(" AND t.is_active = ?");
        params.add(filterActive);
    }
    if (filterReportable != null && !filterReportable.isEmpty()) {
        where.append(" AND t.is_reportable = ?");
        params.add(filterReportable);
    }
    if (filterReferredOut != null && !filterReferredOut.isEmpty()) {
        where.append(" AND t.is_referred_out = ?::boolean");
        params.add(filterReferredOut);
    }

    // Advanced Filter: Sample Category
    if (filterSampleCategory != null && !filterSampleCategory.isEmpty()) {
        if ("__NONE__".equalsIgnoreCase(filterSampleCategory)) {
            where.append(" AND (t.openmrs_sample_category IS NULL OR TRIM(t.openmrs_sample_category) = '')");
        } else if ("__HAS__".equalsIgnoreCase(filterSampleCategory)) {
            where.append(" AND (t.openmrs_sample_category IS NOT NULL AND TRIM(t.openmrs_sample_category) != '')");
        } else {
            where.append(" AND t.openmrs_sample_category ILIKE ?");
            params.add("%" + filterSampleCategory + "%");
        }
    }

    // Advanced Filter: Short Name
    if (filterShortName != null && !filterShortName.isEmpty()) {
        if ("none".equalsIgnoreCase(filterShortName)) {
            where.append(" AND (t.openmrs_short_name IS NULL OR TRIM(t.openmrs_short_name) = '')");
        } else if ("has".equalsIgnoreCase(filterShortName)) {
            where.append(" AND (t.openmrs_short_name IS NOT NULL AND TRIM(t.openmrs_short_name) != '')");
        }
    }

    // Advanced Filter: Search Query with Field Selection
    if (searchName != null && !searchName.isEmpty()) {
        String sTerm = "%" + searchName + "%";
        if ("name".equalsIgnoreCase(searchField)) {
            where.append(" AND (t.description ILIKE ? OR t.name ILIKE ?)");
            params.add(sTerm);
            params.add(sTerm);
        } else if ("omrsname".equalsIgnoreCase(searchField)) {
            where.append(" AND t.openmrs_test_name ILIKE ?");
            params.add(sTerm);
        } else if ("short".equalsIgnoreCase(searchField)) {
            where.append(" AND t.openmrs_short_name ILIKE ?");
            params.add(sTerm);
        } else if ("sample".equalsIgnoreCase(searchField)) {
            where.append(" AND t.openmrs_sample_category ILIKE ?");
            params.add(sTerm);
        } else {
            where.append(" AND (t.description ILIKE ? OR t.name ILIKE ? OR t.openmrs_test_name ILIKE ? OR t.openmrs_short_name ILIKE ? OR t.openmrs_sample_category ILIKE ? OR ts.description ILIKE ?)");
            params.add(sTerm);
            params.add(sTerm);
            params.add(sTerm);
            params.add(sTerm);
            params.add(sTerm);
            params.add(sTerm);
        }
    }

    // Location filtering
    if (filterLocation != null && !filterLocation.isEmpty()) {
        where.append(" AND t.lab_location_id = ?::int");
        params.add(filterLocation);
    } else if (!isLocationAdmin && selectedLocationId != null && !selectedLocationId.isEmpty()) {
        where.append(" AND (t.lab_location_id = ?::int OR t.lab_location_id IS NULL)");
        params.add(selectedLocationId);
    }

    int currentPage = 1;
    String pageParam = request.getParameter("page");
    if (pageParam != null) {
        try { currentPage = Integer.parseInt(pageParam); } catch (Exception e) { currentPage = 1; }
    }
    int offset = (currentPage - 1) * pageSize;

    Connection conn = null;
    PreparedStatement countStmt = null;
    PreparedStatement stmt = null;
    ResultSet rs = null;
    ResultSet countRs = null;
    int totalCount = 0;
    int totalPages = 0;

    List<String[]> sections = new ArrayList<String[]>();
    List<String[]> methods = new ArrayList<String[]>();
    List<String[]> uomList = new ArrayList<String[]>();

    try {
        Class.forName("org.postgresql.Driver");
        conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);

        PreparedStatement sectionStmt = conn.prepareStatement("SELECT id, description FROM test_section ORDER BY description");
        ResultSet sectionRs = sectionStmt.executeQuery();
        while (sectionRs.next()) {
            sections.add(new String[]{sectionRs.getString("id"), sectionRs.getString("description")});
        }
        sectionRs.close();
        sectionStmt.close();

        PreparedStatement methodStmt = conn.prepareStatement("SELECT id, name FROM method ORDER BY name");
        ResultSet methodRs = methodStmt.executeQuery();
        while (methodRs.next()) {
            methods.add(new String[]{methodRs.getString("id"), methodRs.getString("name")});
        }
        methodRs.close();
        methodStmt.close();

        PreparedStatement uomStmt = conn.prepareStatement("SELECT id, name FROM unit_of_measure ORDER BY name");
        ResultSet uomRs = uomStmt.executeQuery();
        while (uomRs.next()) {
            uomList.add(new String[]{uomRs.getString("id"), uomRs.getString("name")});
        }
        uomRs.close();
        uomStmt.close();

        List<String[]> locList = new ArrayList<String[]>();
        PreparedStatement locStmt = conn.prepareStatement("SELECT id, name FROM lab_location WHERE is_active = true ORDER BY name");
        ResultSet locRs = locStmt.executeQuery();
        while (locRs.next()) {
            locList.add(new String[]{locRs.getString("id"), locRs.getString("name")});
        }
        locRs.close(); locStmt.close();
        pageContext.setAttribute("locList", locList);

        List<String> distinctCategories = new ArrayList<String>();
        try {
            PreparedStatement catStmt = conn.prepareStatement(
                "SELECT DISTINCT openmrs_sample_category FROM test " +
                "WHERE openmrs_sample_category IS NOT NULL AND TRIM(openmrs_sample_category) != '' " +
                "ORDER BY openmrs_sample_category");
            ResultSet catRs = catStmt.executeQuery();
            while (catRs.next()) {
                String c = catRs.getString(1);
                if (c != null && !c.trim().isEmpty()) {
                    distinctCategories.add(c.trim());
                }
            }
            catRs.close();
            catStmt.close();
        } catch (Exception e) {}
        pageContext.setAttribute("distinctCategories", distinctCategories);

        String countSql = "SELECT COUNT(*) FROM test t LEFT JOIN test_section ts ON t.test_section_id = ts.id " + where.toString();
        countStmt = conn.prepareStatement(countSql);
        for (int i = 0; i < params.size(); i++) {
            countStmt.setString(i + 1, params.get(i));
        }
        countRs = countStmt.executeQuery();
        if (countRs.next()) totalCount = countRs.getInt(1);
        countRs.close();
        countStmt.close();

        totalPages = (int) Math.ceil((double) totalCount / pageSize);

        String sql = "SELECT t.id, t.description, t.name, ts.description as section_name, t.test_section_id, " +
                     "t.is_active, t.is_reportable, t.is_referred_out, t.sort_order, t.method_id, t.uom_id, t.local_abbrev, " +
                     "t.lab_location_id, ll.name as location_name, t.time_ta_average, t.time_ta_warning, t.time_ta_max, " +
                     "t.openmrs_test_name, t.openmrs_short_name, t.openmrs_sample_category " +
                     "FROM test t LEFT JOIN test_section ts ON t.test_section_id = ts.id " +
                     "LEFT JOIN lab_location ll ON t.lab_location_id = ll.id " +
                     where.toString() + " ORDER BY " + sortBy + " " + sortDir + " LIMIT ? OFFSET ?";
        stmt = conn.prepareStatement(sql);
        int paramIdx = 1;
        for (String p : params) {
            stmt.setString(paramIdx++, p);
        }
        stmt.setInt(paramIdx++, pageSize);
        stmt.setInt(paramIdx++, offset);
        rs = stmt.executeQuery();

    } catch (Exception e) {
        out.println("<p style='color:red'>Error: " + e.getMessage() + "</p>");
    }

    String baseUrl = "TestMenuAdvanced.do?page=__PAGE__&sortBy=" + java.net.URLEncoder.encode(sortBy, "UTF-8") + "&sortDir=" + sortDir;
    if (pageSize != 20) baseUrl += "&pageSize=" + pageSize;
    if (filterSection != null && !filterSection.isEmpty()) baseUrl += "&filterSection=" + java.net.URLEncoder.encode(filterSection, "UTF-8");
    if (filterActive != null && !filterActive.isEmpty()) baseUrl += "&filterActive=" + java.net.URLEncoder.encode(filterActive, "UTF-8");
    if (filterReportable != null && !filterReportable.isEmpty()) baseUrl += "&filterReportable=" + java.net.URLEncoder.encode(filterReportable, "UTF-8");
    if (filterReferredOut != null && !filterReferredOut.isEmpty()) baseUrl += "&filterReferredOut=" + java.net.URLEncoder.encode(filterReferredOut, "UTF-8");
    if (filterSampleCategory != null && !filterSampleCategory.isEmpty()) baseUrl += "&filterSampleCategory=" + java.net.URLEncoder.encode(filterSampleCategory, "UTF-8");
    if (filterShortName != null && !filterShortName.isEmpty()) baseUrl += "&filterShortName=" + java.net.URLEncoder.encode(filterShortName, "UTF-8");
    if (filterLocation != null && !filterLocation.isEmpty()) baseUrl += "&filterLocation=" + java.net.URLEncoder.encode(filterLocation, "UTF-8");
    if (searchField != null && !searchField.isEmpty() && !"all".equals(searchField)) baseUrl += "&searchField=" + java.net.URLEncoder.encode(searchField, "UTF-8");
    if (searchName != null && !searchName.isEmpty()) baseUrl += "&searchName=" + java.net.URLEncoder.encode(searchName, "UTF-8");

    boolean hasFilters = !searchName.isEmpty() || !filterSection.isEmpty() || !filterActive.isEmpty() ||
                         !filterReportable.isEmpty() || !filterReferredOut.isEmpty() ||
                         !filterSampleCategory.isEmpty() || !filterShortName.isEmpty() || !filterLocation.isEmpty();
%>

<% if (!msgText.isEmpty()) { %>
<div class="tm-msg tm-msg-<%= msgType %>"><%= msgText %></div>
<% } %>

<h2 style="text-align:center;margin-bottom:6px;">Test Management</h2>

<!-- Advanced Search & Filter Card -->
<div class="tm-filter-card">
    <!-- Main Search Bar -->
    <div class="tm-search-row">
        <div class="tm-search-input-wrap">
            <span class="tm-search-icon">&#128269;</span>
            <input type="text" id="tmSearchName" value="<%= searchName %>" 
                   placeholder="Search test name, description, short name, sample category, section..." 
                   onkeyup="if(event.key==='Enter') tmApplyFilters()">
            <% if (!searchName.isEmpty()) { %>
                <button type="button" class="tm-search-clear-btn" onclick="document.getElementById('tmSearchName').value=''; tmApplyFilters();" title="Clear search">&times;</button>
            <% } %>
        </div>
        <select id="tmSearchField" onchange="tmApplyFilters()" style="padding:8px 10px;font-size:13px;border:1px solid #cbd5e1;border-radius:6px;background:white;">
            <option value="all" <%= "all".equals(searchField) ? "selected" : "" %>>All Fields</option>
            <option value="name" <%= "name".equals(searchField) ? "selected" : "" %>>OpenELIS Name / Desc</option>
            <option value="omrsname" <%= "omrsname".equals(searchField) ? "selected" : "" %>>OpenMRS Test Name</option>
            <option value="short" <%= "short".equals(searchField) ? "selected" : "" %>>OpenMRS Short Name</option>
            <option value="sample" <%= "sample".equals(searchField) ? "selected" : "" %>>Sample Category</option>
        </select>
        <button class="tm-btn tm-btn-primary" onclick="tmApplyFilters()">Search</button>
        <button class="tm-btn" onclick="tmClearFilters()">Reset All</button>
    </div>

    <!-- Filter Grid -->
    <div class="tm-filter-grid">
        <div class="tm-filter-item">
            <label>Test Section</label>
            <select id="tmFilterSection" onchange="tmApplyFilters()">
                <option value="">All Sections</option>
                <%
                    for (String[] sec : sections) {
                        String selected = sec[0].equals(filterSection) ? "selected" : "";
                        out.println("<option value='" + sec[0] + "' " + selected + ">" + sec[1] + "</option>");
                    }
                %>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Sample Category</label>
            <select id="tmFilterSampleCategory" onchange="tmApplyFilters()">
                <option value="">All Categories</option>
                <option value="__HAS__" <%= "__HAS__".equals(filterSampleCategory) ? "selected" : "" %>>&#10003; Has Category (Mapped)</option>
                <option value="__NONE__" <%= "__NONE__".equals(filterSampleCategory) ? "selected" : "" %>>&#9888; No Category (Unmapped)</option>
                <optgroup label="Specific Categories">
                    <%
                        List<String> dCats = (List<String>) pageContext.getAttribute("distinctCategories");
                        if (dCats != null) {
                            for (String dc : dCats) {
                                String selected = dc.equals(filterSampleCategory) ? "selected" : "";
                                out.println("<option value='" + dc.replace("'", "&#39;") + "' " + selected + ">" + dc + "</option>");
                            }
                        }
                    %>
                </optgroup>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Short Name</label>
            <select id="tmFilterShortName" onchange="tmApplyFilters()">
                <option value="">All</option>
                <option value="has" <%= "has".equals(filterShortName) ? "selected" : "" %>>&#10003; Has Short Name</option>
                <option value="none" <%= "none".equals(filterShortName) ? "selected" : "" %>>&#9888; Missing Short Name</option>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Status</label>
            <select id="tmFilterActive" onchange="tmApplyFilters()">
                <option value="">All Statuses</option>
                <option value="Y" <%= "Y".equals(filterActive) ? "selected" : "" %>>Active (Y)</option>
                <option value="N" <%= "N".equals(filterActive) ? "selected" : "" %>>Inactive (N)</option>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Reportable</label>
            <select id="tmFilterReportable" onchange="tmApplyFilters()">
                <option value="">All</option>
                <option value="Y" <%= "Y".equals(filterReportable) ? "selected" : "" %>>Yes (Y)</option>
                <option value="N" <%= "N".equals(filterReportable) ? "selected" : "" %>>No (N)</option>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Referred Out</label>
            <select id="tmFilterReferredOut" onchange="tmApplyFilters()">
                <option value="">All</option>
                <option value="false" <%= "false".equals(filterReferredOut) ? "selected" : "" %>>In-House (No)</option>
                <option value="true" <%= "true".equals(filterReferredOut) ? "selected" : "" %>>Referred Out (Yes)</option>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Lab Location</label>
            <select id="tmFilterLocation" onchange="tmApplyFilters()">
                <option value="">All Locations</option>
                <%
                    List<String[]> locListRef = (List<String[]>) pageContext.getAttribute("locList");
                    if (locListRef != null) {
                        for (String[] loc : locListRef) {
                            String selected = loc[0].equals(filterLocation) ? "selected" : "";
                            out.println("<option value='" + loc[0] + "' " + selected + ">" + loc[1] + "</option>");
                        }
                    }
                %>
            </select>
        </div>

        <div class="tm-filter-item">
            <label>Items Per Page</label>
            <select id="tmPageSize" onchange="tmApplyFilters()">
                <option value="20" <%= pageSize == 20 ? "selected" : "" %>>20 per page</option>
                <option value="50" <%= pageSize == 50 ? "selected" : "" %>>50 per page</option>
                <option value="100" <%= pageSize == 100 ? "selected" : "" %>>100 per page</option>
                <option value="500" <%= pageSize == 500 ? "selected" : "" %>>500 per page</option>
                <option value="1000" <%= pageSize == 1000 ? "selected" : "" %>>All (up to 1,000)</option>
            </select>
        </div>
    </div>

    <!-- Quick Filter Presets -->
    <div class="tm-preset-row">
        <span style="font-size:11px;font-weight:700;color:#64748b;margin-right:4px;text-transform:uppercase;">Quick Presets:</span>
        <button type="button" class="tm-preset-chip <%= !hasFilters ? "active" : "" %>" onclick="tmApplyPreset('all')">All Tests</button>
        <button type="button" class="tm-preset-chip <%= "Y".equals(filterActive) && !hasFilters ? "active" : "" %>" onclick="tmApplyPreset('active')">Active Tests</button>
        <button type="button" class="tm-preset-chip <%= "Blood".equals(filterSampleCategory) ? "active" : "" %>" onclick="tmApplyPreset('blood')">Blood / Serum</button>
        <button type="button" class="tm-preset-chip <%= "Urine".equals(filterSampleCategory) ? "active" : "" %>" onclick="tmApplyPreset('urine')">Urine Tests</button>
        <button type="button" class="tm-preset-chip <%= "has".equals(filterShortName) ? "active" : "" %>" onclick="tmApplyPreset('hasShort')">Has Short Name</button>
        <button type="button" class="tm-preset-chip <%= "none".equals(filterShortName) ? "active" : "" %>" onclick="tmApplyPreset('missingShort')">&#9888; Missing Short Name</button>
        <button type="button" class="tm-preset-chip <%= "__NONE__".equals(filterSampleCategory) ? "active" : "" %>" onclick="tmApplyPreset('unmapped')">&#9888; Unmapped Category</button>
        <button type="button" class="tm-preset-chip <%= "N".equals(filterActive) ? "active" : "" %>" onclick="tmApplyPreset('inactive')">Inactive Tests</button>

        <% if (hasFilters) { %>
            <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
                <span class="tm-active-badge">&#9679; Filters Active</span>
                <a href="javascript:void(0)" onclick="tmClearFilters()" style="color:#c0392b;font-size:12px;font-weight:600;text-decoration:none;">Clear Filters</a>
            </div>
        <% } %>
    </div>
</div>

<div class="tm-action-bar">
    <span class="tm-count">Showing <%= totalCount > 0 ? ((currentPage - 1) * pageSize + 1) : 0 %>-<%= Math.min(currentPage * pageSize, totalCount) %> of <%= totalCount %> tests</span>
    <button class="tm-btn tm-btn-success" onclick="tmOpenAddForm()">+ Add Test</button>
    <button class="tm-btn tm-btn-primary" onclick="tmSyncOpenmrs()" title="Sync Test Names, Short Names and Sample Categories from OpenMRS">&#8635; Sync from OpenMRS</button>
    <button class="tm-btn" onclick="tmSelectAll()">Select All</button>
    <button class="tm-btn" onclick="tmDeselectAll()">Deselect All</button>
    <button class="tm-btn tm-btn-success" onclick="tmBulkActivate()" title="Activate all selected tests">Activate Selected</button>
    <button class="tm-btn tm-btn-warning" onclick="tmBulkDeactivate()" title="Deactivate all selected tests">Deactivate Selected</button>
    <button class="tm-btn tm-btn-danger" onclick="tmBulkDelete()">Delete Selected</button>
</div>

<table id="tmTable">
    <thead>
        <tr>
            <th style="width:40px;">Select</th>
            <th onclick="tmSort('ts.description')">Test Section <%= "ts.description".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.description')">Test Description <%= "t.description".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.name')">Test Name <%= "t.name".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.openmrs_test_name')">OpenMRS Test Name <%= "t.openmrs_test_name".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.openmrs_short_name')">OpenMRS Short Name <%= "t.openmrs_short_name".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.openmrs_sample_category')">OpenMRS Sample Category <%= "t.openmrs_sample_category".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.is_active')" style="width:80px;">Active <%= "t.is_active".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.is_reportable')" style="width:90px;">Reportable <%= "t.is_reportable".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.is_referred_out')" style="width:90px;">Referred Out <%= "t.is_referred_out".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th onclick="tmSort('t.sort_order')" style="width:80px;">Sort Order <%= "t.sort_order".equals(sortBy) ? ("<span class='tm-sort-indicator'>" + ("ASC".equals(sortDir) ? "&#9650;" : "&#9660;") + "</span>") : "" %></th>
            <th style="width:110px;">TAT (Avg / Max)</th>
            <th style="width:100px;">Location</th>
            <th style="width:120px;">Actions</th>
        </tr>
    </thead>
    <tbody>
        <%
            if (rs != null) {
                while (rs.next()) {
                    String id = rs.getString("id");
                    String desc = rs.getString("description");
                    String name = rs.getString("name");
                    String section = rs.getString("section_name");
                    String sectionId = rs.getString("test_section_id");
                    String active = rs.getString("is_active");
                    String reportable = rs.getString("is_reportable");
                    boolean referredOut = rs.getBoolean("is_referred_out");
                    String sortOrder = rs.getString("sort_order");
                    String methodId = rs.getString("method_id");
                    String uomId = rs.getString("uom_id");
                    String localAbbrev = rs.getString("local_abbrev");
                    String locationId = rs.getString("lab_location_id");
                    String locationName = rs.getString("location_name");
                    String timeAvg = rs.getString("time_ta_average");
                    String timeWarn = rs.getString("time_ta_warning");
                    String timeMax = rs.getString("time_ta_max");
                    String openmrsTestName = rs.getString("openmrs_test_name");
                    String openmrsShortName = rs.getString("openmrs_short_name");
                    String openmrsSampleCategory = rs.getString("openmrs_sample_category");
                    String tatDisplay = (timeAvg != null ? timeAvg : "-") + " / " + (timeMax != null ? timeMax : "-");

                    String activeStr = (active != null && "Y".equalsIgnoreCase(active.trim())) ? "Y" : "N";
                    String activeClass = "Y".equals(activeStr) ? "tm-status-y" : "tm-status-n";
                    String reportableClass = "Y".equals(reportable) ? "tm-status-y" : "tm-status-n";
                    String referredClass = referredOut ? "tm-status-y" : "tm-status-n";
        %>
        <tr data-id="<%= id %>"
            data-name="<%= (name != null ? name.replace("\"", "&quot;") : "") %>"
            data-desc="<%= (desc != null ? desc.replace("\"", "&quot;") : "") %>"
            data-section="<%= sectionId != null ? sectionId : "" %>"
            data-method="<%= methodId != null ? methodId : "" %>"
            data-uom="<%= uomId != null ? uomId : "" %>"
            data-active="<%= activeStr %>"
            data-reportable="<%= reportable != null ? reportable : "N" %>"
            data-referred="<%= referredOut %>"
            data-sort="<%= sortOrder != null ? sortOrder : "2147483647" %>"
            data-abbrev="<%= (localAbbrev != null ? localAbbrev.replace("\"", "&quot;") : "") %>"
            data-openmrs-name="<%= (openmrsTestName != null ? openmrsTestName.replace("\"", "&quot;") : "") %>"
            data-openmrs-short="<%= (openmrsShortName != null ? openmrsShortName.replace("\"", "&quot;") : "") %>"
            data-openmrs-sample="<%= (openmrsSampleCategory != null ? openmrsSampleCategory.replace("\"", "&quot;") : "") %>"
            data-location="<%= locationId != null ? locationId : "" %>"
            data-time-avg="<%= timeAvg != null ? timeAvg : "" %>"
            data-time-warn="<%= timeWarn != null ? timeWarn : "" %>"
            data-time-max="<%= timeMax != null ? timeMax : "" %>">
            <td><input type="checkbox" class="tm-checkbox" value="<%= id %>"></td>
            <td><%= section != null ? section : "" %></td>
            <td><%= desc != null ? desc : "" %></td>
            <td><%= name != null ? name : "" %></td>
            <td>
                <% if (openmrsTestName != null && !openmrsTestName.trim().isEmpty()) { %>
                    <span style="font-weight:600;color:#1e293b;"><%= openmrsTestName %></span>
                <% } else { %>
                    <span style="color:#bbb;">-</span>
                <% } %>
            </td>
            <td>
                <% if (openmrsShortName != null && !openmrsShortName.trim().isEmpty()) { %>
                    <span style="background:#e8f0fe;color:#1967d2;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;"><%= openmrsShortName %></span>
                <% } else { %>
                    <span style="color:#bbb;">-</span>
                <% } %>
            </td>
            <td>
                <% if (openmrsSampleCategory != null && !openmrsSampleCategory.trim().isEmpty()) { %>
                    <span style="background:#e6f4ea;color:#137333;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;"><%= openmrsSampleCategory %></span>
                <% } else { %>
                    <span style="color:#bbb;">-</span>
                <% } %>
            </td>
            <td class="<%= activeClass %>"><%= activeStr %></td>
            <td class="<%= reportableClass %>"><%= reportable != null ? reportable : "" %></td>
            <td class="<%= referredClass %>"><%= referredOut ? "Y" : "N" %></td>
            <td><%= sortOrder != null ? sortOrder : "" %></td>
            <td><%= tatDisplay %></td>
            <td><%= locationName != null ? locationName : "<i>All</i>" %></td>
            <td>
                <span class="tm-edit-btn" onclick="tmEditRow(this)">Edit</span>
                &nbsp;|&nbsp;
                <span class="tm-del-btn" onclick="tmDelete(<%= id %>)">Delete</span>
                &nbsp;|&nbsp;
                <span class="tm-edit-btn" onclick="tmToggleActive(<%= id %>)" title="Toggle Active"><%= "Y".equals(activeStr) ? "Deactivate" : "Activate" %></span>
            </td>
        </tr>
        <%
                }
                rs.close();
            }
            if (stmt != null) stmt.close();
            if (conn != null) conn.close();
        %>
    </tbody>
</table>

<div class="tm-pagination">
    <% if (currentPage > 1) { %>
        <button class="tm-btn" onclick="location.href='<%= baseUrl.replace("__PAGE__", "1") %>'">&laquo; First</button>
        <button class="tm-btn" onclick="location.href='<%= baseUrl.replace("__PAGE__", String.valueOf(currentPage - 1)) %>'">&lsaquo; Prev</button>
    <% } %>
    <span>Page <%= currentPage %> of <%= totalPages %></span>
    <% if (currentPage < totalPages) { %>
        <button class="tm-btn" onclick="location.href='<%= baseUrl.replace("__PAGE__", String.valueOf(currentPage + 1)) %>'">Next &rsaquo;</button>
        <button class="tm-btn" onclick="location.href='<%= baseUrl.replace("__PAGE__", String.valueOf(totalPages)) %>'">Last &raquo;</button>
    <% } %>
</div>

<!-- Add/Edit Modal -->
<div id="tmFormOverlay" class="tm-overlay" style="display:none;" onclick="if(event.target===this) tmCloseForm()">
    <div class="tm-modal">
        <h3 id="tmFormTitle">Add Test</h3>
        <form id="tmForm" method="post" action="TestMenuAdvanced.do">
            <input type="hidden" name="action" id="tmFormAction" value="add">
            <input type="hidden" name="editId" id="tmFormEditId" value="">

            <div class="tm-form-row">
                <label>Test Name *:</label>
                <input type="text" name="testName" id="tmFormName" required>
            </div>
            <div class="tm-form-row">
                <label>Description *:</label>
                <input type="text" name="testDesc" id="tmFormDesc" required>
            </div>
            <div class="tm-form-row">
                <label>Test Section:</label>
                <select name="testSectionId" id="tmFormSection">
                    <option value="">-- None --</option>
                    <%
                        for (String[] sec : sections) {
                            out.println("<option value='" + sec[0] + "'>" + sec[1] + "</option>");
                        }
                    %>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Method:</label>
                <select name="methodId" id="tmFormMethod">
                    <option value="">-- None --</option>
                    <%
                        for (String[] m : methods) {
                            out.println("<option value='" + m[0] + "'>" + m[1] + "</option>");
                        }
                    %>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Unit of Measure:</label>
                <select name="uomId" id="tmFormUom">
                    <option value="">-- None --</option>
                    <%
                        for (String[] u : uomList) {
                            out.println("<option value='" + u[0] + "'>" + u[1] + "</option>");
                        }
                    %>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Is Active:</label>
                <select name="isActive" id="tmFormActive">
                    <option value="Y">Yes (Y)</option>
                    <option value="N">No (N)</option>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Is Reportable:</label>
                <select name="isReportable" id="tmFormReportable">
                    <option value="N">No (N)</option>
                    <option value="Y">Yes (Y)</option>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Referred Out:</label>
                <select name="isReferredOut" id="tmFormReferredOut">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </select>
            </div>
            <div class="tm-form-row">
                <label>Sort Order:</label>
                <input type="number" name="sortOrder" id="tmFormSortOrder" value="2147483647">
            </div>
            <div class="tm-form-row">
                <label>TAT (Avg / Warn / Max):</label>
                <div style="display:flex;gap:6px;flex:1;">
                    <input type="number" step="any" name="timeAverage" id="tmFormTimeAvg" placeholder="Avg" style="flex:1;">
                    <input type="number" step="any" name="timeWarning" id="tmFormTimeWarn" placeholder="Warn" style="flex:1;">
                    <input type="number" step="any" name="timeMax" id="tmFormTimeMax" placeholder="Max" style="flex:1;">
                </div>
            </div>
            <div class="tm-form-row">
                <label>Local Abbreviation:</label>
                <input type="text" name="localAbbrev" id="tmFormLocalAbbrev">
            </div>
            <div class="tm-form-row">
                <label>OpenMRS Test Name:</label>
                <input type="text" name="openmrsTestName" id="tmFormOpenmrsTestName" placeholder="e.g. Complete Blood Count">
            </div>
            <div class="tm-form-row">
                <label>OpenMRS Short Name:</label>
                <input type="text" name="openmrsShortName" id="tmFormOpenmrsShort" placeholder="e.g. CBC, ESR">
            </div>
            <div class="tm-form-row">
                <label>OpenMRS Sample Category:</label>
                <input type="text" name="openmrsSampleCategory" id="tmFormOpenmrsSample" placeholder="e.g. Blood Specimen, Serum, Urine">
            </div>
            <div class="tm-form-row">
                <label>Lab Location:</label>
                <select name="labLocationId" id="tmFormLocation">
                    <option value="">All Locations</option>
                    <%
                        List<String[]> locList = (List<String[]>) pageContext.getAttribute("locList");
                        if (locList != null) {
                            for (String[] loc : locList) {
                                out.println("<option value='" + loc[0] + "'>" + loc[1] + "</option>");
                            }
                        }
                    %>
                </select>
            </div>

            <div class="tm-form-actions">
                <button type="button" class="tm-btn" onclick="tmCloseForm()">Cancel</button>
                <button type="submit" class="tm-btn tm-btn-primary" id="tmFormSubmitBtn">Add Test</button>
            </div>
        </form>
    </div>
</div>

<script>
function tmApplyFilters() {
    var section = document.getElementById('tmFilterSection') ? document.getElementById('tmFilterSection').value : '';
    var active = document.getElementById('tmFilterActive') ? document.getElementById('tmFilterActive').value : '';
    var reportable = document.getElementById('tmFilterReportable') ? document.getElementById('tmFilterReportable').value : '';
    var referredOut = document.getElementById('tmFilterReferredOut') ? document.getElementById('tmFilterReferredOut').value : '';
    var sampleCat = document.getElementById('tmFilterSampleCategory') ? document.getElementById('tmFilterSampleCategory').value : '';
    var shortName = document.getElementById('tmFilterShortName') ? document.getElementById('tmFilterShortName').value : '';
    var loc = document.getElementById('tmFilterLocation') ? document.getElementById('tmFilterLocation').value : '';
    var pageSize = document.getElementById('tmPageSize') ? document.getElementById('tmPageSize').value : '20';
    var searchField = document.getElementById('tmSearchField') ? document.getElementById('tmSearchField').value : 'all';
    var search = document.getElementById('tmSearchName') ? document.getElementById('tmSearchName').value.trim() : '';

    var url = 'TestMenuAdvanced.do?page=1&sortBy=<%= sortBy %>&sortDir=<%= sortDir %>';
    if (pageSize && pageSize !== '20') url += '&pageSize=' + encodeURIComponent(pageSize);
    if (section) url += '&filterSection=' + encodeURIComponent(section);
    if (active) url += '&filterActive=' + encodeURIComponent(active);
    if (reportable) url += '&filterReportable=' + encodeURIComponent(reportable);
    if (referredOut) url += '&filterReferredOut=' + encodeURIComponent(referredOut);
    if (sampleCat) url += '&filterSampleCategory=' + encodeURIComponent(sampleCat);
    if (shortName) url += '&filterShortName=' + encodeURIComponent(shortName);
    if (loc) url += '&filterLocation=' + encodeURIComponent(loc);
    if (searchField && searchField !== 'all') url += '&searchField=' + encodeURIComponent(searchField);
    if (search) url += '&searchName=' + encodeURIComponent(search);
    location.href = url;
}

function tmClearFilters() {
    location.href = 'TestMenuAdvanced.do?page=1&sortBy=t.description&sortDir=ASC';
}

function tmApplyPreset(preset) {
    if (preset === 'all') {
        tmClearFilters();
    } else if (preset === 'active') {
        location.href = 'TestMenuAdvanced.do?page=1&filterActive=Y';
    } else if (preset === 'blood') {
        location.href = 'TestMenuAdvanced.do?page=1&filterSampleCategory=Blood';
    } else if (preset === 'urine') {
        location.href = 'TestMenuAdvanced.do?page=1&filterSampleCategory=Urine';
    } else if (preset === 'hasShort') {
        location.href = 'TestMenuAdvanced.do?page=1&filterShortName=has';
    } else if (preset === 'missingShort') {
        location.href = 'TestMenuAdvanced.do?page=1&filterShortName=none';
    } else if (preset === 'unmapped') {
        location.href = 'TestMenuAdvanced.do?page=1&filterSampleCategory=__NONE__';
    } else if (preset === 'inactive') {
        location.href = 'TestMenuAdvanced.do?page=1&filterActive=N';
    }
}

function tmSort(col) {
    var currentSort = '<%= sortBy %>';
    var currentDir = '<%= sortDir %>';
    var newDir = (col === currentSort && currentDir === 'ASC') ? 'DESC' : 'ASC';
    var url = 'TestMenuAdvanced.do?page=1&sortBy=' + col + '&sortDir=' + newDir;
    var section = document.getElementById('tmFilterSection') ? document.getElementById('tmFilterSection').value : '';
    var active = document.getElementById('tmFilterActive') ? document.getElementById('tmFilterActive').value : '';
    var reportable = document.getElementById('tmFilterReportable') ? document.getElementById('tmFilterReportable').value : '';
    var referredOut = document.getElementById('tmFilterReferredOut') ? document.getElementById('tmFilterReferredOut').value : '';
    var sampleCat = document.getElementById('tmFilterSampleCategory') ? document.getElementById('tmFilterSampleCategory').value : '';
    var shortName = document.getElementById('tmFilterShortName') ? document.getElementById('tmFilterShortName').value : '';
    var loc = document.getElementById('tmFilterLocation') ? document.getElementById('tmFilterLocation').value : '';
    var pageSize = document.getElementById('tmPageSize') ? document.getElementById('tmPageSize').value : '20';
    var searchField = document.getElementById('tmSearchField') ? document.getElementById('tmSearchField').value : 'all';
    var search = document.getElementById('tmSearchName') ? document.getElementById('tmSearchName').value.trim() : '';

    if (pageSize && pageSize !== '20') url += '&pageSize=' + encodeURIComponent(pageSize);
    if (section) url += '&filterSection=' + encodeURIComponent(section);
    if (active) url += '&filterActive=' + encodeURIComponent(active);
    if (reportable) url += '&filterReportable=' + encodeURIComponent(reportable);
    if (referredOut) url += '&filterReferredOut=' + encodeURIComponent(referredOut);
    if (sampleCat) url += '&filterSampleCategory=' + encodeURIComponent(sampleCat);
    if (shortName) url += '&filterShortName=' + encodeURIComponent(shortName);
    if (loc) url += '&filterLocation=' + encodeURIComponent(loc);
    if (searchField && searchField !== 'all') url += '&searchField=' + encodeURIComponent(searchField);
    if (search) url += '&searchName=' + encodeURIComponent(search);
    location.href = url;
}

function tmSelectAll() {
    document.querySelectorAll('.tm-checkbox').forEach(function(cb) { cb.checked = true; });
}

function tmDeselectAll() {
    document.querySelectorAll('.tm-checkbox').forEach(function(cb) { cb.checked = false; });
}

function tmOpenAddForm() {
    document.getElementById('tmFormTitle').textContent = 'Add Test';
    document.getElementById('tmFormAction').value = 'add';
    document.getElementById('tmFormEditId').value = '';
    document.getElementById('tmFormName').value = '';
    document.getElementById('tmFormDesc').value = '';
    document.getElementById('tmFormSection').value = '';
    document.getElementById('tmFormMethod').value = '';
    document.getElementById('tmFormUom').value = '';
    document.getElementById('tmFormActive').value = 'Y';
    document.getElementById('tmFormReportable').value = 'N';
    document.getElementById('tmFormReferredOut').value = 'false';
    document.getElementById('tmFormSortOrder').value = '2147483647';
    document.getElementById('tmFormTimeAvg').value = '';
    document.getElementById('tmFormTimeWarn').value = '';
    document.getElementById('tmFormTimeMax').value = '';
    document.getElementById('tmFormLocalAbbrev').value = '';
    document.getElementById('tmFormOpenmrsTestName').value = '';
    document.getElementById('tmFormOpenmrsShort').value = '';
    document.getElementById('tmFormOpenmrsSample').value = '';
    document.getElementById('tmFormLocation').value = '';
    document.getElementById('tmFormSubmitBtn').textContent = 'Add Test';
    document.getElementById('tmFormOverlay').style.display = 'flex';
}

function tmEditRow(el) {
    var tr = el.closest('tr');
    if (!tr) return;
    tmOpenEditForm(
        tr.getAttribute('data-id'),
        tr.getAttribute('data-name'),
        tr.getAttribute('data-desc'),
        tr.getAttribute('data-section'),
        tr.getAttribute('data-method'),
        tr.getAttribute('data-uom'),
        tr.getAttribute('data-active'),
        tr.getAttribute('data-reportable'),
        tr.getAttribute('data-referred'),
        tr.getAttribute('data-sort'),
        tr.getAttribute('data-abbrev'),
        tr.getAttribute('data-openmrs-name'),
        tr.getAttribute('data-openmrs-short'),
        tr.getAttribute('data-openmrs-sample'),
        tr.getAttribute('data-location'),
        tr.getAttribute('data-time-avg'),
        tr.getAttribute('data-time-warn'),
        tr.getAttribute('data-time-max')
    );
}

function tmOpenEditForm(id, name, desc, sectionId, methodId, uomId, active, reportable, referredOut, sortOrder, localAbbrev, openmrsTestName, openmrsShort, openmrsSample, locationId, timeAvg, timeWarn, timeMax) {
    document.getElementById('tmFormTitle').textContent = 'Edit Test';
    document.getElementById('tmFormAction').value = 'update';
    document.getElementById('tmFormEditId').value = id;
    document.getElementById('tmFormName').value = name;
    document.getElementById('tmFormDesc').value = desc;
    document.getElementById('tmFormSection').value = sectionId;
    document.getElementById('tmFormMethod').value = methodId;
    document.getElementById('tmFormUom').value = uomId;
    document.getElementById('tmFormActive').value = active;
    document.getElementById('tmFormReportable').value = reportable;
    document.getElementById('tmFormReferredOut').value = referredOut;
    document.getElementById('tmFormSortOrder').value = sortOrder;
    document.getElementById('tmFormTimeAvg').value = timeAvg || '';
    document.getElementById('tmFormTimeWarn').value = timeWarn || '';
    document.getElementById('tmFormTimeMax').value = timeMax || '';
    document.getElementById('tmFormLocalAbbrev').value = localAbbrev;
    document.getElementById('tmFormOpenmrsTestName').value = openmrsTestName || '';
    document.getElementById('tmFormOpenmrsShort').value = openmrsShort || '';
    document.getElementById('tmFormOpenmrsSample').value = openmrsSample || '';
    document.getElementById('tmFormLocation').value = locationId;
    document.getElementById('tmFormSubmitBtn').textContent = 'Update Test';
    document.getElementById('tmFormOverlay').style.display = 'flex';
}

function tmSyncOpenmrs() {
    if (!confirm('Sync OpenMRS Test Names, Short Names and Sample Categories for all tests now?')) return;
    var btn = event.target;
    var origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Syncing...';
    fetch('/backup-api/harmonization/sync-openmrs-test-info', { method: 'POST' })
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(data) {
            alert('Successfully synced ' + (data.updated_count || 'all') + ' tests from OpenMRS!');
            location.reload();
        })
        .catch(function(err) {
            alert('Sync completed: ' + err.message);
            location.reload();
        });
}

function tmCloseForm() {
    document.getElementById('tmFormOverlay').style.display = 'none';
}

function addCurrentFilters(f) {
    if (document.getElementById('tmFilterSection')) addHiddenField(f, 'filterSection', document.getElementById('tmFilterSection').value);
    if (document.getElementById('tmFilterActive')) addHiddenField(f, 'filterActive', document.getElementById('tmFilterActive').value);
    if (document.getElementById('tmFilterReportable')) addHiddenField(f, 'filterReportable', document.getElementById('tmFilterReportable').value);
    if (document.getElementById('tmFilterReferredOut')) addHiddenField(f, 'filterReferredOut', document.getElementById('tmFilterReferredOut').value);
    if (document.getElementById('tmFilterSampleCategory')) addHiddenField(f, 'filterSampleCategory', document.getElementById('tmFilterSampleCategory').value);
    if (document.getElementById('tmFilterShortName')) addHiddenField(f, 'filterShortName', document.getElementById('tmFilterShortName').value);
    if (document.getElementById('tmFilterLocation')) addHiddenField(f, 'filterLocation', document.getElementById('tmFilterLocation').value);
    if (document.getElementById('tmPageSize')) addHiddenField(f, 'pageSize', document.getElementById('tmPageSize').value);
    if (document.getElementById('tmSearchField')) addHiddenField(f, 'searchField', document.getElementById('tmSearchField').value);
    if (document.getElementById('tmSearchName')) addHiddenField(f, 'searchName', document.getElementById('tmSearchName').value);
    addHiddenField(f, 'sortBy', '<%= sortBy %>');
    addHiddenField(f, 'sortDir', '<%= sortDir %>');
    addHiddenField(f, 'page', '<%= currentPage %>');
}

function tmDelete(id) {
    if (confirm('Are you sure you want to delete test #' + id + '?')) {
        var f = document.createElement('form');
        f.method = 'POST';
        f.action = 'TestMenuAdvanced.do';
        var a = document.createElement('input'); a.type='hidden'; a.name='action'; a.value='delete'; f.appendChild(a);
        var d = document.createElement('input'); d.type='hidden'; d.name='delId'; d.value=id; f.appendChild(d);
        addCurrentFilters(f);
        document.body.appendChild(f);
        f.submit();
    }
}

function tmToggleActive(id) {
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = 'TestMenuAdvanced.do';
    var a = document.createElement('input'); a.type='hidden'; a.name='action'; a.value='toggleactive'; f.appendChild(a);
    var d = document.createElement('input'); d.type='hidden'; d.name='toggleId'; d.value=id; f.appendChild(d);
    addCurrentFilters(f);
    document.body.appendChild(f);
    f.submit();
}

function tmBulkActivate() {
    var checked = document.querySelectorAll('.tm-checkbox:checked');
    if (checked.length === 0) {
        alert('No tests selected.');
        return;
    }
    if (!confirm('Activate ' + checked.length + ' selected test(s)?')) return;
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = 'TestMenuAdvanced.do';
    var a = document.createElement('input'); a.type='hidden'; a.name='action'; a.value='bulkactivate'; f.appendChild(a);
    checked.forEach(function(cb) {
        var inp = document.createElement('input'); inp.type='hidden'; inp.name='selectedIDs'; inp.value=cb.value;
        f.appendChild(inp);
    });
    addCurrentFilters(f);
    document.body.appendChild(f);
    f.submit();
}

function tmBulkDeactivate() {
    var checked = document.querySelectorAll('.tm-checkbox:checked');
    if (checked.length === 0) {
        alert('No tests selected.');
        return;
    }
    if (!confirm('Deactivate ' + checked.length + ' selected test(s)?')) return;
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = 'TestMenuAdvanced.do';
    var a = document.createElement('input'); a.type='hidden'; a.name='action'; a.value='bulkdeactivate'; f.appendChild(a);
    checked.forEach(function(cb) {
        var inp = document.createElement('input'); inp.type='hidden'; inp.name='selectedIDs'; inp.value=cb.value;
        f.appendChild(inp);
    });
    addCurrentFilters(f);
    document.body.appendChild(f);
    f.submit();
}

function tmBulkDelete() {
    var checked = document.querySelectorAll('.tm-checkbox:checked');
    if (checked.length === 0) {
        alert('No tests selected.');
        return;
    }
    if (!confirm('Delete ' + checked.length + ' selected test(s)?')) return;
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = 'TestMenuAdvanced.do';
    var a = document.createElement('input'); a.type='hidden'; a.name='action'; a.value='bulkdelete'; f.appendChild(a);
    checked.forEach(function(cb) {
        var inp = document.createElement('input'); inp.type='hidden'; inp.name='selectedIDs'; inp.value=cb.value;
        f.appendChild(inp);
    });
    addCurrentFilters(f);
    document.body.appendChild(f);
    f.submit();
}

function addHiddenField(form, name, value) {
    var inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = name;
    inp.value = value;
    form.appendChild(inp);
}
</script>
