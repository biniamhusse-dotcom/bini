<%@ page language="java" contentType="text/html; charset=utf-8"
    import="java.sql.*, java.util.*, java.io.*, java.net.*,
            us.mn.state.health.lims.common.util.SystemConfiguration,
            org.json.*"%>
<%@ taglib uri="/tags/struts-bean" prefix="bean" %>
<%@ taglib uri="/tags/struts-html" prefix="html" %>
<%@ taglib uri="/tags/struts-logic" prefix="logic" %>

<style>
    .sync-container { padding: 15px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; max-width: 1250px; margin: 0 auto; color: #2c3e50; }
    .sync-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
    .sync-title { margin: 0; font-size: 22px; font-weight: bold; color: #1e3a5f; }
    .sync-subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    
    .sync-btn { padding: 8px 16px; cursor: pointer; border: 1px solid #999; background: #f1f5f9; font-size: 13px; border-radius: 4px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .sync-btn-primary { background: #1e3a5f; color: white; border: none; }
    .sync-btn-primary:hover { background: #152942; }
    .sync-btn-success { background: #059669; color: white; border: none; }
    .sync-btn-success:hover { background: #047857; }
    .sync-btn-danger { background: #dc2626; color: white; border: none; }
    .sync-btn-danger:hover { background: #b91c1c; }
    .sync-btn-warning { background: #d97706; color: white; border: none; }
    .sync-btn-warning:hover { background: #b45309; }
    .sync-btn-info { background: #0284c7; color: white; border: none; }
    .sync-btn-info:hover { background: #0369a1; }
    .sync-btn-sm { padding: 4px 10px; font-size: 12px; }

    .sync-msg { padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-weight: 500; font-size: 14px; display: none; }
    .sync-msg-success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .sync-msg-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .sync-msg-info { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }

    .sync-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 15px; margin-bottom: 25px; }
    .sync-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .sync-card.healthy { border-top: 4px solid #059669; }
    .sync-card.warning { border-top: 4px solid #d97706; }
    .sync-card.error { border-top: 4px solid #dc2626; }
    .sync-card.info { border-top: 4px solid #0284c7; }
    
    .sync-card-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
    .sync-card-status { font-size: 20px; font-weight: bold; margin: 8px 0 4px 0; display: flex; align-items: center; gap: 8px; }
    .sync-card-desc { font-size: 12px; color: #64748b; line-height: 1.4; }

    .sync-section { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .sync-section-title { margin-top: 0; font-size: 16px; font-weight: bold; color: #1e3a5f; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }

    .sync-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .sync-table th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600; }
    .sync-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .sync-table tr:hover { background: #f8fafc; }

    .sync-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .sync-badge-success { background: #d1fae5; color: #065f46; }
    .sync-badge-warning { background: #fef3c7; color: #92400e; }
    .sync-badge-danger { background: #fee2e2; color: #991b1b; }
    .sync-badge-info { background: #e0f2fe; color: #0369a1; }

    .sync-input-group { display: flex; gap: 8px; align-items: center; }
    .sync-input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; outline: none; }
    .sync-input:focus { border-color: #1e3a5f; }

    .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
    .action-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; background: #fafafa; display: flex; flex-direction: column; justify-content: space-between; }
    .action-box h4 { margin: 0 0 8px 0; font-size: 14px; color: #1e3a5f; }
    .action-box p { font-size: 12px; color: #64748b; margin: 0 0 12px 0; flex-grow: 1; line-height: 1.4; }
</style>

<div class="sync-container">
    <div class="sync-header">
        <div>
            <h1 class="sync-title">Lab Order Sync &amp; Feed Diagnostics</h1>
            <div class="sync-subtitle">OpenMRS &harr; OpenELIS Atomfeed Monitor &bull; Automatic Failure Recovery &bull; Order Verification</div>
        </div>
        <div style="display: flex; gap: 8px;">
            <button class="sync-btn sync-btn-info" onclick="refreshAll()"><i class="fa fa-refresh"></i> Refresh Status</button>
            <a href="MasterListsPage.do" class="sync-btn">&larr; Back to Admin</a>
        </div>
    </div>

    <!-- Alert / Message Banner -->
    <div id="syncMsg" class="sync-msg"></div>

    <!-- Overview Status Cards -->
    <div class="sync-cards">
        <div id="cardEncounterMarker" class="sync-card info">
            <div class="sync-card-label">Encounter Feed Sync</div>
            <div id="statEncounterMarker" class="sync-card-status" style="font-size: 16px;">Loading...</div>
            <div id="descEncounterMarker" class="sync-card-desc">Checking feed position...</div>
        </div>

        <div id="cardSampleTypes" class="sync-card healthy">
            <div class="sync-card-label">Sample Type Mapping</div>
            <div id="statSampleTypes" class="sync-card-status"><span class="sync-badge sync-badge-success">Checking...</span></div>
            <div id="descSampleTypes" class="sync-card-desc">Tests mapped in clinlims.sampletype_test</div>
        </div>

        <div id="cardTriggers" class="sync-card healthy">
            <div class="sync-card-label">Database Triggers</div>
            <div id="statTriggers" class="sync-card-status"><span class="sync-badge sync-badge-success">Checking...</span></div>
            <div class="sync-card-desc">Automatic sample type auto-assignment on new tests</div>
        </div>

        <div id="cardTodaySamples" class="sync-card info">
            <div class="sync-card-label">Today's Ingested Samples</div>
            <div id="statTodaySamples" class="sync-card-status">...</div>
            <div class="sync-card-desc">Samples created in OpenELIS today</div>
        </div>
    </div>

    <!-- Synchronizing & Fixing Activities -->
    <div class="sync-section">
        <div class="sync-section-title">
            <span>Fixing &amp; Recovery Activities</span>
            <span style="font-size: 12px; font-weight: normal; color: #64748b;">Instant self-healing tools for sync disruptions</span>
        </div>
        <div class="actions-grid">
            <div class="action-box">
                <h4><i class="fa fa-wrench"></i> Auto-Fix Missing Sample Types</h4>
                <p>Ensures every test and panel item in OpenELIS has an active mapping in <code>clinlims.sampletype_test</code>, preventing NullPointerExceptions in the feed processor.</p>
                <button class="sync-btn sync-btn-success sync-btn-sm" onclick="autoFixSampleTypes()"><i class="fa fa-check-circle"></i> Run Sample Type Auto-Fix</button>
            </div>

            <div class="action-box">
                <h4><i class="fa fa-history"></i> Rewind Encounter Feed Marker</h4>
                <p>Rewinds the OpenMRS encounter marker by several entries to force the feed worker to re-read and ingest any missed or skipped orders.</p>
                <button class="sync-btn sync-btn-warning sync-btn-sm" onclick="rewindMarker()"><i class="fa fa-backward"></i> Rewind Marker &amp; Trigger Resync</button>
            </div>

            <div class="action-box">
                <h4><i class="fa fa-trash"></i> Clear Failed Events &amp; Retry</h4>
                <p>Clears deadlocked records in <code>clinlims.failed_events</code> table so that subsequent orders can proceed without transaction rollbacks.</p>
                <button class="sync-btn sync-btn-danger sync-btn-sm" onclick="clearFailedEvents()"><i class="fa fa-refresh"></i> Clear &amp; Retry Failed Events</button>
            </div>
        </div>
    </div>

    <!-- Patient Order Verification Tool -->
    <div class="sync-section">
        <div class="sync-section-title">
            <span>Patient Lab Order Verification</span>
            <span style="font-size: 12px; font-weight: normal; color: #64748b;">Compare OpenMRS orders with OpenELIS samples for any patient</span>
        </div>
        <div style="margin-bottom: 15px;" class="sync-input-group">
            <input type="text" id="verifyPatientId" class="sync-input" placeholder="Enter Patient ID (e.g. 195000)" style="width: 250px;" value="195000" />
            <button class="sync-btn sync-btn-primary" onclick="verifyPatientOrders()"><i class="fa fa-search"></i> Check Patient Orders</button>
        </div>
        <div id="patientVerificationResult" style="display: none; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            <h4 id="pvPatientHeader" style="margin: 0 0 10px 0; color: #1e3a5f;"></h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h5 style="margin: 0 0 8px 0; color: #475569;">OpenMRS Lab Orders:</h5>
                    <div id="pvOpenmrsOrders"></div>
                </div>
                <div>
                    <h5 style="margin: 0 0 8px 0; color: #475569;">OpenELIS Ingested Samples:</h5>
                    <div id="pvOpenelisSamples"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent Ingested Samples Log -->
    <div class="sync-section">
        <div class="sync-section-title">
            <span>Recently Ingested Samples in OpenELIS</span>
            <button class="sync-btn sync-btn-sm" onclick="loadRecentSamples()"><i class="fa fa-refresh"></i> Refresh</button>
        </div>
        <table class="sync-table">
            <thead>
                <tr>
                    <th>Sample ID</th>
                    <th>Accession #</th>
                    <th>Entered Date</th>
                    <th>Patient ID</th>
                    <th>Patient Name</th>
                    <th>Tests / Panels</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody id="recentSamplesBody">
                <tr><td colspan="7" style="text-align: center; color: #94a3b8;">Loading recent samples...</td></tr>
            </tbody>
        </table>
    </div>

    <!-- Atomfeed Markers & Failed Events Audit -->
    <div class="sync-section">
        <div class="sync-section-title">
            <span>Atomfeed Markers &amp; Error Audit</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
            <div>
                <h5 style="margin: 0 0 8px 0; color: #475569;">Active Markers (clinlims.markers):</h5>
                <table class="sync-table" style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Feed URI</th>
                            <th>Last Read Entry ID</th>
                        </tr>
                    </thead>
                    <tbody id="markersTableBody">
                        <tr><td colspan="3">Loading markers...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
    var API_URL = "pages/admin/labOrderSyncApi.jsp";

    function showMsg(text, type) {
        var el = document.getElementById("syncMsg");
        el.className = "sync-msg sync-msg-" + type;
        el.innerHTML = text;
        el.style.display = "block";
        setTimeout(function() { el.style.display = "none"; }, 8000);
    }

    function refreshAll() {
        loadStatus();
        loadRecentSamples();
    }

    function loadStatus() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", API_URL + "?action=getStatus", true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        // Unmapped tests
                        var unmappedEl = document.getElementById("statSampleTypes");
                        var unmappedCard = document.getElementById("cardSampleTypes");
                        if (data.unmappedTests === 0) {
                            unmappedEl.innerHTML = '<span class="sync-badge sync-badge-success">100% Mapped (0 Missing)</span>';
                            unmappedCard.className = "sync-card healthy";
                        } else {
                            unmappedEl.innerHTML = '<span class="sync-badge sync-badge-danger">' + data.unmappedTests + ' Tests Unmapped!</span>';
                            unmappedCard.className = "sync-card error";
                        }

                        // Triggers
                        var trigEl = document.getElementById("statTriggers");
                        var trigCard = document.getElementById("cardTriggers");
                        if (data.triggersActive) {
                            trigEl.innerHTML = '<span class="sync-badge sync-badge-success">Active &amp; Guarded</span>';
                            trigCard.className = "sync-card healthy";
                        } else {
                            trigEl.innerHTML = '<span class="sync-badge sync-badge-warning">Trigger Inactive</span>';
                            trigCard.className = "sync-card warning";
                        }

                        // Today's samples
                        document.getElementById("statTodaySamples").innerText = data.todaySamples + " Samples";

                        // Markers
                        var markersBody = document.getElementById("markersTableBody");
                        markersBody.innerHTML = "";
                        var encounterLast = "None";
                        for (var i = 0; i < data.markers.length; i++) {
                            var m = data.markers[i];
                            var tr = document.createElement("tr");
                            tr.innerHTML = "<td>" + m.id + "</td><td>" + m.feed_uri + "</td><td style='font-family: monospace; font-size: 11px;'>" + m.last_entry_id + "</td>";
                            markersBody.appendChild(tr);
                            if (m.feed_uri.indexOf("encounter") !== -1) {
                                encounterLast = m.last_entry_id;
                            }
                        }
                        var shortMarker = encounterLast.length > 35 ? "..." + encounterLast.substring(encounterLast.length - 30) : encounterLast;
                        document.getElementById("statEncounterMarker").innerText = shortMarker;
                        document.getElementById("descEncounterMarker").innerText = "Last entry synced: " + encounterLast;
                    }
                } catch (e) {
                    console.error("Parse error in getStatus", e);
                }
            }
        };
        xhr.send();
    }

    function autoFixSampleTypes() {
        if (!confirm("Run automatic sample type backfill and verify trigger guards?")) return;
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    showMsg("<strong>Success:</strong> " + data.message, "success");
                    loadStatus();
                } else {
                    showMsg("<strong>Error:</strong> " + (data.error || data.message), "error");
                }
            }
        };
        xhr.send("action=autoFixSampleTypes");
    }

    function rewindMarker() {
        if (!confirm("Rewind encounter marker to earlier entry to trigger re-processing of missed orders?")) return;
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    showMsg("<strong>Encounter Marker Rewound:</strong> " + data.message, "success");
                    setTimeout(refreshAll, 3000);
                } else {
                    showMsg("<strong>Error:</strong> " + (data.error || data.message), "error");
                }
            }
        };
        xhr.send("action=rewindMarker&feedType=encounter");
    }

    function clearFailedEvents() {
        if (!confirm("Clear all records in failed_events? This allows the feed worker to retry unblocked.")) return;
        var xhr = new XMLHttpRequest();
        xhr.open("POST", API_URL, true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    showMsg("<strong>Failed Events Cleared:</strong> " + data.message, "success");
                    loadStatus();
                } else {
                    showMsg("<strong>Error:</strong> " + (data.error || data.message), "error");
                }
            }
        };
        xhr.send("action=clearFailedEvents");
    }

    function verifyPatientOrders() {
        var patientId = document.getElementById("verifyPatientId").value.trim();
        if (!patientId) {
            alert("Please enter a patient ID.");
            return;
        }

        var resDiv = document.getElementById("patientVerificationResult");
        resDiv.style.display = "block";
        document.getElementById("pvPatientHeader").innerText = "Checking Patient: " + patientId + "...";
        document.getElementById("pvOpenmrsOrders").innerHTML = "<em>Querying OpenMRS...</em>";
        document.getElementById("pvOpenelisSamples").innerHTML = "<em>Querying OpenELIS...</em>";

        var xhr = new XMLHttpRequest();
        xhr.open("GET", API_URL + "?action=checkPatientOrders&patientId=" + encodeURIComponent(patientId), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    document.getElementById("pvPatientHeader").innerText = "Patient: " + data.patientDisplay;
                    
                    // OpenMRS orders
                    var omrsHtml = "<ul style='padding-left: 20px; font-size: 13px;'>";
                    if (data.openmrsOrders.length === 0) {
                        omrsHtml += "<li>No orders found in OpenMRS</li>";
                    } else {
                        for (var i = 0; i < data.openmrsOrders.length; i++) {
                            var ord = data.openmrsOrders[i];
                            omrsHtml += "<li><strong>" + ord.display + "</strong></li>";
                        }
                    }
                    omrsHtml += "</ul>";
                    document.getElementById("pvOpenmrsOrders").innerHTML = omrsHtml;

                    // OpenELIS samples
                    var elisHtml = "<ul style='padding-left: 20px; font-size: 13px;'>";
                    if (data.openelisSamples.length === 0) {
                        elisHtml += "<li style='color: #dc2626; font-weight: bold;'>No samples found in OpenELIS! <button class='sync-btn sync-btn-warning sync-btn-sm' onclick='rewindMarker()'>Rewind &amp; Ingest Now</button></li>";
                    } else {
                        for (var j = 0; j < data.openelisSamples.length; j++) {
                            var smp = data.openelisSamples[j];
                            elisHtml += "<li><span class='sync-badge sync-badge-success'>Sample #" + smp.sampleId + "</span> (" + smp.enteredDate + ")<br/><small>" + smp.tests + "</small></li>";
                        }
                    }
                    elisHtml += "</ul>";
                    document.getElementById("pvOpenelisSamples").innerHTML = elisHtml;
                } else {
                    document.getElementById("pvPatientHeader").innerText = "Verification Failed";
                    document.getElementById("pvOpenmrsOrders").innerHTML = "<span style='color: #dc2626;'>" + (data.error || data.message) + "</span>";
                    document.getElementById("pvOpenelisSamples").innerHTML = "";
                }
            }
        };
        xhr.send();
    }

    function loadRecentSamples() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", API_URL + "?action=getRecentSamples", true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    var tbody = document.getElementById("recentSamplesBody");
                    tbody.innerHTML = "";
                    if (data.samples.length === 0) {
                        tbody.innerHTML = "<tr><td colspan='7' style='text-align: center; color: #94a3b8;'>No samples found.</td></tr>";
                    } else {
                        for (var i = 0; i < data.samples.length; i++) {
                            var s = data.samples[i];
                            var tr = document.createElement("tr");
                            tr.innerHTML = 
                                "<td><strong>#" + s.sampleId + "</strong></td>" +
                                "<td>" + s.accessionNumber + "</td>" +
                                "<td>" + s.enteredDate + "</td>" +
                                "<td><span class='sync-badge sync-badge-info'>" + s.patientId + "</span></td>" +
                                "<td>" + s.patientName + "</td>" +
                                "<td style='max-width: 350px; font-size: 12px; color: #475569;'>" + s.testNames + "</td>" +
                                "<td><span class='sync-badge sync-badge-success'>" + s.totalTests + " tests</span></td>";
                            tbody.appendChild(tr);
                        }
                    }
                }
            }
        };
        xhr.send();
    }

    // Initial load
    refreshAll();
</script>
