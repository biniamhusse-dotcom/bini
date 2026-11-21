<%@ page language="java" contentType="text/html; charset=utf-8"
	import="us.mn.state.health.lims.common.util.SystemConfiguration,
	us.mn.state.health.lims.common.action.IActionConstants" %>
<%@ taglib uri="/tags/struts-bean" prefix="bean" %>
<%@ taglib uri="/tags/struts-html" prefix="html" %>
<%@ taglib uri="/tags/struts-logic" prefix="logic" %>
<%@ taglib uri="/tags/labdev-view" prefix="app" %>

<%
    String path = request.getContextPath();
    String basePath = path + "/";
%>

<link rel="stylesheet" type="text/css" href="<%=basePath%>css/openElisCore.css" />
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.cost-mgmt-container {
    padding: 16px 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    min-height: calc(100vh - 120px);
}
.cost-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
}
.cost-header h1 {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
}
.cost-stats-bar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}
.cost-stat-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 16px;
    min-width: 140px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.cost-stat-val {
    font-size: 20px;
    font-weight: 700;
    color: #0f766e;
}
.cost-stat-lbl {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
}
.cost-toolbar {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.cost-filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.cost-input {
    padding: 6px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    transition: border .15s;
}
.cost-input:focus {
    border-color: #0f766e;
}
.cost-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all .15s;
}
.cost-btn-primary {
    background: #0f766e;
    color: #fff;
}
.cost-btn-primary:hover {
    background: #115e59;
}
.cost-btn-secondary {
    background: #2563eb;
    color: #fff;
}
.cost-btn-secondary:hover {
    background: #1d4ed8;
}
.cost-btn-outline {
    background: #fff;
    border: 1px solid #cbd5e1;
    color: #475569;
}
.cost-btn-outline:hover {
    background: #f1f5f9;
}
.cost-table-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow: hidden;
}
.cost-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    text-align: left;
}
.cost-table th {
    background: #f1f5f9;
    padding: 10px 14px;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
}
.cost-table td {
    padding: 9px 14px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
}
.cost-table tr:hover {
    background: #f8fafc;
}
.badge-test {
    background: #e0f2fe;
    color: #0369a1;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
}
.badge-panel {
    background: #f3e8ff;
    color: #7e22ce;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
}
.badge-synced {
    background: #dcfce7;
    color: #15803d;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
}
.badge-pending {
    background: #fef3c7;
    color: #b45309;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
}
.price-input {
    width: 90px;
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-weight: 600;
    text-align: right;
}
.history-modal {
    display: none;
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(15,23,42,0.6);
    z-index: 9999;
    align-items: center;
    justify-content: center;
}
.history-modal.show {
    display: flex;
}
.history-dialog {
    background: #fff;
    border-radius: 8px;
    width: 850px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}
.history-header {
    padding: 14px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.history-body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
}
@keyframes cost-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.spin-icon { display: inline-block; animation: cost-spin 0.8s linear infinite; }
</style>

