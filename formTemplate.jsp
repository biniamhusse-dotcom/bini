<%@ page language="java" contentType="text/html; charset=utf-8"
	import="us.mn.state.health.lims.common.action.IActionConstants"
	import="us.mn.state.health.lims.common.util.StringUtil"
	import="us.mn.state.health.lims.common.util.resources.ResourceLocator"%>
<%@ taglib uri="/WEB-INF/struts-html.tld" prefix="html" %>
<%@ taglib uri="/WEB-INF/struts-bean.tld" prefix="bean" %>
<%@ taglib uri="/WEB-INF/struts-tiles.tld" prefix="tiles" %>
<%@ taglib uri="/WEB-INF/struts-logic.tld" prefix="logic" %>

<tiles:importAttribute />
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<%
String basePath = request.getScheme() + "://"
		+ request.getServerName() + ":" + request.getServerPort()
		+ request.getContextPath() + "/";
%>
<base href="<%=basePath%>">
<title><bean:message key="title.menu"/></title>
<script language="JavaScript1.2">
var context = '<%= request.getContextPath() %>';
var formName = '<%= (String)request.getAttribute(IActionConstants.FORM_NAME) %>';

function submitForm(form) {
	//setAction(form, 'Save', context, formName);
}

function setAction(form, action, validate, parameters) {
	var sessionid = '';
	if(form.action.indexOf("JSESSIONID") > -1){
		var splitArr = form.action.split("JSESSIONID");
		sessionid = splitArr[1];
	}
	var parsedFormName;
	if (formName.charAt(0) == '/') {
		parsedFormName = formName;
	} else {
		formName = formName.substring(1, formName.length - 4);
		formName = formName.substring(0, 1).toUpperCase() + formName;
		parsedFormName = '/' + formName;
	}
	form.action = context + '/' + action + parsedFormName + '.do' + sessionid + parameters;
	form.submit();
}

function myPopup(url) {
	window.open(url, "Popup", 'width=640, height=300, resizable=yes, scrollbars');
}

function closePopup() {
	window.close();
}

function callMenuParent(url){
 opener.location.href = url;
 closePopup();
}

function showMessage(id){
	if(document.getElementById){
		document.getElementById(id).style.display='block';
	} else {
		if(document.all){
			document.all[id].style.display='block';
		}
	}
}

function hideMessage(id){
	if(document.getElementById){
		document.getElementById(id).style.display='none';
	} else {
		if(document.all){
			document.all[id].style.display='none';
		}
	}
}

function callUpdate(url){
	window.location.href = url;
}

</script>

</head>

<body bgcolor="#FFFFFF">

<%
	Locale locale = (Locale)request.getSession().getAttribute(org.apache.struts.Globals.LOCALE_KEY);
	String useDefaultLocale = ResourceLocator.getInstance().getServerConfigurationProperties().valueOf("use.default.locale");
	if (locale == null || "true".equals(useDefaultLocale) ) {
		locale = Locale.getDefault();
	}
%>
<bean:define id="locale" value="<%= locale.toString() %>" />
<bean:message key="label.header.title" locale="HTMLLANG"/> (<%=locale.toString()%>)

	<table cellpadding="0" cellspacing="1" width="100%">
			<tr>
				<td>
					<tiles:insert attribute="error"/>
				</td>
			</tr>
			 <%
 String _ft_actionKey = (String)request.getAttribute(IActionConstants.ACTION_KEY);
 String _ft_formName = (String)request.getAttribute(IActionConstants.FORM_NAME);
 if (_ft_actionKey == null && _ft_formName != null && _ft_formName.length() > 4) {
     _ft_actionKey = "/" + _ft_formName.substring(0, 1).toUpperCase() + _ft_formName.substring(1, _ft_formName.length() - 4);
 }
 if (_ft_actionKey != null) {
 %>
                <form name='<%= _ft_formName %>' action='<%= _ft_actionKey %>' onSubmit="return submitForm(this);" method="POST">
             <% } %>
			<tr>
				<td>
					<tiles:insert attribute="header"/>
				</td>
			</tr>
            <tr>
				<td>
					<tiles:insert attribute="preSelectionHeader"/>
				</td>
			</tr>
			<tr>
				<td>
		        	<tiles:insert attribute="body"/>
				</td>
			</tr>
			<tr>
				<td>
					<tiles:insert attribute="footer"/>
				</td>
			</tr>
			<% if (_ft_actionKey != null) { %>
                 </form>
            <% } %>

	</table>

</body>
