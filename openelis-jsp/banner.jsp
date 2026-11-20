<%@ page language="java" contentType="text/html; charset=utf-8"%>
<%
if (request.getAttribute("oe_banner_rendered") != null) {
    return;
}
request.setAttribute("oe_banner_rendered", Boolean.TRUE);
%>
<%@ taglib uri="/tags/struts-bean" prefix="bean"%>
<%@ taglib uri="/tags/struts-html" prefix="html"%>
<%@ taglib uri="/tags/struts-logic" prefix="logic"%>
<%@ taglib uri="/tags/labdev-view" prefix="app"%>

<%@ page import="us.mn.state.health.lims.common.util.SystemConfiguration,
				 us.mn.state.health.lims.common.util.ConfigurationProperties,
				 us.mn.state.health.lims.common.util.ConfigurationProperties.Property,
				 us.mn.state.health.lims.common.action.IActionConstants,
				 us.mn.state.health.lims.login.valueholder.UserSessionData,
				 us.mn.state.health.lims.menu.util.MenuUtil,
                 us.mn.state.health.lims.common.util.Versioning,
				 us.mn.state.health.lims.common.util.StringUtil"%>

<%!String path = "";
	String basePath = "";
	String bannerStyle = null;
	String menuItems[];
	boolean languageSwitch = false;
%>
<%
	path = request.getContextPath();
	basePath = path + "/";
	bannerStyle = SystemConfiguration.getInstance().getBannerStyle();
	languageSwitch = "true".equals(ConfigurationProperties.getInstance().getPropertyValue(Property.allowLanguageChange));
%>

<script language="JavaScript1.2">
function /*void*/ setLanguage( language ){
    var languageMessage = "data-message-"+language;
	update = confirm(jQuery("#updateMessage").attr(languageMessage));
	if( update ){
		var form = window.document.forms[0];
		form.action = "LoginPage.do?lang=" + language;
		form.submit();
	}
}

function displayHelp(){
    var url = '<%=basePath%>' + 'documentation/' + '<%= StringUtil.getContextualMessageForKey("documentation") %>';
	var newwindow=window.open( url,'name','height=1000,width=850, menuBar=yes');
	if (window.focus) {newwindow.focus()}
}
</script>

<link rel="stylesheet" type="text/css" href="<%=basePath%>css/menu.css?ver=<%= Versioning.getBuildNumber() %>" />

<script type="text/javascript" src="<%=basePath%>scripts/menu/hoverIntent.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/superfish.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/supersubs.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/supposition.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript">
	jQuery(function(){
		if (jQuery('ul.nav-menu').length) {
			jQuery('ul.nav-menu').supersubs({
				minWidth: 9,
				maxWidth: 100,
				extraWidth: 1
			}).superfish({
				delay: 400,
				speed: 0
			}).supposition();
		}

		if (!window._oeKeepAliveInterval) {
			window._oeKeepAliveInterval = setInterval(function() {
				try {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', '<%=basePath%>pages/common/sessionKeepAlive.jsp?_=' + Date.now(), true);
					xhr.send();
				} catch (e) {}
			}, 240000);
		}
	});
</script>

<div id="header" style="position:relative;z-index:9999;">
  	<div id="oe-logo" style="width: 89px" onclick="navigateToHomePage();"><img src="images/openelis_logo.png" title="OpenELIS" alt="OpenELIS" /></div>
	<div class="header-def">
 		<div style="display: block">
			<%
				UserSessionData usd = null;
				if (request.getSession().getAttribute(IActionConstants.USER_SESSION_DATA) != null) {
					usd = (UserSessionData) request.getSession().getAttribute(IActionConstants.USER_SESSION_DATA);
				}
				String elisUser = (usd != null && usd.getElisUserName() != null && !usd.getElisUserName().trim().isEmpty()) ? usd.getElisUserName() : "superman";
			%>
			<div id="user-info"><div><%=elisUser%> - <html:link page="/LogoutPage.do" styleId="log-out-link" titleKey="homePage.menu.logOut.toolTip"><bean:message key="homePage.menu.logOut.toolTip"/></html:link></div></div>
		<%
			String locName = (String) session.getAttribute("selectedLabLocationName");
			if (locName == null || locName.trim().isEmpty()) {
				locName = "Main Laboratory";
				session.setAttribute("selectedLabLocationName", locName);
				session.setAttribute("selectedLabLocationCode", "MAIN_LAB");
			}
		%>
		<div style="background:#27ae60;color:white;padding:2px 8px;border-radius:3px;font-size:11px;display:inline-block;margin-top:2px;">
			Location: <strong><%= locName %></strong> <a href="<%=basePath%>LocationSelect.do" style="color:#fff;text-decoration:underline;">(Change)</a>
			<a href="<%=basePath%>SampleTransfer.do" style="color:#fff;text-decoration:underline;margin-left:8px;background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:3px;">Transfer Sample</a>
		</div>
  	  		<div id="oe-title" onclick="navigateToHomePage();"><%=StringUtil.getContextualMessageForKey("title.default")%></div>
  		</div>
  		<div id="oe-version" style="display: block">
    		<div id="appVersion">
    		<bean:message key="ellis.version" />:&nbsp;
		    <%= ConfigurationProperties.getInstance().getPropertyValue(Property.releaseNumber)%> (<%= ConfigurationProperties.getInstance().getPropertyValue(Property.buildNumber) %>)&nbsp;&nbsp;&nbsp;
	        </div>

		    <% if("true".equals(ConfigurationProperties.getInstance().getPropertyValueLowerCase(Property.TrainingInstallation))){ %>
		      <div id="training-alert"><span title="<bean:message key="training.note"/>"><bean:message key="training.note"/></span></div>
		    <% } %>
  		</div>

<%= MenuUtil.getMenuAsHTML(path) %>

	</div>
</div> <!-- Closes id=header -->

<% if( languageSwitch && "loginForm".equals((String)request.getAttribute(IActionConstants.FORM_NAME)) ){ %>
  <div id="language-chooser"> <bean:message key="banner.message.selectLanguage"/>
    <select onchange="setLanguage(this.options[this.selectedIndex].value)">
        <option selected></option>
        <option value="en_US"><bean:message bundle="setOfLanguagesBundle" key="en_US"/></option>
        <option value="fr-FR"><bean:message bundle="setOfLanguagesBundle" key="fr-FR"/></option>
        <option value="es-ES"><bean:message bundle="setOfLanguagesBundle" key="es-ES"/></option>
		   <option value="pt-BR"><bean:message bundle="setOfLanguagesBundle" key="pt-BR"/></option>
    </select>
  </div>
  <span id = "updateMessage"
    data-message-en_US = '<bean:message bundle="setOfLanguagesBundle" key="languageConfirmation.message.english"/>'
    data-message-fr-FR = '<bean:message bundle="setOfLanguagesBundle" key="languageConfirmation.message.french"/>'
    data-message-es-ES = '<bean:message bundle="setOfLanguagesBundle" key="languageConfirmation.message.spanish"/>'
	     data-message-pt-BR = '<bean:message bundle="setOfLanguagesBundle" key="languageConfirmation.message.portuguese"/>'
    ></span>
<% } %>