<div class="cost-mgmt-container">
    <div class="cost-header">
        <div>
            <h1>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f766e" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Test &amp; Panel Cost Management
            </h1>
            <p style="font-size:12px;color:#64748b;margin-top:2px">Synchronize and maintain laboratory test prices, panel package costs, and Odoo billing integration.</p>
        </div>
        <div style="display:flex;gap:8px">
            <button type="button" class="cost-btn cost-btn-outline" onclick="openHistoryModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Sync Audit History
            </button>
            <button type="button" class="cost-btn cost-btn-primary" onclick="syncOdooToOpenELIS()" id="btnSyncOdoo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                Sync Odoo → OpenELIS
            </button>
            <button type="button" class="cost-btn cost-btn-secondary" onclick="syncOpenELISToOdoo()" id="btnSyncOpenELIS">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
                Sync OpenELIS → Odoo
            </button>
        </div>
    </div>

    <div class="cost-stats-bar">
        <div class="cost-stat-card">
            <div class="cost-stat-val" id="statTotalItems">-</div>
            <div class="cost-stat-lbl">Total Items</div>
        </div>
        <div class="cost-stat-card">
            <div class="cost-stat-val" style="color:#0284c7" id="statTotalTests">-</div>
            <div class="cost-stat-lbl">Individual Tests</div>
        </div>
        <div class="cost-stat-card">
            <div class="cost-stat-val" style="color:#7e22ce" id="statTotalPanels">-</div>
            <div class="cost-stat-lbl">Panels &amp; Packages</div>
        </div>
        <div class="cost-stat-card">
            <div class="cost-stat-val" style="color:#16a34a" id="statSyncedOdoo">-</div>
            <div class="cost-stat-lbl">Matched with Odoo</div>
        </div>
    </div>

    <div class="cost-toolbar">
        <div class="cost-filter-group">
            <input type="text" id="costSearchInput" class="cost-input" placeholder="Search test name, department, code..." style="width:260px" oninput="onSearchKey()" onkeyup="if(event.key==='Enter')loadCostList()">
            <select id="costTypeFilter" class="cost-input" onchange="loadCostList()">
                <option value="ALL">All Types</option>
                <option value="TEST">Tests Only</option>
                <option value="PANEL">Panels Only</option>
            </select>
            <select id="costStatusFilter" class="cost-input" onchange="loadCostList()">
                <option value="ALL">All Statuses</option>
                <option value="SYNCED">Synced Only</option>
                <option value="PENDING">Pending Sync</option>
            </select>
            <button type="button" class="cost-btn cost-btn-outline" onclick="loadCostList()">Filter</button>
        </div>
        <div style="font-size:12px;color:#64748b" id="costShowingCount">Loading...</div>
    </div>

    <div class="cost-table-card">
        <table class="cost-table">
            <thead>
                <tr>
                    <th style="width:75px">Type</th>
                    <th>Name</th>
                    <th style="width:130px">Code / LOINC</th>
                    <th style="width:180px">Department</th>
                    <th style="width:140px;text-align:right">Cost (ETB)</th>
                    <th style="width:110px">Odoo Product</th>
                    <th style="width:90px">Status</th>
                    <th style="width:140px">Last Synced</th>
                    <th style="width:125px;text-align:center">Action</th>
                </tr>
            </thead>
            <tbody id="costTableBody">
                <tr><td colspan="9" style="text-align:center;padding:30px;color:#64748b">Loading tests and panel costs...</td></tr>
            </tbody>
        </table>
    </div>
</div>

<!-- History Modal -->
<div id="costHistoryModal" class="history-modal">
    <div class="history-dialog">
        <div class="history-header">
            <h3 style="font-size:16px;font-weight:700;color:#0f172a">Synchronization Audit History</h3>
            <button type="button" onclick="closeHistoryModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#64748b">&times;</button>
        </div>
        <div class="history-body">
            <table class="cost-table" style="font-size:12px">
                <thead>
                    <tr>
                        <th>Date &amp; Time</th>
                        <th>Direction</th>
                        <th>Type</th>
                        <th>Synced</th>
                        <th>Failed</th>
                        <th>User</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody id="historyTableBody">
                    <tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b">Loading history...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
function getApiUrl(actionAndQuery) {
    return '<%=basePath%>pages/cost/costSyncApi.jsp?' + actionAndQuery;
}

function fetchApi(actionAndQuery) {
    var primaryUrl = '<%=basePath%>pages/cost/costSyncApi.jsp?' + actionAndQuery;
    var fallbackUrl = '<%=basePath%>cost/costSyncApi.jsp?' + actionAndQuery;
    return fetch(primaryUrl).then(function(res) {
        if (!res.ok) {
            return fetch(fallbackUrl).then(function(r2) { return r2.json(); });
        }
        return res.json();
    }).catch(function() {
        return fetch(fallbackUrl).then(function(r2) { return r2.json(); });
    });
}

var searchDebounceTimer = null;
function onSearchKey() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(loadCostList, 300);
}

