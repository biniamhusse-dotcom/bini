<%@ page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8"
    import="java.sql.*, java.util.*, java.io.*, java.net.*,
            org.json.*"%>
<%
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);

    String action = request.getParameter("action");
    if (action == null) action = "getStatus";

    JSONObject outJson = new JSONObject();
    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;

    try {
        Class.forName("org.postgresql.Driver");
        conn = DriverManager.getConnection("jdbc:postgresql://openelisdb:5432/clinlims", "clinlims", "clinlims");

        // -------------------------------------------------------------
        // 1. GET STATUS: Markers, Trigger status, unmapped tests, stats
        // -------------------------------------------------------------
        if ("getStatus".equals(action)) {
            // Markers
            JSONArray markers = new JSONArray();
            ps = conn.prepareStatement("SELECT id, feed_uri, feed_uri_for_last_read_entry, last_read_entry_id FROM clinlims.markers ORDER BY id");
            rs = ps.executeQuery();
            while (rs.next()) {
                JSONObject m = new JSONObject();
                m.put("id", rs.getInt("id"));
                m.put("feed_uri", rs.getString("feed_uri"));
                m.put("last_entry_uri", rs.getString("feed_uri_for_last_read_entry"));
                m.put("last_entry_id", rs.getString("last_read_entry_id"));
                markers.put(m);
            }
            rs.close();
            ps.close();
            outJson.put("markers", markers);

            // Unmapped tests count
            ps = conn.prepareStatement("SELECT count(*) FROM clinlims.test t WHERE NOT EXISTS (SELECT 1 FROM clinlims.sampletype_test st WHERE st.test_id = t.id)");
            rs = ps.executeQuery();
            int unmappedCount = rs.next() ? rs.getInt(1) : 0;
            rs.close();
            ps.close();
            outJson.put("unmappedTests", unmappedCount);

            // Failed events count
            ps = conn.prepareStatement("SELECT count(*) FROM clinlims.failed_events");
            rs = ps.executeQuery();
            int failedCount = rs.next() ? rs.getInt(1) : 0;
            rs.close();
            ps.close();
            outJson.put("failedEventsCount", failedCount);

            // Check triggers active
            ps = conn.prepareStatement("SELECT count(*) FROM information_schema.triggers WHERE trigger_name IN ('trg_ensure_sampletype_test', 'trg_ensure_panel_item_sampletype')");
            rs = ps.executeQuery();
            int triggersActive = rs.next() ? rs.getInt(1) : 0;
            rs.close();
            ps.close();
            outJson.put("triggersActive", triggersActive == 2);

            // Today's samples count
            ps = conn.prepareStatement("SELECT count(*) FROM clinlims.sample WHERE entered_date >= CURRENT_DATE");
            rs = ps.executeQuery();
            int todaySamples = rs.next() ? rs.getInt(1) : 0;
            rs.close();
            ps.close();
            outJson.put("todaySamples", todaySamples);

            outJson.put("success", true);
        }

        // -------------------------------------------------------------
        // 2. AUTO-FIX MISSING SAMPLE TYPES
        // -------------------------------------------------------------
        else if ("autoFixSampleTypes".equals(action)) {
            String backfillSql = 
                "INSERT INTO clinlims.sampletype_test (id, test_id, sample_type_id, is_panel) " +
                "SELECT nextval('clinlims.sample_type_test_seq'), t.id, " +
                "       COALESCE((SELECT sp.sample_type_id FROM clinlims.panel_item pi JOIN clinlims.sampletype_panel sp ON pi.panel_id = sp.panel_id WHERE pi.test_id = t.id LIMIT 1), 341), " +
                "       false " +
                "FROM clinlims.test t " +
                "WHERE NOT EXISTS (SELECT 1 FROM clinlims.sampletype_test st WHERE st.test_id = t.id)";
            ps = conn.prepareStatement(backfillSql);
            int rowsInserted = ps.executeUpdate();
            ps.close();

            outJson.put("success", true);
            outJson.put("rowsInserted", rowsInserted);
            outJson.put("message", "Successfully mapped " + rowsInserted + " test(s) to sample types.");
        }

        // -------------------------------------------------------------
        // 3. REWIND MARKER
        // -------------------------------------------------------------
        else if ("rewindMarker".equals(action)) {
            String feedType = request.getParameter("feedType"); // encounter or patient
            if (feedType == null || feedType.trim().isEmpty()) feedType = "encounter";

            String customEntryId = request.getParameter("entryId");
            if (customEntryId != null && !customEntryId.trim().isEmpty()) {
                ps = conn.prepareStatement("UPDATE clinlims.markers SET last_read_entry_id = ? WHERE feed_uri LIKE ?");
                ps.setString(1, customEntryId.trim());
                ps.setString(2, "%" + feedType + "%");
                int updated = ps.executeUpdate();
                ps.close();
                outJson.put("success", true);
                outJson.put("updated", updated);
                outJson.put("message", "Encounter feed marker rewound to entry: " + customEntryId);
            } else {
                // Fetch recent entries from OpenMRS AtomFeed to find an earlier entry
                URL feedUrl = new URL("http://openmrs:8080/openmrs/ws/atomfeed/" + feedType + "/recent");
                HttpURLConnection hconn = (HttpURLConnection) feedUrl.openConnection();
                hconn.setRequestMethod("GET");
                hconn.setConnectTimeout(5000);
                hconn.setReadTimeout(5000);
                BufferedReader in = new BufferedReader(new InputStreamReader(hconn.getInputStream()));
                String inputLine;
                List<String> entryIds = new ArrayList<String>();
                while ((inputLine = in.readLine()) != null) {
                    if (inputLine.contains("<id>tag:atomfeed.ict4h.org:")) {
                        int s = inputLine.indexOf("<id>") + 4;
                        int e = inputLine.indexOf("</id>");
                        if (s > 3 && e > s) {
                            entryIds.add(inputLine.substring(s, e));
                        }
                    }
                }
                in.close();

                if (entryIds.size() > 2) {
                    // Rewind to the earliest entry on the recent page or 5th earlier entry
                    String targetEntry = entryIds.get(entryIds.size() - 1);
                    ps = conn.prepareStatement("UPDATE clinlims.markers SET last_read_entry_id = ? WHERE feed_uri LIKE ?");
                    ps.setString(1, targetEntry);
                    ps.setString(2, "%" + feedType + "%");
                    int updated = ps.executeUpdate();
                    ps.close();
                    outJson.put("success", true);
                    outJson.put("updated", updated);
                    outJson.put("message", "Feed marker rewound to earlier entry: " + targetEntry);
                } else {
                    outJson.put("success", false);
                    outJson.put("message", "Could not determine earlier entry from recent feed page.");
                }
            }
        }

        // -------------------------------------------------------------
        // 4. GET RECENT SAMPLES (LAST 25)
        // -------------------------------------------------------------
        else if ("getRecentSamples".equals(action)) {
            String sql = 
                "SELECT s.id as sample_id, s.accession_number, s.entered_date, " +
                "       COALESCE(pi.identity_data, p.national_id, '') as patient_id, " +
                "       COALESCE(per.first_name, '') as first_name, COALESCE(per.last_name, '') as last_name, " +
                "       string_agg(DISTINCT COALESCE(pan.name, t.name), ', ') as test_names, " +
                "       count(a.id) as total_tests " +
                "FROM clinlims.sample s " +
                "LEFT JOIN clinlims.sample_human sh ON sh.samp_id = s.id " +
                "LEFT JOIN clinlims.patient p ON sh.patient_id = p.id " +
                "LEFT JOIN clinlims.person per ON p.person_id = per.id " +
                "LEFT JOIN clinlims.patient_identity pi ON pi.patient_id = p.id " +
                "LEFT JOIN clinlims.sample_item si ON si.samp_id = s.id " +
                "LEFT JOIN clinlims.analysis a ON a.sampitem_id = si.id " +
                "LEFT JOIN clinlims.test t ON a.test_id = t.id " +
                "LEFT JOIN clinlims.panel pan ON a.panel_id = pan.id " +
                "GROUP BY s.id, s.accession_number, s.entered_date, pi.identity_data, p.national_id, per.first_name, per.last_name " +
                "ORDER BY s.id DESC LIMIT 25";
            ps = conn.prepareStatement(sql);
            rs = ps.executeQuery();
            JSONArray samples = new JSONArray();
            while (rs.next()) {
                JSONObject s = new JSONObject();
                s.put("sampleId", rs.getString("sample_id"));
                s.put("accessionNumber", rs.getString("accession_number") != null ? rs.getString("accession_number") : "-");
                s.put("enteredDate", rs.getString("entered_date"));
                s.put("patientId", rs.getString("patient_id"));
                s.put("patientName", (rs.getString("first_name") + " " + rs.getString("last_name")).trim());
                s.put("testNames", rs.getString("test_names") != null ? rs.getString("test_names") : "None");
                s.put("totalTests", rs.getInt("total_tests"));
                samples.put(s);
            }
            rs.close();
            ps.close();
            outJson.put("samples", samples);
            outJson.put("success", true);
        }

        // -------------------------------------------------------------
        // 5. GET FAILED EVENTS & AUDIT
        // -------------------------------------------------------------
        else if ("getFailedEvents".equals(action)) {
            ps = conn.prepareStatement("SELECT id, feed_uri, error_message, event_id, failed_at, retries, title FROM clinlims.failed_events ORDER BY id DESC LIMIT 50");
            rs = ps.executeQuery();
            JSONArray failedEvents = new JSONArray();
            while (rs.next()) {
                JSONObject fe = new JSONObject();
                fe.put("id", rs.getInt("id"));
                fe.put("feed_uri", rs.getString("feed_uri"));
                fe.put("error_message", rs.getString("error_message"));
                fe.put("event_id", rs.getString("event_id"));
                fe.put("failed_at", rs.getString("failed_at"));
                fe.put("retries", rs.getInt("retries"));
                fe.put("title", rs.getString("title"));
                failedEvents.put(fe);
            }
            rs.close();
            ps.close();
            outJson.put("failedEvents", failedEvents);
            outJson.put("success", true);
        }

        // -------------------------------------------------------------
        // 6. CLEAR FAILED EVENTS
        // -------------------------------------------------------------
        else if ("clearFailedEvents".equals(action)) {
            ps = conn.prepareStatement("DELETE FROM clinlims.failed_events");
            int deleted = ps.executeUpdate();
            ps.close();
            outJson.put("success", true);
            outJson.put("deleted", deleted);
            outJson.put("message", "Cleared " + deleted + " failed event record(s). Feed worker will retry.");
        }

        // -------------------------------------------------------------
        // 7. FORCE SYNC / CHECK PATIENT ORDERS FROM OPENMRS
        // -------------------------------------------------------------
        else if ("checkPatientOrders".equals(action)) {
            String patientId = request.getParameter("patientId");
            if (patientId == null || patientId.trim().isEmpty()) {
                outJson.put("success", false);
                outJson.put("message", "Patient ID required.");
            } else {
                patientId = patientId.trim();
                // 1. Query OpenMRS REST API for patient
                URL pUrl = new URL("http://openmrs:8080/openmrs/ws/rest/v1/patient?q=" + URLEncoder.encode(patientId, "UTF-8"));
                HttpURLConnection pConn = (HttpURLConnection) pUrl.openConnection();
                pConn.setRequestProperty("Authorization", "Basic " + Base64.getEncoder().encodeToString("admin:Admin123".getBytes()));
                pConn.setConnectTimeout(5000);
                pConn.setReadTimeout(5000);
                BufferedReader in = new BufferedReader(new InputStreamReader(pConn.getInputStream()));
                StringBuilder pResponse = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) pResponse.append(line);
                in.close();

                JSONObject pData = new JSONObject(pResponse.toString());
                JSONArray results = pData.optJSONArray("results");
                if (results == null || results.length() == 0) {
                    outJson.put("success", false);
                    outJson.put("message", "Patient '" + patientId + "' not found in OpenMRS.");
                } else {
                    JSONObject patientObj = results.getJSONObject(0);
                    String pUuid = patientObj.getString("uuid");
                    String pDisplay = patientObj.optString("display", patientId);

                    // 2. Query OpenMRS for orders
                    URL oUrl = new URL("http://openmrs:8080/openmrs/ws/rest/v1/order?patient=" + pUuid);
                    HttpURLConnection oConn = (HttpURLConnection) oUrl.openConnection();
                    oConn.setRequestProperty("Authorization", "Basic " + Base64.getEncoder().encodeToString("admin:Admin123".getBytes()));
                    BufferedReader oIn = new BufferedReader(new InputStreamReader(oConn.getInputStream()));
                    StringBuilder oResponse = new StringBuilder();
                    while ((line = oIn.readLine()) != null) oResponse.append(line);
                    oIn.close();

                    JSONObject oData = new JSONObject(oResponse.toString());
                    JSONArray oResults = oData.optJSONArray("results");

                    // 3. Query OpenELIS for this patient's existing samples
                    ps = conn.prepareStatement(
                        "SELECT s.id as sample_id, s.entered_date, string_agg(DISTINCT COALESCE(pan.name, t.name), ', ') as tests " +
                        "FROM clinlims.sample s " +
                        "JOIN clinlims.sample_human sh ON sh.samp_id = s.id " +
                        "JOIN clinlims.patient p ON sh.patient_id = p.id " +
                        "LEFT JOIN clinlims.patient_identity pi ON pi.patient_id = p.id " +
                        "LEFT JOIN clinlims.sample_item si ON si.samp_id = s.id " +
                        "LEFT JOIN clinlims.analysis a ON a.sampitem_id = si.id " +
                        "LEFT JOIN clinlims.test t ON a.test_id = t.id " +
                        "LEFT JOIN clinlims.panel pan ON a.panel_id = pan.id " +
                        "WHERE pi.identity_data = ? OR p.national_id = ? " +
                        "GROUP BY s.id, s.entered_date ORDER BY s.id DESC"
                    );
                    ps.setString(1, patientId);
                    ps.setString(2, patientId);
                    rs = ps.executeQuery();
                    JSONArray existingSamples = new JSONArray();
                    while (rs.next()) {
                        JSONObject es = new JSONObject();
                        es.put("sampleId", rs.getString("sample_id"));
                        es.put("enteredDate", rs.getString("entered_date"));
                        es.put("tests", rs.getString("tests"));
                        existingSamples.put(es);
                    }
                    rs.close();
                    ps.close();

                    outJson.put("success", true);
                    outJson.put("patientDisplay", pDisplay);
                    outJson.put("patientUuid", pUuid);
                    outJson.put("openmrsOrders", oResults != null ? oResults : new JSONArray());
                    outJson.put("openelisSamples", existingSamples);
                }
            }
        } else {
            outJson.put("success", false);
            outJson.put("message", "Unknown action: " + action);
        }

    } catch (Exception e) {
        outJson.put("success", false);
        outJson.put("error", e.getMessage());
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        outJson.put("stackTrace", sw.toString());
    } finally {
        if (rs != null) try { rs.close(); } catch (Exception ignore) {}
        if (ps != null) try { ps.close(); } catch (Exception ignore) {}
        if (conn != null) try { conn.close(); } catch (Exception ignore) {}
    }

    out.print(outJson.toString());
%>
