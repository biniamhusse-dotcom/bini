<%@ page language="java" contentType="application/json; charset=utf-8"
    import="java.sql.*, java.util.*, org.json.*"%>
<%
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);
    response.setHeader("Access-Control-Allow-Origin", "*");

    String dbUrl = "jdbc:postgresql://openelisdb:5432/clinlims";
    String dbUser = "clinlims";
    String dbPass = "clinlims";

    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;

    JSONObject map = new JSONObject();
    JSONArray list = new JSONArray();

    try {
        Class.forName("org.postgresql.Driver");
        conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
        ps = conn.prepareStatement(
            "SELECT id, name, description, is_active FROM test WHERE UPPER(TRIM(COALESCE(is_active, 'N'))) = 'N'");
        rs = ps.executeQuery();
        while (rs.next()) {
            String name = rs.getString("name");
            String desc = rs.getString("description");
            if (name != null && !name.trim().isEmpty()) {
                map.put(name.trim().toLowerCase(), true);
                list.put(name.trim());
            }
            if (desc != null && !desc.trim().isEmpty()) {
                map.put(desc.trim().toLowerCase(), true);
            }
        }
        if (rs != null) try { rs.close(); } catch (Exception e) {}
        if (ps != null) try { ps.close(); } catch (Exception e) {}

        try {
            ps = conn.prepareStatement("SELECT uuid, name FROM public.unavailable_service");
            rs = ps.executeQuery();
            while (rs.next()) {
                String u = rs.getString("uuid");
                String n = rs.getString("name");
                if (u != null && !u.trim().isEmpty()) {
                    map.put(u.trim(), true);
                }
                if (n != null && !n.trim().isEmpty()) {
                    map.put(n.trim().toLowerCase(), true);
                    list.put(n.trim());
                }
            }
        } catch (Exception ex2) {
            // ignore if unavailable_service not created yet
        }
    } catch (Exception e) {
        map.put("error", e.getMessage());
    } finally {
        if (rs != null) try { rs.close(); } catch (Exception e) {}
        if (ps != null) try { ps.close(); } catch (Exception e) {}
        if (conn != null) try { conn.close(); } catch (Exception e) {}
    }

    String format = request.getParameter("format");
    if ("list".equalsIgnoreCase(format)) {
        out.print(list.toString());
    } else {
        out.print(map.toString());
    }
%>