function loadCostList() {
    var search = document.getElementById('costSearchInput').value;
    var type = document.getElementById('costTypeFilter').value;
    var status = document.getElementById('costStatusFilter').value;

    document.getElementById('costShowingCount').textContent = 'Loading...';
    var query = 'action=listCosts&search=' + encodeURIComponent(search) + '&type=' + encodeURIComponent(type) + '&status=' + encodeURIComponent(status);
    
    fetchApi(query)
        .then(function(data) {
            if (!data.success) {
                document.getElementById('costTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#dc2626">Error: ' + escapeHtml(data.error || 'Failed to load costs') + '</td></tr>';
                document.getElementById('costShowingCount').textContent = 'Error loading items';
                return;
            }
            renderCostTable(data.items);
        })
        .catch(function(err) {
            console.error(err);
            document.getElementById('costTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#dc2626">Network error loading costs: ' + escapeHtml(err.message || err) + '</td></tr>';
            document.getElementById('costShowingCount').textContent = 'Connection error';
        });
}

function renderCostTable(items) {
    var tbody = document.getElementById('costTableBody');
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#64748b">No matching test or panel items found.</td></tr>';
        document.getElementById('costShowingCount').textContent = 'Showing 0 items';
        return;
    }

    var totalTests = 0, totalPanels = 0, syncedOdoo = 0;
    var html = '';

    items.forEach(function(item) {
        if (item.itemType === 'TEST') totalTests++; else totalPanels++;
        if (item.odooProductId > 0) syncedOdoo++;

        var typeBadge = item.itemType === 'PANEL' ? '<span class="badge-panel">PANEL</span>' : '<span class="badge-test">TEST</span>';
        var statusBadge = item.syncStatus === 'SYNCED' ? ('<span class="badge-synced" id="status_' + item.id + '">✓ SYNCED</span>') : ('<span class="badge-pending" id="status_' + item.id + '">PENDING</span>');
        var odooIdDisplay = item.odooProductId > 0 ? ('<span style="font-weight:600;color:#0f766e" id="odoo_id_' + item.id + '">#' + item.odooProductId + '</span>') : ('<span style="color:#94a3b8" id="odoo_id_' + item.id + '">Unmatched</span>');

        html += '<tr>' +
            '<td>' + typeBadge + '</td>' +
            '<td style="font-weight:600;color:#0f172a">' + escapeHtml(item.itemName) + '</td>' +
            '<td style="color:#64748b;font-family:monospace">' + escapeHtml(item.itemCode || '-') + '</td>' +
            '<td>' + escapeHtml(item.department || 'General') + '</td>' +
            '<td style="text-align:right">' +
                '<input type="number" step="0.01" min="0" class="price-input" id="price_' + item.id + '" value="' + (item.cost || 0).toFixed(2) + '">' +
            '</td>' +
            '<td>' + odooIdDisplay + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td style="font-size:11px;color:#64748b" id="sync_date_' + item.id + '">' + (item.lastSyncDate ? item.lastSyncDate.substring(0, 19) : '-') + '</td>' +
            '<td style="text-align:center">' +
                '<div style="display:inline-flex;gap:4px;align-items:center;justify-content:center;">' +
                    '<button type="button" class="cost-btn cost-btn-outline" style="padding:4px 7px;font-size:11px" onclick="saveSinglePrice(' + item.id + ')" title="Save Price">💾</button>' +
                    '<button type="button" class="cost-btn cost-btn-secondary" style="padding:4px 8px;font-size:11px;font-weight:600;gap:3px" id="sync_btn_' + item.id + '" onclick="syncSingleItem(' + item.id + ', this)" title="Sync this test with Odoo">🔄 Sync</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('costShowingCount').textContent = 'Showing ' + items.length + ' items';
    document.getElementById('statTotalItems').textContent = items.length;
    document.getElementById('statTotalTests').textContent = totalTests;
    document.getElementById('statTotalPanels').textContent = totalPanels;
    document.getElementById('statSyncedOdoo').textContent = syncedOdoo;
}

function saveSinglePrice(id) {
    var inp = document.getElementById('price_' + id);
    if (!inp) return;
    var newCost = parseFloat(inp.value);
    if (isNaN(newCost) || newCost < 0) {
        alert('Please enter a valid non-negative cost.');
        return;
    }

    fetchApi('action=updateSingleCost&id=' + id + '&cost=' + newCost)
        .then(function(data) {
            if (data.success) {
                inp.style.borderColor = '#16a34a';
                setTimeout(function() { inp.style.borderColor = '#cbd5e1'; }, 1000);
            } else {
                alert('Update failed: ' + data.error);
            }
        });
}

function syncSingleItem(id, btn) {
    if (!btn) btn = document.getElementById('sync_btn_' + id);
    var origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spin-icon">⏳</span> Syncing...';
    }

    var inp = document.getElementById('price_' + id);
    var extraCostParam = '';
    if (inp && !isNaN(parseFloat(inp.value))) {
        extraCostParam = '&cost=' + encodeURIComponent(parseFloat(inp.value));
    }

    fetchApi('action=syncSingleItem&id=' + id + extraCostParam)
        .then(function(data) {
            if (btn) {
                btn.disabled = false;
                if (data.success) {
                    btn.innerHTML = '✓ Synced';
                    btn.style.background = '#16a34a';
                    btn.style.color = '#fff';
                    setTimeout(function() {
                        btn.innerHTML = origHtml || '🔄 Sync';
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 1800);
                } else {
                    btn.innerHTML = origHtml || '🔄 Sync';
                }
            }

            if (data.success) {
                if (data.odooProductId > 0) {
                    var odooEl = document.getElementById('odoo_id_' + id);
                    if (odooEl) {
                        odooEl.outerHTML = '<span style="font-weight:600;color:#0f766e" id="odoo_id_' + id + '">#' + data.odooProductId + '</span>';
                    }
                }
                var statusEl = document.getElementById('status_' + id);
                if (statusEl) {
                    statusEl.outerHTML = '<span class="badge-synced" id="status_' + id + '">✓ SYNCED</span>';
                }
                var syncDateEl = document.getElementById('sync_date_' + id);
                if (syncDateEl && data.lastSyncDate) {
                    syncDateEl.textContent = data.lastSyncDate;
                }
                if (inp && typeof data.cost === 'number') {
                    inp.value = data.cost.toFixed(2);
                    inp.style.borderColor = '#16a34a';
                    setTimeout(function() { inp.style.borderColor = '#cbd5e1'; }, 1200);
                }
            } else {
                alert('Sync failed: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(function(err) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml || '🔄 Sync';
            }
            alert('Sync error: ' + (err.message || err));
        });
}

function syncOdooToOpenELIS() {
    var btn = document.getElementById('btnSyncOdoo');
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    fetchApi('action=syncOdooToOpenELIS')
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Sync Odoo → OpenELIS';
            alert(data.message || (data.success ? 'Sync completed.' : data.error));
            loadCostList();
        })
        .catch(function(e) {
            btn.disabled = false;
            btn.textContent = 'Sync Odoo → OpenELIS';
            alert('Sync error: ' + e);
        });
}

function syncOpenELISToOdoo() {
    var btn = document.getElementById('btnSyncOpenELIS');
    btn.disabled = true;
    btn.textContent = 'Pushing...';

    fetchApi('action=syncOpenELISToOdoo')
        .then(function(data) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg> Sync OpenELIS → Odoo';
            alert(data.message || (data.success ? 'Sync completed.' : data.error));
            loadCostList();
        })
        .catch(function(e) {
            btn.disabled = false;
            btn.textContent = 'Sync OpenELIS → Odoo';
            alert('Sync error: ' + e);
        });
}

function openHistoryModal() {
    document.getElementById('costHistoryModal').classList.add('show');
    fetchApi('action=getSyncHistory')
        .then(function(data) {
            var tbody = document.getElementById('historyTableBody');
            if (!data.logs || data.logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b">No sync logs recorded yet.</td></tr>';
                return;
            }
            var h = '';
            data.logs.forEach(function(l) {
                h += '<tr>' +
                    '<td>' + (l.createdAt ? l.createdAt.substring(0, 19) : '-') + '</td>' +
                    '<td><span style="font-weight:600">' + escapeHtml(l.direction) + '</span></td>' +
                    '<td>' + escapeHtml(l.syncType) + '</td>' +
                    '<td style="color:#16a34a;font-weight:600">' + l.itemsSynced + '</td>' +
                    '<td style="color:' + (l.itemsFailed > 0 ? '#dc2626' : '#64748b') + '">' + l.itemsFailed + '</td>' +
                    '<td>' + escapeHtml(l.performedBy || 'system') + '</td>' +
                    '<td style="font-size:11px;color:#64748b">' + escapeHtml(l.details || '') + '</td>' +
                '</tr>';
            });
            tbody.innerHTML = h;
        });
}

function closeHistoryModal() {
    document.getElementById('costHistoryModal').classList.remove('show');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', function() {
    loadCostList();
});
</script>
