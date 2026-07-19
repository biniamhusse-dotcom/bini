<%@ page language="java"
	contentType="text/html; charset=utf-8"
	import="org.apache.struts.util.RequestUtils,org.apache.struts.action.*,org.apache.struts.Globals,java.util.Iterator,javax.servlet.jsp.JspException"
	import="us.mn.state.health.lims.common.action.IActionConstants"
	import="us.mn.state.health.lims.common.util.StringUtil"
	import="us.mn.state.health.lims.common.util.resources.ResourceLocator"
 %>
<%@ taglib uri="/WEB-INF/struts-html.tld" prefix="html" %>
<%@ taglib uri="/WEB-INF/struts-bean.tld" prefix="bean" %>
<%@ taglib uri="/WEB-INF/struts-tiles.tld" prefix="tiles" %>
<%@ taglib uri="/WEB-INF/struts-logic.tld" prefix="logic" %>

<%--action is set in BaseAction--%>

 <%
 String _actionKey = (String)request.getAttribute(IActionConstants.ACTION_KEY);
 String _formName = (String)request.getAttribute(IActionConstants.FORM_NAME);
 if (_actionKey == null && _formName != null && _formName.length() > 4) {
     _actionKey = "/" + _formName.substring(0, 1).toUpperCase() + _formName.substring(1, _formName.length() - 4);
 }
 if (_actionKey != null) {
 %>
 <form name='<%= _formName %>' action='<%= _actionKey %>' onsubmit="return submitForm(this);" method="POST">
 <% } %>

	<table cellpadding="0" cellspacing="1" width="100%" height="100%" border="0">
	
			<!-- <tr valign="top"> -->
				<!-- <td> -->
					<%--tiles:insert attribute="error"/--%>
				<!-- </td> -->
			<!-- </tr> -->

			<tr valign="top">
				<td><tiles:insert attribute="preSelectionHeader"/></td>
			</tr>
			<tr valign="top">
				<td>
					<tiles:insert attribute="header"/>
				</td>
			</tr>
			<tr valign="top">
				<td>
					<tiles:insert attribute="body"/>
				</td>
			</tr>
			<tr valign="bottom">
				<td>
					<tiles:insert attribute="footer"/>
				</td>
			</tr>

	</table>
<% if (_actionKey != null) { %>
</form>
<% } %>
