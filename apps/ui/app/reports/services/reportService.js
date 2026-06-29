'use strict';

angular.module('bahmni.reports')
    .service('reportService', ['appService', '$bahmniCookieStore', '$http', function (appService, $bahmniCookieStore, $http) {
        var paperSize = appService.getAppDescriptor().getConfigValue("paperSize");
        var appName = appService.getAppName() ? appService.getAppName() : "reports";
        var currentDate = new Date();
        var availableFormats = {
            "CSV": "text/csv",
            "HTML": "text/html",
            "EXCEL": "application/vnd.ms-excel",
            "PDF": "application/pdf",
            "CUSTOM EXCEL": "application/vnd.ms-excel-custom",
            "ODS": "application/vnd.oasis.opendocument.spreadsheet"
        };
        var avaialbleDateRange = {
            "Today": currentDate,
            "This Month": new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
            "Previous Month": new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
            "This Quarter": new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1),
            "This Year": new Date(currentDate.getFullYear(), 0, 1),
            "Last 7 days": new Date(new Date().setDate(currentDate.getDate() - 7)),
            "Last 30 days": new Date(new Date().setDate(currentDate.getDate() - 30))
        };

        var scheduleReport = function (report) {
            var url = Bahmni.Common.Constants.reportsUrl + "/schedule";
            url = (url + "?name={0}&startDate={1}&endDate={2}&responseType={3}&paperSize={4}&appName={5}&userName={6}").format(report.name, report.startDate, report.stopDate, report.responseType, paperSize, appName, currentUser());
            if (report.reportTemplateLocation && report.responseType == 'application/vnd.ms-excel-custom') {
                url = (url + "&macroTemplateLocation=" + report.reportTemplateLocation);
            }
            return $http.get(url);
        };

        var currentUser = function () {
            return $bahmniCookieStore.get(Bahmni.Common.Constants.currentUser);
        };

        var getScheduledReports = function () {
            var url = Bahmni.Common.Constants.reportsUrl + "/getReports?user={0}";
            url = url.format(currentUser());
            return $http.get(url);
        };
        var getAvailableFormats = function () {
            return availableFormats;
        };
        var getMimeTypeForFormat = function (format) {
            return availableFormats[format];
        };
        var getFormatForMimeType = function (mimeType) {
            return _.findKey(availableFormats, function (value) {
                if (value === mimeType) {
                    return true;
                }
            });
        };
        var getAvailableDateRange = function () {
            return avaialbleDateRange;
        };
        var deleteReport = function (id) {
            var url = Bahmni.Common.Constants.reportsUrl + "/delete/{0}";
            url = url.format(id);
            return $http.get(url);
        };

        var escapeHtml = function (str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        var ethiopianMonthNames = ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Ter', 'Yekatit', 'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'];

        var gregorianToEthiopian = function (gYear, gMonth, gDay) {
            var monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            var isGregLeap = (gYear % 4 === 0 && gYear % 100 !== 0) || gYear % 400 === 0;
            if (isGregLeap) monthDays[1] = 29;
            var ethNewYearDay = isGregLeap ? 12 : 11;
            var ethYear, daysSinceNewYear;
            if (gMonth > 9 || (gMonth === 9 && gDay >= ethNewYearDay)) {
                ethYear = gYear - 7;
                if (gMonth === 9) {
                    daysSinceNewYear = gDay - ethNewYearDay;
                } else {
                    daysSinceNewYear = 30 - ethNewYearDay;
                    for (var i = 9; i < gMonth - 1; i++) {
                        daysSinceNewYear += monthDays[i];
                    }
                    daysSinceNewYear += gDay;
                }
            } else {
                ethYear = gYear - 8;
                var prevIsLeap = ((gYear - 1) % 4 === 0 && (gYear - 1) % 100 !== 0) || (gYear - 1) % 400 === 0;
                var prevEthNewYearDay = prevIsLeap ? 12 : 11;
                daysSinceNewYear = 30 - prevEthNewYearDay + 92;
                var dayOfYear = 0;
                for (var i = 0; i < gMonth - 1; i++) {
                    dayOfYear += monthDays[i];
                }
                dayOfYear += gDay;
                daysSinceNewYear += dayOfYear;
            }
            var ethMonth = Math.floor(daysSinceNewYear / 30) + 1;
            var ethDay = daysSinceNewYear % 30 + 1;
            if (ethMonth > 13) ethMonth = 13;
            if (ethMonth === 13) {
                var isEthLeap = ethYear % 4 === 3;
                if (ethDay > (isEthLeap ? 6 : 5)) {
                    ethDay = 1;
                    ethMonth = 1;
                    ethYear++;
                }
            }
            return { year: ethYear, month: ethMonth, day: ethDay, monthName: ethiopianMonthNames[ethMonth - 1] };
        };

        var isMetadataRow = function (row) {
            var text = row.join(' ').toLowerCase().trim();
            if (row.length <= 1) return true;
            if (text.indexOf('report generated') >= 0) return true;
            if (text.indexOf('from ') >= 0 && text.indexOf(' to ') >= 0) return true;
            if (text.indexOf('mru report') >= 0 || text.indexOf('mrn report') >= 0) return true;
            if (text.indexOf('report') === 0) return true;
            if (text.indexOf('icd-11') >= 0) return true;
            if (text.indexOf('disease report') >= 0) return true;
            if (text.indexOf('disaggregated') >= 0) return true;
            if (text.indexOf('includes only') >= 0) return true;
            if (text.indexOf('primary cases') >= 0) return true;
            if (/^\d{4}-\d{2}-\d{2}/.test(text) && row.length <= 3) return true;
            var nonEmptyCount = 0;
            for (var i = 0; i < row.length; i++) {
                if (row[i].trim() !== '') nonEmptyCount++;
            }
            if (nonEmptyCount <= 2 && row.length > 3) return true;
            return false;
        };

        var parseReportCsv = function (csvText) {
            var lines = csvText.split('\n');
            var parsedRows = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var row = [];
                var inQuote = false;
                var cell = '';
                for (var j = 0; j < line.length; j++) {
                    var ch = line[j];
                    if (ch === '"') {
                        inQuote = !inQuote;
                    } else if (ch === ',' && !inQuote) {
                        row.push(cell.trim());
                        cell = '';
                    } else {
                        cell += ch;
                    }
                }
                row.push(cell.trim());
                if (row.length > 0) {
                    parsedRows.push(row);
                }
            }

            var headerIdx = -1;
            for (var k = 0; k < parsedRows.length; k++) {
                if (isMetadataRow(parsedRows[k])) continue;
                if (parsedRows[k].length >= 3) {
                    headerIdx = k;
                    break;
                }
            }

            if (headerIdx < 0) {
                for (var m = 0; m < parsedRows.length; m++) {
                    var rowText = parsedRows[m].join(' ').toLowerCase();
                    if ((rowText.indexOf('location') >= 0 || rowText.indexOf('visit') >= 0) &&
                        (rowText.indexOf('patient') >= 0 || rowText.indexOf('payment') >= 0 || rowText.indexOf('service') >= 0 || rowText.indexOf('gender') >= 0)) {
                        headerIdx = m;
                        break;
                    }
                }
            }

            if (headerIdx < 0) headerIdx = 0;

            var headers = parsedRows[headerIdx];
            var dataRows = [];
            for (var n = headerIdx + 1; n < parsedRows.length; n++) {
                if (!isMetadataRow(parsedRows[n]) && parsedRows[n].length >= 2) {
                    dataRows.push(parsedRows[n]);
                }
            }

            return { headers: headers, rows: dataRows };
        };

        var formatCellValue = function (cell) {
            if (!cell) return '';
            var trimmed = cell.trim();
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                var parts = trimmed.split('-');
                var greg = parts[2] + ' ' + months[parseInt(parts[1]) - 1] + ' ' + parts[0];
                var eth = gregorianToEthiopian(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
                return greg + ' <span class="eth-date">(' + eth.day + ' ' + eth.monthName + ' ' + eth.year + ' E.C.)</span>';
            }
            if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) {
                var datePart = trimmed.split(' ')[0];
                var parts = datePart.split('-');
                var greg = parts[2] + ' ' + months[parseInt(parts[1]) - 1] + ' ' + parts[0];
                var eth = gregorianToEthiopian(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
                return greg + ' <span class="eth-date">(' + eth.day + ' ' + eth.monthName + ' ' + eth.year + ' E.C.)</span>';
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
                var parts = trimmed.split('/');
                var greg = parts[0] + ' ' + months[parseInt(parts[1]) - 1] + ' ' + parts[2];
                var eth = gregorianToEthiopian(parseInt(parts[2]), parseInt(parts[1]), parseInt(parts[0]));
                return greg + ' <span class="eth-date">(' + eth.day + ' ' + eth.monthName + ' ' + eth.year + ' E.C.)</span>';
            }
            var ddmmyyyyMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
            if (ddmmyyyyMatch) {
                var day = parseInt(ddmmyyyyMatch[1]);
                var monStr = ddmmyyyyMatch[2];
                var year = parseInt(ddmmyyyyMatch[3]);
                var monIdx = -1;
                for (var mi = 0; mi < months.length; mi++) {
                    if (months[mi].toLowerCase() === monStr.toLowerCase()) { monIdx = mi; break; }
                }
                if (monIdx >= 0) {
                    var eth = gregorianToEthiopian(year, monIdx + 1, day);
                    return day + ' ' + months[monIdx] + ' ' + year + ' <span class="eth-date">(' + eth.day + ' ' + eth.monthName + ' ' + eth.year + ' E.C.)</span>';
                }
            }
            var ddmmyyyyDotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            if (ddmmyyyyDotMatch) {
                var day = parseInt(ddmmyyyyDotMatch[1]);
                var mon = parseInt(ddmmyyyyDotMatch[2]);
                var year = parseInt(ddmmyyyyDotMatch[3]);
                if (mon >= 1 && mon <= 12) {
                    var eth = gregorianToEthiopian(year, mon, day);
                    return day + ' ' + months[mon - 1] + ' ' + year + ' <span class="eth-date">(' + eth.day + ' ' + eth.monthName + ' ' + eth.year + ' E.C.)</span>';
                }
            }
            return trimmed;
        };

        var buildProfessionalReport = function (csvText, report, startDate, endDate) {
            var parsed = parseReportCsv(csvText);
            var headers = parsed.headers;
            var dataRows = parsed.rows;

            if (headers.length === 0 || dataRows.length === 0) {
                return '<html><body><p>No data available for this report.</p></body></html>';
            }

            var grandTotal = 0;
            var numColIdx = headers.findIndex(function (h) {
                return h.toLowerCase().indexOf('patient') >= 0 || h.toLowerCase().indexOf('count') >= 0;
            });

            for (var i = 0; i < dataRows.length; i++) {
                var row = dataRows[i];
                var isTotal = row.some(function (cell) {
                    return cell.toUpperCase().indexOf('TOTAL') >= 0 || cell.toUpperCase().indexOf('GRAND') >= 0;
                });
                if (isTotal && numColIdx >= 0 && row[numColIdx]) {
                    grandTotal = parseInt(row[numColIdx].replace(/,/g, '')) || 0;
                }
            }
            if (grandTotal === 0) {
                dataRows.forEach(function (row) {
                    if (numColIdx >= 0 && row[numColIdx]) {
                        grandTotal += parseInt(row[numColIdx].replace(/,/g, '')) || 0;
                    }
                });
            }

            var filteredDataRows = dataRows.filter(function (row) {
                return !row.some(function (cell) {
                    return cell.toUpperCase().indexOf('TOTAL') >= 0 || cell.toUpperCase().indexOf('GRAND') >= 0;
                });
            });

            var uniqueServiceUnits = {};
            var uniqueLocations = {};
            filteredDataRows.forEach(function (row) {
                headers.forEach(function (h, idx) {
                    var hl = h.toLowerCase();
                    if (hl.indexOf('service') >= 0 || hl.indexOf('unit') >= 0 || hl.indexOf('visit type') >= 0) {
                        if (row[idx]) uniqueServiceUnits[row[idx]] = true;
                    }
                    if (hl.indexOf('location') >= 0) {
                        if (row[idx]) uniqueLocations[row[idx]] = true;
                    }
                });
            });

            var reportDate = new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            var reportTime = new Date().toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            var tableHeadersHtml = '';
            headers.forEach(function (h) {
                tableHeadersHtml += '<th onclick="sortTable(this)">' + escapeHtml(h) + '<span class="sort-icon"></span></th>';
            });

            var numColIdx = headers.findIndex(function (h) {
                return h.toLowerCase().indexOf('patient') >= 0 || h.toLowerCase().indexOf('count') >= 0;
            });

            var tableRowsHtml = '';
            filteredDataRows.forEach(function (row, idx) {
                var rowClass = idx % 2 === 0 ? 'even' : 'odd';
                tableRowsHtml += '<tr class="' + rowClass + '" data-search="' + escapeHtml(row.join(' ').toLowerCase()) + '">';
                row.forEach(function (cell, cellIdx) {
                    var trimmed = (cell || '').trim();
                    var isDateCol = (headers[cellIdx] || '').toLowerCase().indexOf('date') >= 0;
                    var isDateValue = /^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(trimmed) || /^\d{1,2}[-\/\.](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/\.]\d{4}/i.test(trimmed) || /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i.test(trimmed);
                    var isNumeric = !isDateCol && !isDateValue && cellIdx === numColIdx;
                    var cellClass = isNumeric ? 'numeric' : '';
                    var cellContent;
                    if (isDateCol || isDateValue) {
                        cellContent = formatCellValue(cell);
                    } else {
                        var displayVal = formatCellValue(cell);
                        cellContent = isNumeric ? parseInt(cell.replace(/,/g, '')).toLocaleString() : escapeHtml(displayVal);
                    }
                    tableRowsHtml += '<td class="' + cellClass + '">' + cellContent + '</td>';
                });
                tableRowsHtml += '</tr>';
            });

            var locationFilterHtml = '<option value="">All Locations</option>';
            Object.keys(uniqueLocations).sort().forEach(function (loc) {
                locationFilterHtml += '<option value="' + escapeHtml(loc) + '">' + escapeHtml(loc) + '</option>';
            });

            var serviceUnitFilterHtml = '<option value="">All Service Units</option>';
            Object.keys(uniqueServiceUnits).sort().forEach(function (su) {
                serviceUnitFilterHtml += '<option value="' + escapeHtml(su) + '">' + escapeHtml(su) + '</option>';
            });

            var formattedReport = '<!DOCTYPE html>' +
            '<html lang="en">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
            '<title>' + escapeHtml(report.name) + '</title>' +
            '<style>' +
            '* { margin: 0; padding: 0; box-sizing: border-box; }' +
            'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; color: #333; line-height: 1.6; }' +
            '.report-container { max-width: 1200px; margin: 0 auto; padding: 24px; }' +
            '.report-header { background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%); color: white; padding: 32px 40px; border-radius: 12px 12px 0 0; box-shadow: 0 4px 20px rgba(26,35,126,0.3); }' +
            '.report-header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.5px; }' +
            '.report-header .subtitle { font-size: 14px; opacity: 0.9; margin-bottom: 4px; }' +
            '.report-header .generated-info { font-size: 12px; opacity: 0.75; margin-top: 12px; display: flex; gap: 24px; }' +
            '.report-header .generated-info span { display: inline-flex; align-items: center; gap: 6px; }' +

            '.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 24px 40px; background: white; border-bottom: 1px solid #e0e0e0; }' +
            '.stat-card { background: #f8f9ff; border-radius: 8px; padding: 16px 20px; border-left: 4px solid #3949ab; }' +
            '.stat-card .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; }' +
            '.stat-card .stat-value { font-size: 28px; font-weight: 700; color: #1a237e; margin-top: 4px; }' +
            '.stat-card .stat-detail { font-size: 11px; color: #999; margin-top: 2px; }' +

            '.controls-bar { display: flex; flex-wrap: wrap; gap: 12px; padding: 20px 40px; background: white; border-bottom: 1px solid #e0e0e0; align-items: center; }' +
            '.controls-bar .filter-group { display: flex; flex-direction: column; gap: 4px; }' +
            '.controls-bar .filter-group label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; }' +
            '.controls-bar input, .controls-bar select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; outline: none; transition: border-color 0.2s; }' +
            '.controls-bar input:focus, .controls-bar select:focus { border-color: #3949ab; box-shadow: 0 0 0 3px rgba(57,73,171,0.1); }' +
            '.controls-bar input[type="text"] { min-width: 240px; }' +
            '.controls-bar select { min-width: 180px; }' +

            '.btn-group { display: flex; gap: 8px; margin-left: auto; }' +
            '.btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.3px; }' +
            '.btn-print { background: #3949ab; color: white; }' +
            '.btn-print:hover { background: #283593; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(57,73,171,0.3); }' +
            '.btn-csv { background: #2e7d32; color: white; }' +
            '.btn-csv:hover { background: #1b5e20; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(46,125,50,0.3); }' +
            '.btn-reset { background: #e53935; color: white; }' +
            '.btn-reset:hover { background: #c62828; transform: translateY(-1px); }' +

            '.table-container { background: white; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }' +
            '.table-wrapper { overflow-x: auto; }' +
            'table { width: 100%; border-collapse: collapse; font-size: 13px; }' +
            'thead th { background: #283593; color: white; padding: 14px 16px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 10; cursor: pointer; user-select: none; white-space: nowrap; }' +
            'thead th:hover { background: #1a237e; }' +
            'thead th .sort-icon { margin-left: 6px; font-size: 10px; opacity: 0.6; }' +
            'thead th.sorted-asc .sort-icon::after { content: "\\25B2"; opacity: 1; }' +
            'thead th.sorted-desc .sort-icon::after { content: "\\25BC"; opacity: 1; }' +
            'thead th:not(.sorted-asc):not(.sorted-desc) .sort-icon::after { content: "\\25C6"; }' +
            'tbody td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; }' +
            'tbody tr.even { background: #fafbff; }' +
            'tbody tr.odd { background: white; }' +
            'tbody tr:hover { background: #e8eaf6; transition: background 0.15s; }' +
            'tbody td.numeric { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }' +
            'tbody tr.hidden { display: none; }' +

            '.table-footer { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8f9ff; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }' +
            '.eth-date { font-size: 11px; color: #6a1b9a; font-style: italic; white-space: nowrap; }' +

            '@media print {' +
            '  body { background: white; }' +
            '  .controls-bar { display: none !important; }' +
            '  .report-container { padding: 0; }' +
            '  .report-header { box-shadow: none; border-radius: 0; }' +
            '  .table-container { box-shadow: none; border-radius: 0; }' +
            '  thead th { background: #283593 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
            '  tbody tr.even { background: #fafbff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
            '  .stat-card { background: #f8f9ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
            '  .table-footer { display: none; }' +
            '  @page { margin: 1cm; size: landscape; }' +
            '}' +
            '</style>' +
            '</head>' +
            '<body>' +
            '<div class="report-container">' +

            '<div class="report-header">' +
            '  <h1>' + escapeHtml(report.name) + '</h1>' +
            '  <div class="subtitle">Medical Record Unit &mdash; Patient Visit Summary</div>' +
            '  <div class="generated-info">' +
            '    <span>&#128197; From: <strong>' + escapeHtml(startDate) + '</strong></span>' +
            '    <span>&#128197; To: <strong>' + escapeHtml(endDate) + '</strong></span>' +
            '    <span>&#128336; Generated: <strong>' + reportDate + ' at ' + reportTime + '</strong></span>' +
            '  </div>' +
            '</div>' +

            '<div class="stats-row">' +
            '  <div class="stat-card">' +
            '    <div class="stat-label">Total Patients</div>' +
            '    <div class="stat-value">' + grandTotal.toLocaleString() + '</div>' +
            '    <div class="stat-detail">Unique patients in date range</div>' +
            '  </div>' +
            '  <div class="stat-card">' +
            '    <div class="stat-label">Service Units</div>' +
            '    <div class="stat-value">' + Object.keys(uniqueServiceUnits).length + '</div>' +
            '    <div class="stat-detail">Active visit types</div>' +
            '  </div>' +
            '  <div class="stat-card">' +
            '    <div class="stat-label">Locations</div>' +
            '    <div class="stat-value">' + Object.keys(uniqueLocations).length + '</div>' +
            '    <div class="stat-detail">Unique visit locations</div>' +
            '  </div>' +
            '  <div class="stat-card">' +
            '    <div class="stat-label">Avg. Per Unit</div>' +
            '    <div class="stat-value">' + (Object.keys(uniqueServiceUnits).length > 0 ? Math.round(grandTotal / Object.keys(uniqueServiceUnits).length).toLocaleString() : '0') + '</div>' +
            '    <div class="stat-detail">Patients per service unit</div>' +
            '  </div>' +
            '</div>' +

            '<div class="controls-bar">' +
            '  <div class="filter-group">' +
            '    <label>Search</label>' +
            '    <input type="text" id="searchInput" placeholder="Search by name, location, unit..." oninput="filterTable()">' +
            '  </div>' +
            '  <div class="filter-group">' +
            '    <label>Location</label>' +
            '    <select id="locationFilter" onchange="filterTable()">' + locationFilterHtml + '</select>' +
            '  </div>' +
            '  <div class="filter-group">' +
            '    <label>Service Unit</label>' +
            '    <select id="serviceUnitFilter" onchange="filterTable()">' + serviceUnitFilterHtml + '</select>' +
            '  </div>' +
            '  <div class="btn-group">' +
            '    <button class="btn btn-reset" onclick="resetFilters()">&#8634; Reset</button>' +
            '    <button class="btn btn-csv" onclick="exportCSV()">&#128229; CSV</button>' +
            '    <button class="btn btn-print" onclick="window.print()">&#128424; Print</button>' +
            '  </div>' +
            '</div>' +

            '<div class="table-container">' +
            '  <div class="table-wrapper">' +
            '    <table id="reportTable">' +
            '      <thead><tr>' + tableHeadersHtml + '</tr></thead>' +
            '      <tbody>' + tableRowsHtml + '</tbody>' +
            '    </table>' +
            '  </div>' +
            '  <div class="table-footer">' +
            '    <span class="record-count" id="visibleCount">' + filteredDataRows.length + '</span> records displayed' +
            '    <span>Showing all filtered results</span>' +
            '  </div>' +
            '</div>' +

            '</div>' +

            '<script>' +
            'function filterTable() {' +
            '  var search = document.getElementById("searchInput").value.toLowerCase();' +
            '  var location = document.getElementById("locationFilter").value;' +
            '  var unit = document.getElementById("serviceUnitFilter").value;' +
            '  var rows = document.querySelectorAll("#reportTable tbody tr");' +
            '  var visible = 0;' +
            '  rows.forEach(function(row) {' +
            '    var cells = row.querySelectorAll("td");' +
            '    var rowText = row.getAttribute("data-search") || "";' +
            '    var matchSearch = !search || rowText.indexOf(search) >= 0;' +
            '    var matchLocation = !location || (cells[0] && cells[0].textContent.trim() === location);' +
            '    var matchUnit = !unit || (cells[1] && cells[1].textContent.trim() === unit);' +
            '    if (cells.length <= 1) { matchLocation = true; matchUnit = true; }' +
            '    if (matchSearch && matchLocation && matchUnit) {' +
            '      row.classList.remove("hidden");' +
            '      visible++;' +
            '    } else {' +
            '      row.classList.add("hidden");' +
            '    }' +
            '  });' +
            '  document.getElementById("visibleCount").textContent = visible;' +
            '}' +
            'function resetFilters() {' +
            '  document.getElementById("searchInput").value = "";' +
            '  document.getElementById("locationFilter").value = "";' +
            '  document.getElementById("serviceUnitFilter").value = "";' +
            '  filterTable();' +
            '}' +
            'var sortDirection = {};' +
            'function sortTable(th) {' +
            '  var table = document.getElementById("reportTable");' +
            '  var tbody = table.querySelector("tbody");' +
            '  var colIdx = Array.from(th.parentNode.children).indexOf(th);' +
            '  var dir = sortDirection[colIdx] === "asc" ? "desc" : "asc";' +
            '  sortDirection = {};' +
            '  sortDirection[colIdx] = dir;' +
            '  table.querySelectorAll("thead th").forEach(function(h) { h.className = ""; });' +
            '  th.className = dir === "asc" ? "sorted-asc" : "sorted-desc";' +
            '  var rows = Array.from(tbody.querySelectorAll("tr"));' +
            '  rows.sort(function(a, b) {' +
            '    var aVal = a.children[colIdx] ? a.children[colIdx].textContent.trim() : "";' +
            '    var bVal = b.children[colIdx] ? b.children[colIdx].textContent.trim() : "";' +
            '    var aNum = parseFloat(aVal.replace(/[^\\d.-]/g, ""));' +
            '    var bNum = parseFloat(bVal.replace(/[^\\d.-]/g, ""));' +
            '    if (!isNaN(aNum) && !isNaN(bNum)) {' +
            '      return dir === "asc" ? aNum - bNum : bNum - aNum;' +
            '    }' +
            '    return dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);' +
            '  });' +
            '  rows.forEach(function(r) { tbody.appendChild(r); });' +
            '}' +
            'function exportCSV() {' +
            '  var table = document.getElementById("reportTable");' +
            '  var rows = table.querySelectorAll("tr:not(.hidden)");' +
            '  var titleEl = document.querySelector(".report-header h1");' +
            '  var title = titleEl ? titleEl.textContent.trim() : "";' +
            '  var infoEls = document.querySelectorAll(".report-header .generated-info span");' +
            '  var dateInfo = "";' +
            '  infoEls.forEach(function(s) { dateInfo += s.textContent.trim() + "  "; });' +
            '  var headers = [];' +
            '  var ths = table.querySelectorAll("thead th");' +
            '  ths.forEach(function(th) { headers.push(th.textContent.trim()); });' +
            '  var colWidths = [];' +
            '  headers.forEach(function(h) { colWidths.push(Math.max(h.length + 2, 16)); });' +
            '  rows.forEach(function(row) {' +
            '    var cells = row.querySelectorAll("td");' +
            '    cells.forEach(function(cell, ci) {' +
            '      var len = cell.textContent.trim().length + 2;' +
            '      if (len > colWidths[ci]) colWidths[ci] = Math.min(len, 40);' +
            '    });' +
            '  });' +
            '  var html = \'<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>\';' +
            '  html += \'<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,sans-serif;font-size:11pt;">\';' +
            '  html += \'<tr style="background:#1a237e;color:white;"><th colspan="\' + headers.length + \'" style="font-size:16pt;font-weight:bold;text-align:left;padding:12px;">\' + title + \'</th></tr>\';' +
            '  html += \'<tr><td colspan="\' + headers.length + \'" style="font-size:10pt;color:#555;padding:4px;">\' + dateInfo + \'</td></tr>\';' +
            '  html += \'<tr style="background:#283593;color:white;font-weight:bold;">\';' +
            '  headers.forEach(function(h, i) {' +
            '    html += \'<th style="padding:8px 10px;text-align:left;font-size:10pt;width:\' + colWidths[i] + \'ch;">\' + h + \'</th>\';' +
            '  });' +
            '  html += \'</tr>\';' +
            '  rows.forEach(function(row, ri) {' +
            '    var bg = ri % 2 === 0 ? "#f8f9ff" : "#ffffff";' +
            '    html += \'<tr style="background:\' + bg + \';">\';' +
            '    var cells = row.querySelectorAll("td");' +
            '    cells.forEach(function(cell, ci) {' +
            '      var text = cell.textContent.trim().replace(/\\s+/g, \' \');' +
            '      var style = "padding:6px 10px;font-size:10pt;";' +
            '      if (cell.classList.contains("numeric")) style += "text-align:right;font-weight:600;";' +
            '      html += \'<td style="\' + style + \'">\' + text + \'</td>\';' +
            '    });' +
            '    html += \'</tr>\';' +
            '  });' +
            '  html += \'</table></body></html>\';' +
            '  var blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });' +
            '  var link = document.createElement("a");' +
            '  link.href = URL.createObjectURL(blob);' +
            '  link.download = "' + escapeHtml(report.name).replace(/[^a-zA-Z0-9]/g, '_') + '.xls";' +
            '  link.click();' +
            '  URL.revokeObjectURL(link.href);' +
            '}' +
            '</script>' +
            '</body></html>';

            return formattedReport;
        };

        var generateReport = function (report) {
            var startDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.startDate);
            var endDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.stopDate);
            var mimeType = report.responseType || "text/html";

            if (mimeType === "text/html") {
                var csvUrl = Bahmni.Common.Constants.reportsUrl + "/report";
                csvUrl = (csvUrl + "?name={0}&startDate={1}&endDate={2}&responseType={3}&paperSize={4}&appName={5}&userName={6}").format(report.name, startDate, endDate, "text/csv", paperSize, appName, currentUser());
                $http.get(csvUrl, {responseType: 'text', withCredentials: true}).then(function (response) {
                    var csvText = response.data;
                    if (typeof csvText !== 'string') {
                        var reader = new FileReader();
                        reader.onload = function () {
                            csvText = reader.result;
                            openProfessionalReport(csvText, report, startDate, endDate);
                        };
                        reader.readAsText(response.data);
                    } else {
                        openProfessionalReport(csvText, report, startDate, endDate);
                    }
                }, function (error) {
                    alert("Failed to generate report. Status: " + (error.status || 'unknown'));
                });
            } else {
                var url = Bahmni.Common.Constants.reportsUrl + "/report";
                url = (url + "?name={0}&startDate={1}&endDate={2}&responseType={3}&paperSize={4}&appName={5}&userName={6}").format(report.name, startDate, endDate, mimeType, paperSize, appName, currentUser());
                if (report.reportTemplateLocation && mimeType == 'application/vnd.ms-excel-custom') {
                    url = (url + "&macroTemplateLocation=" + report.reportTemplateLocation);
                }
                $http.get(url, {responseType: 'blob', withCredentials: true}).then(function (response) {
                    if (response.data.size === 0) {
                        alert("Empty response from server");
                        return;
                    }
                    var blob = new Blob([response.data], {type: mimeType});
                    var blobUrl = URL.createObjectURL(blob);
                    var fileName = report.name ? report.name.replace(/[^a-zA-Z0-9]/g, '_') : "report";
                    var link = document.createElement('a');
                    link.href = blobUrl;
                    var ext = "csv";
                    if (mimeType === "application/vnd.ms-excel") { ext = "xls"; }
                    else if (mimeType === "application/pdf") { ext = "pdf"; }
                    else if (mimeType === "application/vnd.oasis.opendocument.spreadsheet") { ext = "ods"; }
                    else if (mimeType === "application/vnd.ms-excel-custom") { ext = "xlsm"; }
                    link.download = fileName + "." + ext;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 10000);
                }, function (error) {
                    alert("Failed to generate report. Status: " + (error.status || 'unknown'));
                });
            }
        };

        var openProfessionalReport = function (csvText, report, startDate, endDate) {
            var enhancedHtml = buildProfessionalReport(csvText, report, startDate, endDate);
            var blob = new Blob([enhancedHtml], {type: 'text/html'});
            var blobUrl = URL.createObjectURL(blob);
            var newWindow = window.open(blobUrl);
            if (!newWindow) {
                alert("Please allow pop-ups for this site to view reports.");
            }
            setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 30000);
        };

        return {
            getFormatForMimeType: getFormatForMimeType,
            getMimeTypeForFormat: getMimeTypeForFormat,
            getAvailableFormats: getAvailableFormats,
            getAvailableDateRange: getAvailableDateRange,
            scheduleReport: scheduleReport,
            getScheduledReports: getScheduledReports,
            deleteReport: deleteReport,
            generateReport: generateReport
        };
    }]);
