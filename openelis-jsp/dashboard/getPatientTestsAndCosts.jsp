<%@ page language="java" contentType="application/json; charset=utf-8" import="java.util.*,java.sql.*,org.json.*,java.io.*"%><%
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);

    String action = request.getParameter("action");
    if (action == null) action = "getTestsAndCosts";

    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;

    try {
        Class.forName("org.postgresql.Driver");
        conn = DriverManager.getConnection("jdbc:postgresql://openelisdb:5432/clinlims", "clinlims", "clinlims");

        // =========================================================================
        // 1. ACTION: GET TESTS & COSTS FOR PATIENT / SAMPLE
        // =========================================================================
        if ("getTestsAndCosts".equals(action)) {
            String sampleIdStr = request.getParameter("sampleId");
            String patientIdStr = request.getParameter("patientId");
            if (sampleIdStr == null || sampleIdStr.trim().isEmpty()) {
                out.print("{\"success\":false,\"error\":\"sampleId is required\"}");
                return;
            }
            sampleIdStr = sampleIdStr.trim();
            long sampleId = 0;
            try {
                sampleId = Long.parseLong(sampleIdStr);
            } catch (Exception e) {
                out.print("{\"success\":false,\"error\":\"Invalid sampleId\"}");
                return;
            }

            // Resolve sample ID if sample_human.id was passed instead of sample.id
            long canonicalSampleId = sampleId;
            ps = conn.prepareStatement("SELECT id FROM clinlims.sample WHERE id = ?");
            ps.setLong(1, sampleId);
            rs = ps.executeQuery();
            if (!rs.next()) {
                if (rs != null) rs.close();
                if (ps != null) ps.close();
                ps = conn.prepareStatement("SELECT samp_id FROM clinlims.sample_human WHERE id = ?");
                ps.setLong(1, sampleId);
                rs = ps.executeQuery();
                if (rs.next()) {
                    canonicalSampleId = rs.getLong(1);
                }
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // Fetch Patient Info & Ordering Provider
            String patName = "";
            String patIdDisplay = "";
            String patGender = "";
            String patAge = "";
            String providerName = "";
            String encounterUuid = "";

            ps = conn.prepareStatement(
                "SELECT sh.patient_id, per.first_name, per.last_name, p.gender, p.birth_date, " +
                "       COALESCE(pi.identity_data, ''), COALESCE(pr_per.first_name || ' ' || pr_per.last_name, '') as doc_name " +
                "FROM clinlims.sample_human sh " +
                "JOIN clinlims.patient p ON sh.patient_id = p.id " +
                "JOIN clinlims.person per ON p.person_id = per.id " +
                "LEFT JOIN clinlims.patient_identity pi ON (p.id = pi.patient_id AND pi.identity_type_id = 2) " +
                "LEFT JOIN clinlims.provider pr ON sh.provider_id = pr.id " +
                "LEFT JOIN clinlims.person pr_per ON pr.person_id = pr_per.id " +
                "WHERE sh.samp_id = ? OR sh.id = ? ORDER BY sh.id DESC LIMIT 1"
            );
            ps.setLong(1, canonicalSampleId);
            ps.setLong(2, sampleId);
            rs = ps.executeQuery();
            if (rs.next()) {
                String fn = rs.getString(2);
                String ln = rs.getString(3);
                patName = (fn != null ? fn : "") + " " + (ln != null ? ln : "");
                patGender = rs.getString(4) != null ? rs.getString(4) : "";
                patIdDisplay = rs.getString(6) != null ? rs.getString(6) : "";
                providerName = rs.getString(7) != null ? rs.getString(7).trim() : "";
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            if (patName.trim().isEmpty() && patientIdStr != null && !patientIdStr.trim().isEmpty()) {
                ps = conn.prepareStatement(
                    "SELECT p.id, per.first_name, per.last_name, p.gender " +
                    "FROM clinlims.patient_identity pi " +
                    "JOIN clinlims.patient p ON pi.patient_id = p.id " +
                    "JOIN clinlims.person per ON p.person_id = per.id " +
                    "WHERE pi.identity_data = ? LIMIT 1"
                );
                ps.setString(1, patientIdStr.trim());
                rs = ps.executeQuery();
                if (rs.next()) {
                    String fn = rs.getString(2);
                    String ln = rs.getString(3);
                    patName = (fn != null ? fn : "") + " " + (ln != null ? ln : "");
                    patGender = rs.getString(4) != null ? rs.getString(4) : "";
                    patIdDisplay = patientIdStr.trim();
                }
                if (rs != null) rs.close();
                if (ps != null) ps.close();
            }

            if (providerName.isEmpty()) {
                providerName = "Ordering Physician";
            }

            // Fetch removal requests for this sample
            Map<String, JSONObject> removalRequestsMap = new HashMap<String, JSONObject>();
            ps = conn.prepareStatement(
                "SELECT id, test_id, panel_id, item_name, item_type, status, request_reason, requested_by, physician_name, physician_notes " +
                "FROM clinlims.lab_order_removal_request WHERE sample_id = ? OR sample_id = ?"
            );
            ps.setLong(1, canonicalSampleId);
            ps.setLong(2, sampleId);
            rs = ps.executeQuery();
            while (rs.next()) {
                JSONObject rr = new JSONObject();
                rr.put("id", rs.getInt("id"));
                rr.put("testId", rs.getLong("test_id"));
                rr.put("panelId", rs.getLong("panel_id"));
                rr.put("itemName", rs.getString("item_name"));
                rr.put("itemType", rs.getString("item_type"));
                rr.put("status", rs.getString("status"));
                rr.put("reason", rs.getString("request_reason"));
                rr.put("requestedBy", rs.getString("requested_by"));
                rr.put("physicianNotes", rs.getString("physician_notes"));
                
                String key = rs.getString("item_type") + "_" + (rs.getString("item_type").equals("PANEL") ? rs.getLong("panel_id") : rs.getLong("test_id"));
                removalRequestsMap.put(key, rr);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // Query all analyses, tests, panels, and sections for this sample
            String sqlTests = 
                "SELECT " +
                "    a.id as analysis_id, " +
                "    a.test_id, " +
                "    t.name as test_name, " +
                "    COALESCE(ts.name, 'General Laboratory') as dept_name, " +
                "    a.panel_id, " +
                "    COALESCE(p.name, '') as panel_name, " +
                "    COALESCE(tc_test.cost, 0.00) as test_cost, " +
                "    COALESCE(tc_panel.cost, 0.00) as panel_cost, " +
                "    COALESCE(a.status, '') as analysis_status " +
                "FROM clinlims.sample s " +
                "JOIN clinlims.sample_item si ON si.samp_id = s.id " +
                "JOIN clinlims.analysis a ON a.sampitem_id = si.id " +
                "JOIN clinlims.test t ON a.test_id = t.id " +
                "LEFT JOIN clinlims.test_section ts ON t.test_section_id = ts.id " +
                "LEFT JOIN clinlims.panel p ON a.panel_id = p.id " +
                "LEFT JOIN clinlims.test_cost tc_test ON (tc_test.item_type = 'TEST' AND (tc_test.item_id = t.id OR LOWER(tc_test.item_name) = LOWER(t.name))) " +
                "LEFT JOIN clinlims.test_cost tc_panel ON (tc_panel.item_type = 'PANEL' AND a.panel_id IS NOT NULL AND (tc_panel.item_id = a.panel_id OR LOWER(tc_panel.item_name) = LOWER(p.name))) " +
                "WHERE s.id = ? " +
                "ORDER BY dept_name, panel_name, test_name";

            ps = conn.prepareStatement(sqlTests);
            ps.setLong(1, canonicalSampleId);
            rs = ps.executeQuery();

            // Grouping: Department -> Panels / Standalone Tests
            // DeptMap: deptName -> { "panels": Map<panelName, PanelObj>, "standalone": List<TestObj> }
            Map<String, Map<String, Object>> deptMap = new LinkedHashMap<String, Map<String, Object>>();
            Set<Long> seenPanels = new HashSet<Long>();
            double totalPayable = 0.0;

            while (rs.next()) {
                long analysisId = rs.getLong("analysis_id");
                long testId = rs.getLong("test_id");
                String testName = rs.getString("test_name");
                String deptName = rs.getString("dept_name");
                long panelId = rs.getLong("panel_id");
                String panelName = rs.getString("panel_name");
                double testCost = rs.getDouble("test_cost");
                double panelCost = rs.getDouble("panel_cost");
                String aStatus = rs.getString("analysis_status");

                if (!deptMap.containsKey(deptName)) {
                    Map<String, Object> dData = new HashMap<String, Object>();
                    dData.put("panels", new LinkedHashMap<String, JSONObject>());
                    dData.put("standalone", new ArrayList<JSONObject>());
                    deptMap.put(deptName, dData);
                }

                Map<String, JSONObject> dPanels = (Map<String, JSONObject>) deptMap.get(deptName).get("panels");
                List<JSONObject> dStandalone = (List<JSONObject>) deptMap.get(deptName).get("standalone");

                // Check removal status for test
                String testRemovalKey = "TEST_" + testId;
                JSONObject tRemoval = removalRequestsMap.get(testRemovalKey);
                String tRemovalStatus = tRemoval != null ? tRemoval.getString("status") : "NONE";
                int tRemovalReqId = tRemoval != null ? tRemoval.getInt("id") : 0;
                String tRemovalReason = tRemoval != null ? tRemoval.getString("reason") : "";

                boolean isPanelItem = (panelId > 0 && !panelName.isEmpty());

                if (isPanelItem) {
                    // Check removal status for panel
                    String panelRemovalKey = "PANEL_" + panelId;
                    JSONObject pRemoval = removalRequestsMap.get(panelRemovalKey);
                    String pRemovalStatus = pRemoval != null ? pRemoval.getString("status") : "NONE";
                    int pRemovalReqId = pRemoval != null ? pRemoval.getInt("id") : 0;

                    JSONObject pObj = dPanels.get(panelName);
                    if (pObj == null) {
                        pObj = new JSONObject();
                        pObj.put("panelId", panelId);
                        pObj.put("panelName", panelName);
                        pObj.put("panelCost", panelCost > 0 ? panelCost : 0.0);
                        pObj.put("isPanelPriced", panelCost > 0);
                        pObj.put("removalStatus", pRemovalStatus);
                        pObj.put("removalRequestId", pRemovalReqId);
                        pObj.put("tests", new JSONArray());
                        dPanels.put(panelName, pObj);

                        // If panel itself has a price and is NOT removed, add to total
                        if (panelCost > 0 && !"APPROVED".equals(pRemovalStatus)) {
                            totalPayable += panelCost;
                        }
                    }

                    JSONObject childTest = new JSONObject();
                    childTest.put("analysisId", analysisId);
                    childTest.put("testId", testId);
                    childTest.put("testName", testName);
                    childTest.put("cost", testCost);
                    childTest.put("effectiveCost", panelCost > 0 ? 0.00 : testCost);
                    childTest.put("isIncludedInPanel", panelCost > 0);
                    childTest.put("removalStatus", tRemovalStatus);
                    childTest.put("removalRequestId", tRemovalReqId);
                    childTest.put("removalReason", tRemovalReason);

                    pObj.getJSONArray("tests").put(childTest);

                    // If panel has NO separate price (0.00), tests are charged individually
                    if (panelCost <= 0 && !"APPROVED".equals(tRemovalStatus) && !"APPROVED".equals(pRemovalStatus)) {
                        totalPayable += testCost;
                    }
                } else {
                    // Standalone test
                    JSONObject sTest = new JSONObject();
                    sTest.put("analysisId", analysisId);
                    sTest.put("testId", testId);
                    sTest.put("testName", testName);
                    sTest.put("cost", testCost);
                    sTest.put("effectiveCost", testCost);
                    sTest.put("isIncludedInPanel", false);
                    sTest.put("removalStatus", tRemovalStatus);
                    sTest.put("removalRequestId", tRemovalReqId);
                    sTest.put("removalReason", tRemovalReason);

                    dStandalone.add(sTest);

                    if (!"APPROVED".equals(tRemovalStatus)) {
                        totalPayable += testCost;
                    }
                }
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // Build panels and independentTests for Requirement 2
            // Global panels map: panelId -> { panelId, panelName, panelCost, isPanelPriced, removalStatus, removalRequestId, groups: Map<deptName, List<Test>> }
            Map<Long, JSONObject> globalPanelsMap = new LinkedHashMap<Long, JSONObject>();
            Map<Long, Map<String, List<JSONObject>>> panelGroupsMap = new LinkedHashMap<Long, Map<String, List<JSONObject>>>();
            Map<String, List<JSONObject>> globalIndependentMap = new LinkedHashMap<String, List<JSONObject>>();

            for (Map.Entry<String, Map<String, Object>> entry : deptMap.entrySet()) {
                String dName = entry.getKey();
                Map<String, JSONObject> pMap = (Map<String, JSONObject>) entry.getValue().get("panels");
                for (JSONObject pItem : pMap.values()) {
                    long pId = pItem.getLong("panelId");
                    if (!globalPanelsMap.containsKey(pId)) {
                        globalPanelsMap.put(pId, pItem);
                        panelGroupsMap.put(pId, new LinkedHashMap<String, List<JSONObject>>());
                    }
                    JSONArray tArr = pItem.optJSONArray("tests");
                    if (tArr != null) {
                        List<JSONObject> tList = panelGroupsMap.get(pId).get(dName);
                        if (tList == null) {
                            tList = new ArrayList<JSONObject>();
                            panelGroupsMap.get(pId).put(dName, tList);
                        }
                        for (int k = 0; k < tArr.length(); k++) {
                            tList.add(tArr.getJSONObject(k));
                        }
                    }
                }

                List<JSONObject> sList = (List<JSONObject>) entry.getValue().get("standalone");
                if (sList != null && !sList.isEmpty()) {
                    if (!globalIndependentMap.containsKey(dName)) {
                        globalIndependentMap.put(dName, new ArrayList<JSONObject>());
                    }
                    globalIndependentMap.get(dName).addAll(sList);
                }
            }

            JSONArray structuredPanels = new JSONArray();
            for (Map.Entry<Long, JSONObject> pEntry : globalPanelsMap.entrySet()) {
                long pId = pEntry.getKey();
                JSONObject pObj = pEntry.getValue();
                JSONArray labGroupsArr = new JSONArray();
                Map<String, List<JSONObject>> grps = panelGroupsMap.get(pId);
                if (grps != null) {
                    for (Map.Entry<String, List<JSONObject>> gEntry : grps.entrySet()) {
                        JSONObject gObj = new JSONObject();
                        gObj.put("groupName", gEntry.getKey());
                        JSONArray gTests = new JSONArray();
                        for (JSONObject tObj : gEntry.getValue()) {
                            gTests.put(tObj);
                        }
                        gObj.put("tests", gTests);
                        labGroupsArr.put(gObj);
                    }
                }
                pObj.put("labGroups", labGroupsArr);
                structuredPanels.put(pObj);
            }

            JSONArray structuredIndependents = new JSONArray();
            for (Map.Entry<String, List<JSONObject>> indEntry : globalIndependentMap.entrySet()) {
                JSONObject indGrp = new JSONObject();
                indGrp.put("groupName", indEntry.getKey());
                JSONArray indTests = new JSONArray();
                for (JSONObject tObj : indEntry.getValue()) {
                    indTests.put(tObj);
                }
                indGrp.put("tests", indTests);
                structuredIndependents.put(indGrp);
            }

            // Build departments array
            JSONArray deptsArray = new JSONArray();
            for (Map.Entry<String, Map<String, Object>> entry : deptMap.entrySet()) {
                JSONObject dObj = new JSONObject();
                dObj.put("name", entry.getKey());

                JSONArray panelsArray = new JSONArray();
                Map<String, JSONObject> pMap = (Map<String, JSONObject>) entry.getValue().get("panels");
                for (JSONObject pItem : pMap.values()) {
                    panelsArray.put(pItem);
                }
                dObj.put("panels", panelsArray);

                JSONArray standaloneArray = new JSONArray();
                List<JSONObject> sList = (List<JSONObject>) entry.getValue().get("standalone");
                for (JSONObject sItem : sList) {
                    standaloneArray.put(sItem);
                }
                dObj.put("standaloneTests", standaloneArray);

                deptsArray.put(dObj);
            }

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("sampleId", canonicalSampleId);
            resp.put("patientId", patIdDisplay.isEmpty() ? String.valueOf(patientIdStr) : patIdDisplay);
            resp.put("patientName", patName.trim().isEmpty() ? "Patient #" + patIdDisplay : patName.trim());
            resp.put("patientGender", patGender);
            resp.put("physicianName", providerName);
            resp.put("departments", deptsArray);
            resp.put("panels", structuredPanels);
            resp.put("independentTests", structuredIndependents);
            resp.put("totalPayableAmount", Math.round(totalPayable * 100.0) / 100.0);
            resp.put("currency", "ETB");

            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 2. ACTION: REQUEST TEST REMOVAL (LAB STAFF -> PHYSICIAN)
        // =========================================================================
        if ("requestRemoval".equals(action)) {
            String sampleIdStr = request.getParameter("sampleId");
            String patientIdStr = request.getParameter("patientId");
            String patientName = request.getParameter("patientName");
            String reason = request.getParameter("reason");
            String requestedBy = request.getParameter("requestedBy");
            String itemsJsonStr = request.getParameter("items"); // Array of { testId, panelId, itemName, itemType, cost }

            if (sampleIdStr == null || itemsJsonStr == null || reason == null || reason.trim().isEmpty()) {
                out.print("{\"success\":false,\"error\":\"sampleId, items, and reason are required.\"}");
                return;
            }

            long sampleId = Long.parseLong(sampleIdStr.trim());
            if (requestedBy == null || requestedBy.trim().isEmpty()) requestedBy = "Lab Staff";
            if (patientName == null) patientName = "";

            JSONArray items = new JSONArray(itemsJsonStr);
            List<Integer> createdRequestIds = new ArrayList<Integer>();
            StringBuilder chatSummary = new StringBuilder();
            chatSummary.append("Requested test removal for patient ").append(patientName).append(" (Reason: ").append(reason.trim()).append("):\n");

            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                long tId = it.optLong("testId", 0);
                long pId = it.optLong("panelId", 0);
                String iName = it.optString("itemName", "Test");
                String iType = it.optString("itemType", "TEST");
                double cost = it.optDouble("cost", 0.0);

                ps = conn.prepareStatement(
                    "INSERT INTO clinlims.lab_order_removal_request " +
                    "(sample_id, patient_identifier, patient_name, test_id, panel_id, item_name, item_type, original_cost, requested_by, request_reason, status) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING') RETURNING id"
                );
                ps.setLong(1, sampleId);
                ps.setString(2, patientIdStr != null ? patientIdStr : "");
                ps.setString(3, patientName);
                if (tId > 0) ps.setLong(4, tId); else ps.setNull(4, java.sql.Types.NUMERIC);
                if (pId > 0) ps.setLong(5, pId); else ps.setNull(5, java.sql.Types.NUMERIC);
                ps.setString(6, iName);
                ps.setString(7, iType);
                ps.setDouble(8, cost);
                ps.setString(9, requestedBy);
                ps.setString(10, reason.trim());

                rs = ps.executeQuery();
                int reqId = 0;
                if (rs.next()) {
                    reqId = rs.getInt(1);
                    createdRequestIds.add(reqId);
                }
                if (rs != null) rs.close();
                if (ps != null) ps.close();

                chatSummary.append("• ").append(iName).append(" (").append(String.format("%.2f", cost)).append(" ETB)\n");

                // Post individual removal request event to Chat
                ps = conn.prepareStatement(
                    "INSERT INTO clinlims.lab_physician_chat " +
                    "(sample_id, patient_identifier, patient_name, sender_username, sender_role, message_text, message_type, removal_request_id, is_read_by_physician, is_read_by_lab) " +
                    "VALUES (?, ?, ?, ?, 'LAB_STAFF', ?, 'REMOVAL_REQUEST', ?, FALSE, TRUE)"
                );
                ps.setLong(1, sampleId);
                ps.setString(2, patientIdStr != null ? patientIdStr : "");
                ps.setString(3, patientName);
                ps.setString(4, requestedBy);
                ps.setString(5, "Test Removal Request: " + iName + " (" + String.format("%.2f", cost) + " ETB) - Reason: " + reason.trim());
                ps.setInt(6, reqId);
                ps.executeUpdate();
                if (ps != null) ps.close();
            }

            out.print("{\"success\":true,\"requestIds\":" + createdRequestIds.toString() + ",\"count\":" + createdRequestIds.size() + "}");
            return;
        }

        // =========================================================================
        // 3. ACTION: APPROVE / REJECT TEST REMOVAL (PHYSICIAN ACTION)
        // =========================================================================
        if ("approveRemoval".equals(action) || "rejectRemoval".equals(action)) {
            String requestIdStr = request.getParameter("requestId");
            String physicianName = request.getParameter("physicianName");
            String notes = request.getParameter("notes");
            if (requestIdStr == null) {
                out.print("{\"success\":false,\"error\":\"requestId is required\"}");
                return;
            }
            int reqId = Integer.parseInt(requestIdStr.trim());
            if (physicianName == null || physicianName.trim().isEmpty()) physicianName = "Physician";
            if (notes == null) notes = "";

            boolean isApprove = "approveRemoval".equals(action);
            String newStatus = isApprove ? "APPROVED" : "REJECTED";

            // Get request details
            long sampleId = 0;
            String patRef = "";
            String patName = "";
            long testId = 0;
            long panelId = 0;
            String itemName = "";
            String itemType = "";

            ps = conn.prepareStatement("SELECT sample_id, patient_identifier, patient_name, test_id, panel_id, item_name, item_type FROM clinlims.lab_order_removal_request WHERE id = ?");
            ps.setInt(1, reqId);
            rs = ps.executeQuery();
            if (rs.next()) {
                sampleId = rs.getLong(1);
                patRef = rs.getString(2);
                patName = rs.getString(3);
                testId = rs.getLong(4);
                panelId = rs.getLong(5);
                itemName = rs.getString(6);
                itemType = rs.getString(7);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // Update request status
            ps = conn.prepareStatement(
                "UPDATE clinlims.lab_order_removal_request " +
                "SET status = ?, physician_name = ?, physician_action_date = CURRENT_TIMESTAMP, physician_notes = ?, updated_at = CURRENT_TIMESTAMP " +
                "WHERE id = ?"
            );
            ps.setString(1, newStatus);
            ps.setString(2, physicianName);
            ps.setString(3, notes.trim());
            ps.setInt(4, reqId);
            ps.executeUpdate();
            if (ps != null) ps.close();

            // If APPROVED, cancel/void test in OpenELIS analysis so it is removed from active workflow
            if (isApprove) {
                if ("PANEL".equals(itemType) && panelId > 0) {
                    ps = conn.prepareStatement("UPDATE clinlims.analysis SET status = 'X' WHERE panel_id = ? AND sampitem_id IN (SELECT id FROM clinlims.sample_item WHERE samp_id = ?)");
                    ps.setLong(1, panelId);
                    ps.setLong(2, sampleId);
                    ps.executeUpdate();
                    if (ps != null) ps.close();
                } else if (testId > 0) {
                    ps = conn.prepareStatement("UPDATE clinlims.analysis SET status = 'X' WHERE test_id = ? AND sampitem_id IN (SELECT id FROM clinlims.sample_item WHERE samp_id = ?)");
                    ps.setLong(1, testId);
                    ps.setLong(2, sampleId);
                    ps.executeUpdate();
                    if (ps != null) ps.close();
                }

                // Synchronize revised payable amount and active tests to Odoo
                try {
                    final List<String> activeTestNames = new ArrayList<String>();
                    ps = conn.prepareStatement(
                        "SELECT DISTINCT t.name FROM clinlims.sample s " +
                        "JOIN clinlims.sample_item si ON si.samp_id = s.id " +
                        "JOIN clinlims.analysis a ON a.sampitem_id = si.id " +
                        "JOIN clinlims.test t ON a.test_id = t.id " +
                        "WHERE s.id = ? AND (a.status IS NULL OR a.status != 'X')"
                    );
                    ps.setLong(1, sampleId);
                    rs = ps.executeQuery();
                    while (rs.next()) {
                        String tn = rs.getString(1);
                        if (tn != null && !tn.trim().isEmpty()) activeTestNames.add(tn.trim());
                    }
                    if (rs != null) rs.close();
                    if (ps != null) ps.close();

                    String sUuid = "";
                    ps = conn.prepareStatement("SELECT uuid FROM clinlims.sample WHERE id = ?");
                    ps.setLong(1, sampleId);
                    rs = ps.executeQuery();
                    if (rs.next()) sUuid = rs.getString(1);
                    if (rs != null) rs.close();
                    if (ps != null) ps.close();

                    final String finalPatRef = patRef;
                    final String finalSampleUuid = sUuid != null ? sUuid : "";
                    new Thread(new Runnable() {
                        public void run() {
                            try {
                                StringBuilder py = new StringBuilder();
                                py.append("import socket, xmlrpclib\n");
                                py.append("socket.setdefaulttimeout(4.0)\n");
                                py.append("try:\n");
                                py.append("    common = xmlrpclib.ServerProxy('http://odoo:8069/xmlrpc/2/common')\n");
                                py.append("    uid = common.authenticate('odoo', 'emrsync', 'Admin123', {})\n");
                                py.append("    pwd = 'Admin123'\n");
                                py.append("    if not uid:\n");
                                py.append("        uid = common.authenticate('odoo', 'admin', 'admin', {})\n");
                                py.append("        pwd = 'admin'\n");
                                py.append("    if uid:\n");
                                py.append("        models = xmlrpclib.ServerProxy('http://odoo:8069/xmlrpc/2/object')\n");
                                py.append("        models.execute_kw('odoo', uid, pwd, 'api.event.worker', 'process_event', [{\n");
                                py.append("            'category': 'add.available.lab.tests',\n");
                                py.append("            'patientId': '").append(finalPatRef.replace("'", "\\'")).append("',\n");
                                py.append("            'orderUuid': '").append(finalSampleUuid.replace("'", "\\'")).append("',\n");
                                py.append("            'availableTestNames': [");
                                for (int k = 0; k < activeTestNames.size(); k++) {
                                    if (k > 0) py.append(",");
                                    py.append("'").append(activeTestNames.get(k).replace("'", "\\'")).append("'");
                                }
                                py.append("]\n");
                                py.append("        }])\n");
                                py.append("except Exception:\n");
                                py.append("    pass\n");
                                ProcessBuilder pb = new ProcessBuilder("python", "-c", py.toString());
                                Process proc = pb.start();
                                proc.waitFor();
                            } catch (Exception ignore) {}
                        }
                    }).start();
                } catch (Exception ignore) {}
            }

            // Post action to Chat
            String msgText = isApprove ? 
                ("✔ APPROVED Removal of " + itemName + " by " + physicianName + (notes.trim().isEmpty() ? "" : ": " + notes.trim())) :
                ("✖ REJECTED Removal of " + itemName + " by " + physicianName + (notes.trim().isEmpty() ? "" : ": " + notes.trim()));

            ps = conn.prepareStatement(
                "INSERT INTO clinlims.lab_physician_chat " +
                "(sample_id, patient_identifier, patient_name, sender_username, sender_role, message_text, message_type, removal_request_id, is_read_by_physician, is_read_by_lab) " +
                "VALUES (?, ?, ?, ?, 'PHYSICIAN', ?, ?, ?, TRUE, FALSE)"
            );
            ps.setLong(1, sampleId);
            ps.setString(2, patRef);
            ps.setString(3, patName);
            ps.setString(4, physicianName);
            ps.setString(5, msgText);
            ps.setString(6, isApprove ? "APPROVAL" : "REJECTION");
            ps.setInt(7, reqId);
            ps.executeUpdate();
            if (ps != null) ps.close();

            out.print("{\"success\":true,\"status\":\"" + newStatus + "\",\"requestId\":" + reqId + "}");
            return;
        }

        // =========================================================================
        // 4. ACTION: GET CHAT MESSAGES
        // =========================================================================
        if ("getChatMessages".equals(action)) {
            String sampleIdStr = request.getParameter("sampleId");
            if (sampleIdStr == null || sampleIdStr.trim().isEmpty()) {
                out.print("{\"success\":false,\"error\":\"sampleId is required\"}");
                return;
            }
            long sampleId = Long.parseLong(sampleIdStr.trim());

            // Mark as read by lab
            ps = conn.prepareStatement("UPDATE clinlims.lab_physician_chat SET is_read_by_lab = TRUE WHERE sample_id = ?");
            ps.setLong(1, sampleId);
            ps.executeUpdate();
            if (ps != null) ps.close();

            ps = conn.prepareStatement(
                "SELECT c.id, c.sender_username, c.sender_role, c.message_text, c.message_type, c.removal_request_id, " +
                "       c.created_at, r.status as req_status, r.item_name, r.original_cost, r.request_reason " +
                "FROM clinlims.lab_physician_chat c " +
                "LEFT JOIN clinlims.lab_order_removal_request r ON c.removal_request_id = r.id " +
                "WHERE c.sample_id = ? " +
                "ORDER BY c.created_at ASC"
            );
            ps.setLong(1, sampleId);
            rs = ps.executeQuery();

            JSONArray msgs = new JSONArray();
            while (rs.next()) {
                JSONObject m = new JSONObject();
                m.put("id", rs.getInt("id"));
                m.put("sender", rs.getString("sender_username"));
                m.put("role", rs.getString("sender_role"));
                m.put("text", rs.getString("message_text"));
                m.put("type", rs.getString("message_type"));
                m.put("removalRequestId", rs.getInt("removal_request_id"));
                m.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                if (rs.getInt("removal_request_id") > 0) {
                    m.put("requestStatus", rs.getString("req_status"));
                    m.put("itemName", rs.getString("item_name"));
                    m.put("cost", rs.getDouble("original_cost"));
                    m.put("reason", rs.getString("request_reason"));
                }
                msgs.put(m);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("messages", msgs);
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 5. ACTION: SEND CHAT MESSAGE
        // =========================================================================
        if ("sendChatMessage".equals(action)) {
            String sampleIdStr = request.getParameter("sampleId");
            String patientIdStr = request.getParameter("patientId");
            String patientName = request.getParameter("patientName");
            String sender = request.getParameter("sender");
            String role = request.getParameter("role");
            String text = request.getParameter("text");

            if (sampleIdStr == null || text == null || text.trim().isEmpty()) {
                out.print("{\"success\":false,\"error\":\"sampleId and text are required.\"}");
                return;
            }
            long sampleId = Long.parseLong(sampleIdStr.trim());
            if (sender == null || sender.trim().isEmpty()) sender = "Lab Staff";
            if (role == null || role.trim().isEmpty()) role = "LAB_STAFF";
            if (patientName == null) patientName = "";

            ps = conn.prepareStatement(
                "INSERT INTO clinlims.lab_physician_chat " +
                "(sample_id, patient_identifier, patient_name, sender_username, sender_role, message_text, message_type, is_read_by_physician, is_read_by_lab) " +
                "VALUES (?, ?, ?, ?, ?, ?, 'TEXT', FALSE, TRUE)"
            );
            ps.setLong(1, sampleId);
            ps.setString(2, patientIdStr != null ? patientIdStr : "");
            ps.setString(3, patientName);
            ps.setString(4, sender.trim());
            ps.setString(5, role.trim());
            ps.setString(6, text.trim());
            ps.executeUpdate();
            if (ps != null) ps.close();

            out.print("{\"success\":true}");
            return;
        }

        // =========================================================================
        // 6. ACTION: CHECK NOTIFICATIONS (UNREAD MESSAGES & PENDING REMOVALS)
        // =========================================================================
        if ("checkNotifications".equals(action)) {
            String sampleIdsParam = request.getParameter("sampleIds");
            JSONObject counts = new JSONObject();

            if (sampleIdsParam != null && !sampleIdsParam.trim().isEmpty()) {
                String[] sIds = sampleIdsParam.split(",");
                for (String sid : sIds) {
                    sid = sid.trim();
                    if (sid.isEmpty()) continue;
                    try {
                        long sIdNum = Long.parseLong(sid);
                        ps = conn.prepareStatement(
                            "SELECT " +
                            "  COUNT(CASE WHEN is_read_by_lab = FALSE THEN 1 END) as unread_chat, " +
                            "  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_removals " +
                            "FROM clinlims.lab_physician_chat c " +
                            "FULL OUTER JOIN clinlims.lab_order_removal_request r ON c.sample_id = r.sample_id " +
                            "WHERE c.sample_id = ? OR r.sample_id = ?"
                        );
                        ps.setLong(1, sIdNum);
                        ps.setLong(2, sIdNum);
                        rs = ps.executeQuery();
                        if (rs.next()) {
                            JSONObject cObj = new JSONObject();
                            cObj.put("unreadChat", rs.getInt("unread_chat"));
                            cObj.put("pendingRemovals", rs.getInt("pending_removals"));
                            counts.put(sid, cObj);
                        }
                        if (rs != null) rs.close();
                        if (ps != null) ps.close();
                    } catch (Exception ignore) {}
                }
            }

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("counts", counts);
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 7. ACTION: GET PHYSICIAN INBOX & NOTIFICATIONS
        // =========================================================================
        if ("getPhysicianInbox".equals(action)) {
            String patIdentifier = request.getParameter("patientId");
            String doctorName = request.getParameter("physicianName");

            JSONArray pendingRequests = new JSONArray();
            JSONArray recentMessages = new JSONArray();
            int unreadCount = 0;

            // 1. Pending removal requests
            String sqlPending = 
                "SELECT r.id, r.sample_id, r.patient_identifier, r.patient_name, r.test_id, r.panel_id, " +
                "       r.item_name, r.item_type, r.original_cost, r.requested_by, r.request_reason, r.status, r.created_at " +
                "FROM clinlims.lab_order_removal_request r " +
                "WHERE r.status = 'PENDING' ";
            if (patIdentifier != null && !patIdentifier.trim().isEmpty()) {
                sqlPending += "AND r.patient_identifier = ? ";
            }
            sqlPending += "ORDER BY r.created_at DESC LIMIT 50";

            ps = conn.prepareStatement(sqlPending);
            if (patIdentifier != null && !patIdentifier.trim().isEmpty()) {
                ps.setString(1, patIdentifier.trim());
            }
            rs = ps.executeQuery();
            while (rs.next()) {
                JSONObject pr = new JSONObject();
                pr.put("requestId", rs.getInt("id"));
                pr.put("sampleId", rs.getLong("sample_id"));
                pr.put("patientId", rs.getString("patient_identifier"));
                pr.put("patientName", rs.getString("patient_name"));
                pr.put("itemName", rs.getString("item_name"));
                pr.put("itemType", rs.getString("item_type"));
                pr.put("cost", rs.getDouble("original_cost"));
                pr.put("requestedBy", rs.getString("requested_by"));
                pr.put("reason", rs.getString("request_reason"));
                pr.put("status", rs.getString("status"));
                pr.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                pendingRequests.put(pr);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            // 2. Chat messages
            String sqlChat = 
                "SELECT c.id, c.sample_id, c.patient_identifier, c.patient_name, c.sender_username, " +
                "       c.sender_role, c.message_text, c.message_type, c.removal_request_id, c.is_read_by_physician, c.created_at " +
                "FROM clinlims.lab_physician_chat c ";
            if (patIdentifier != null && !patIdentifier.trim().isEmpty()) {
                sqlChat += "WHERE c.patient_identifier = ? ";
            }
            sqlChat += "ORDER BY c.created_at DESC LIMIT 50";

            ps = conn.prepareStatement(sqlChat);
            if (patIdentifier != null && !patIdentifier.trim().isEmpty()) {
                ps.setString(1, patIdentifier.trim());
            }
            rs = ps.executeQuery();
            while (rs.next()) {
                JSONObject msg = new JSONObject();
                msg.put("id", rs.getInt("id"));
                msg.put("sampleId", rs.getLong("sample_id"));
                msg.put("patientId", rs.getString("patient_identifier"));
                msg.put("patientName", rs.getString("patient_name"));
                msg.put("sender", rs.getString("sender_username"));
                msg.put("role", rs.getString("sender_role"));
                msg.put("text", rs.getString("message_text"));
                msg.put("type", rs.getString("message_type"));
                msg.put("isRead", rs.getBoolean("is_read_by_physician"));
                msg.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toString() : "");
                if (!rs.getBoolean("is_read_by_physician") && "LAB_STAFF".equalsIgnoreCase(rs.getString("sender_role"))) {
                    unreadCount++;
                }
                recentMessages.put(msg);
            }
            if (rs != null) rs.close();
            if (ps != null) ps.close();

            JSONObject resp = new JSONObject();
            resp.put("success", true);
            resp.put("unreadCount", unreadCount + pendingRequests.length());
            resp.put("pendingRequestsCount", pendingRequests.length());
            resp.put("pendingRequests", pendingRequests);
            resp.put("messages", recentMessages);
            out.print(resp.toString());
            return;
        }

        // =========================================================================
        // 8. ACTION: MARK MESSAGES AS READ BY PHYSICIAN
        // =========================================================================
        if ("markPhysicianRead".equals(action)) {
            String sampleIdStr = request.getParameter("sampleId");
            String patIdentifier = request.getParameter("patientId");
            if (sampleIdStr != null && !sampleIdStr.trim().isEmpty()) {
                ps = conn.prepareStatement("UPDATE clinlims.lab_physician_chat SET is_read_by_physician = TRUE WHERE sample_id = ?");
                ps.setLong(1, Long.parseLong(sampleIdStr.trim()));
                ps.executeUpdate();
                if (ps != null) ps.close();
            } else if (patIdentifier != null && !patIdentifier.trim().isEmpty()) {
                ps = conn.prepareStatement("UPDATE clinlims.lab_physician_chat SET is_read_by_physician = TRUE WHERE patient_identifier = ?");
                ps.setString(1, patIdentifier.trim());
                ps.executeUpdate();
                if (ps != null) ps.close();
            }
            out.print("{\"success\":true}");
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
