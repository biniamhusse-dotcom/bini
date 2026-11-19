<%@ page language="java" contentType="application/json; charset=utf-8"%><%
    response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    response.setHeader("Pragma", "no-cache");
    response.setDateHeader("Expires", 0);
    session.setAttribute("lastKeepAlive", System.currentTimeMillis());
    out.print("{\"status\":\"ok\",\"time\":" + System.currentTimeMillis() + "}");
%>