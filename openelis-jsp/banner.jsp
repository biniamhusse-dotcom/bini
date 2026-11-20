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
	boolean languageSwitch = false;
%>
<%
	path = request.getContextPath();
	basePath = path + "/";
	bannerStyle = SystemConfiguration.getInstance().getBannerStyle();
	languageSwitch = "true".equals(ConfigurationProperties.getInstance().getPropertyValue(Property.allowLanguageChange));

	UserSessionData usd = null;
	if (request.getSession().getAttribute(IActionConstants.USER_SESSION_DATA) != null) {
		usd = (UserSessionData) request.getSession().getAttribute(IActionConstants.USER_SESSION_DATA);
	}
	String elisUser = (usd != null && usd.getElisUserName() != null && !usd.getElisUserName().trim().isEmpty()) ? usd.getElisUserName() : "superman";

	String locName = (String) session.getAttribute("selectedLabLocationName");
	if (locName == null || locName.trim().isEmpty()) {
		locName = "Main Laboratory";
		session.setAttribute("selectedLabLocationName", locName);
		session.setAttribute("selectedLabLocationCode", "MAIN_LAB");
	}
%>

<link rel="stylesheet" type="text/css" href="<%=basePath%>css/menu.css?ver=<%= Versioning.getBuildNumber() %>" />
<script type="text/javascript" src="<%=basePath%>scripts/menu/hoverIntent.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/superfish.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/supersubs.js?ver=<%= Versioning.getBuildNumber() %>"></script>
<script type="text/javascript" src="<%=basePath%>scripts/menu/supposition.js?ver=<%= Versioning.getBuildNumber() %>"></script>

<style>
/* Reset and ensure full width banner */
#oe-banner-wrapper {
    width: 100% !important;
    max-width: 100% !important;
    display: block !important;
    clear: both !important;
    float: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #00463f !important;
    position: relative !important;
    z-index: 9999 !important;
    box-sizing: border-box !important;
}
#oe-top-bar {
    width: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 6px 16px !important;
    background: linear-gradient(135deg, #00463f, #037469) !important;
    color: #fff !important;
    font-size: 12px !important;
    min-height: 38px !important;
    box-sizing: border-box !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
}
.oe-top-left {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    cursor: pointer !important;
}
.oe-top-left img {
    height: 24px !important;
    width: auto !important;
    vertical-align: middle !important;
}
.oe-top-title {
    font-size: 14px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    letter-spacing: 0.3px !important;
}
.oe-top-center {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
}
.oe-loc-badge {
    background: #27ae60 !important;
    color: #fff !important;
    padding: 3px 10px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
}
.oe-loc-badge a {
    color: #fff !important;
    text-decoration: underline !important;
}
.oe-transfer-btn {
    background: rgba(255,255,255,0.2) !important;
    color: #fff !important;
    padding: 2px 8px !important;
    border-radius: 3px !important;
    text-decoration: none !important;
    font-size: 11px !important;
    font-weight: 500 !important;
}
.oe-transfer-btn:hover {
    background: rgba(255,255,255,0.3) !important;
}
.oe-top-right {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    font-size: 11px !important;
    color: #e2e8f0 !important;
}
.oe-top-right a {
    color: #fff !important;
    text-decoration: underline !important;
}

/* Menu bar styles */
#oe-menu-bar {
    width: 100% !important;
    display: block !important;
    clear: both !important;
    background: #0f766e !important;
    border-top: 1px solid rgba(255,255,255,0.1) !important;
    box-sizing: border-box !important;
}
#oe-menu-bar form {
    margin: 0 !important;
    padding: 0 !important;
}
#oe-menu-bar ul.nav-menu {
    display: flex !important;
    flex-wrap: wrap !important;
    margin: 0 !important;
    padding: 0 4px !important;
    list-style: none !important;
    width: 100% !important;
}
#oe-menu-bar ul.nav-menu > li {
    float: left !important;
}
#oe-menu-bar .nav-menu a {
    padding: 8px 14px !important;
    font-size: 12px !important;
    color: #fff !important;
}
#oe-menu-bar .nav-menu li:hover > a,
#oe-menu-bar .nav-menu li.sfHover > a {
    background: #00463f !important;
    color: #fff !important;
}
#oe-menu-bar .nav-menu ul {
    background: #00463f !important;
    box-shadow: 0 4px 6px rgba(0,0,0,0.15) !important;
}
#oe-menu-bar .nav-menu ul a {
    background: #00463f !important;
    color: #fff !important;
    padding: 8px 14px !important;
}
#oe-menu-bar .nav-menu ul a:hover {
    background: #0d9488 !important;
}

/* Force clearing so subsequent page content is 100% wide below header */
.oe-banner-clear {
    clear: both !important;
    width: 100% !important;
    height: 0 !important;
    line-height: 0 !important;
    font-size: 0 !important;
    display: block !important;
}
</style>

<div id="oe-banner-wrapper">
    <div id="oe-top-bar">
        <div class="oe-top-left" onclick="window.location.href='<%=basePath%>LabDashboard.do';">
            <img src="<%=basePath%>images/openelis_logo.png" title="OpenELIS" alt="OpenELIS" onerror="this.style.display='none'" />
            <span class="oe-top-title"><%=StringUtil.getContextualMessageForKey("title.default")%></span>
        </div>

        <div class="oe-top-center">
            <div class="oe-loc-badge">
                <span>Location: <strong><%= locName %></strong></span>
                <a href="<%=basePath%>LocationSelect.do">(Change)</a>
                <a href="<%=basePath%>SampleTransfer.do" class="oe-transfer-btn">Transfer Sample</a>
            </div>
        </div>

        <div class="oe-top-right">
            <span>Version: <%= ConfigurationProperties.getInstance().getPropertyValue(Property.releaseNumber)%></span>
            <span>|</span>
            <span><%= elisUser %></span>
            <html:link page="/LogoutPage.do" styleId="log-out-link" titleKey="homePage.menu.logOut.toolTip"><bean:message key="homePage.menu.logOut.toolTip"/></html:link>
        </div>
    </div>

    <div id="oe-menu-bar">
        <%= MenuUtil.getMenuAsHTML(path) %>
    </div>
</div>
<div class="oe-banner-clear"></div>

<script type="text/javascript">
jQuery(function(){
    if (jQuery('ul.nav-menu').length) {
        try {
            jQuery('ul.nav-menu').supersubs({
                minWidth: 9,
                maxWidth: 100,
                extraWidth: 1
            }).superfish({
                delay: 400,
                speed: 0
            }).supposition();
        } catch (e) {}
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
