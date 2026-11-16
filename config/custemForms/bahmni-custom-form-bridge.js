/**
 * Bahmni Clinical EMR Integration Bridge for Custom Forms
 * Provides:
 * - Patient demographics context extraction (URL / Parent window / OpenMRS REST)
 * - Authenticated clinician full name detection (/openmrs/ws/rest/v1/session)
 * - In-place observation updates to eliminate duplicate saves
 * - Form locking & non-editable enforcement for legal data safety
 * - Clinician shift handover logging without locking the whole form
 * - Comprehensive Clinical Governance & Audit Trail (who entered/edited/locked, when)
 * - Responsive clinical top bar & Ethiopian date formatting
 * - Integration with Bahmni consultation header Save button
 */

(function (window, document) {
  'use strict';

  var BahmniCustomFormBridge = {
    config: {},
    currentObsUuid: null,
    encounterUuid: null,
    patientUuid: null,
    patientName: null,
    currentUserFullName: 'Attending Clinician',
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    auditTrail: [],
    handovers: [],
    handoverLockedFields: [],

    init: function (options) {
      this.config = Object.assign({
        formId: 'custom_form',
        formTitle: 'Custom Clinical Form',
        conceptUuid: '',
        color: '#0f766e',
        tag: 'FORM',
        getData: function () { return {}; },
        setData: function (data) {},
        extractSummary: function (data) { return {}; },
        setLockState: function (locked) {}
      }, options);

      this.parseUrlParameters();
      this.injectStyles();
      this.renderTopBar();
      this.renderAuditTrailSection();
      this.renderShiftHandoverModal();
      this.setupMessageListener();

      this.fetchCurrentClinicianInfo();
      this.fetchPatientDemographics();
      this.loadObservationData();
    },

    parseUrlParameters: function () {
      var params = new URLSearchParams(window.location.search);
      this.patientUuid = params.get('patientUuid') || null;
      this.patientName = params.get('patientName') || null;
      this.encounterUuid = params.get('encounterUuid') || null;
      this.currentObsUuid = params.get('obsUuid') || null;
      this.isNewParam = params.get('new') === 'true';

      // Fallback: extract patientUuid from parent window URL hash if embedded
      if (!this.patientUuid) {
        try {
          var hash = (window.parent && window.parent.location.hash) || window.location.hash || '';
          var m = hash.match(/patient\/([a-f0-9\-]+)/i);
          if (m) this.patientUuid = m[1];
        } catch (e) {}
      }

      // Fallback: extract from Angular rootScope if embedded
      if (!this.patientUuid) {
        try {
          if (window.parent && window.parent.angular) {
            var rootScope = window.parent.angular.element(window.parent.document.body).injector().get('$rootScope');
            if (rootScope && rootScope.patient && rootScope.patient.uuid) {
              this.patientUuid = rootScope.patient.uuid;
              if (rootScope.patient.name && !this.patientName) {
                this.patientName = rootScope.patient.name;
              }
            }
          }
        } catch (e) {}
      }
    },

    injectStyles: function () {
      if (document.getElementById('bahmniBridgeStyles')) return;
      var style = document.createElement('style');
      style.id = 'bahmniBridgeStyles';
      style.textContent = `
        .bahmni-bridge-header {
          background: #ffffff;
          border-bottom: 2px solid ${this.config.color};
          padding: 8px 16px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        .bahmni-bridge-top-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .bahmni-bridge-patient-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: #334155;
        }
        .bahmni-bridge-badge {
          background: ${this.config.color};
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .bahmni-bridge-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bahmni-bridge-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }
        .bahmni-bridge-btn-save {
          background: #0f766e;
          color: #ffffff;
        }
        .bahmni-bridge-btn-save:hover { background: #115e59; }
        .bahmni-bridge-btn-lock {
          background: #e11d48;
          color: #ffffff;
        }
        .bahmni-bridge-btn-lock:hover { background: #be123c; }
        .bahmni-bridge-btn-unlock {
          background: #d97706;
          color: #ffffff;
        }
        .bahmni-bridge-btn-unlock:hover { background: #b45309; }
        .bahmni-bridge-btn-handover {
          background: #4f46e5;
          color: #ffffff;
        }
        .bahmni-bridge-btn-handover:hover { background: #4338ca; }
        .bahmni-bridge-btn-secondary {
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
        }
        .bahmni-bridge-btn-secondary:hover { background: #e2e8f0; }

        .bahmni-bridge-lock-banner {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          border-left: 5px solid #e11d48;
          padding: 10px 14px;
          margin: 10px 0;
          border-radius: 6px;
          color: #9f1239;
          font-size: 12.5px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .bahmni-audit-section {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          margin-top: 24px;
          margin-bottom: 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .bahmni-audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-top: 8px;
        }
        .bahmni-audit-table th {
          background: #f8fafc;
          border-bottom: 2px solid #cbd5e1;
          padding: 8px 10px;
          text-align: left;
          color: #475569;
          font-weight: 600;
        }
        .bahmni-audit-table td {
          border-bottom: 1px solid #f1f5f9;
          padding: 8px 10px;
          color: #1e293b;
        }

        .bahmni-bridge-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 99999;
          padding: 10px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-size: 12.5px;
          font-weight: 600;
          display: none;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .bahmni-bridge-toast-success { background: #059669; color: #ffffff; }
        .bahmni-bridge-toast-error { background: #dc2626; color: #ffffff; }

        @media print {
          .bahmni-bridge-header, .bahmni-bridge-actions, .no-print { display: none !important; }
        }
      `;
      document.head.appendChild(style);
    },

    renderTopBar: function () {
      var existing = document.getElementById('bahmniBridgeHeader');
      if (existing) existing.remove();

      var header = document.createElement('div');
      header.id = 'bahmniBridgeHeader';
      header.className = 'bahmni-bridge-header no-print';

      header.innerHTML = `
        <div class="bahmni-bridge-top-row">
          <div class="bahmni-bridge-patient-info">
            <span class="bahmni-bridge-badge">${this.config.tag}</span>
            <strong style="color: #0f172a; font-size: 14px;">${this.config.formTitle}</strong>
            <span id="bahmniBridgePtDisplay" style="color: #475569;">
              Patient: <b id="bahmniBridgePtName">${this.patientName || 'Loading...'}</b>
              <span id="bahmniBridgePtId" style="margin-left: 6px; font-family: monospace; font-size: 11.5px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;"></span>
            </span>
            <span id="bahmniBridgeStatusBadge" style="margin-left: 8px; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700;">
              Active Session
            </span>
          </div>

          <div class="bahmni-bridge-actions">
            <button type="button" class="bahmni-bridge-btn bahmni-bridge-btn-save" id="bahmniBridgeBtnSave">
              <span id="bahmniBridgeTxtSave">💾 Save to Encounter</span>
            </button>
            <button type="button" class="bahmni-bridge-btn bahmni-bridge-btn-lock" id="bahmniBridgeBtnLock" title="Finalize and lock this form after finished activity to make it non-editable">
              <span id="bahmniBridgeTxtLock">🔒 Lock Form</span>
            </button>
            <button type="button" class="bahmni-bridge-btn bahmni-bridge-btn-handover" id="bahmniBridgeBtnHandover" title="Clinical shift handover without locking the entire form">
              <span>🤝 Shift Handover</span>
            </button>
            <button type="button" class="bahmni-bridge-btn bahmni-bridge-btn-secondary" onclick="window.print()">
              <span>🖨️ Print / PDF</span>
            </button>
          </div>
        </div>

        <div id="bahmniBridgeLockBanner" class="bahmni-bridge-lock-banner" style="display: none;">
          <div>
            <strong>🔒 FINALIZED &amp; LOCKED RECORD:</strong>
            <span id="bahmniBridgeLockBannerText" style="margin-left: 6px;">This record has been finalized and locked as non-editable for patient safety.</span>
          </div>
          <button type="button" class="bahmni-bridge-btn bahmni-bridge-btn-unlock" id="bahmniBridgeBtnUnlockBanner" style="padding: 4px 10px; font-size: 11.5px;">
            Request Unlock 🔓
          </button>
        </div>
      `;

      document.body.insertBefore(header, document.body.firstChild);

      var self = this;
      document.getElementById('bahmniBridgeBtnSave').addEventListener('click', function () {
        self.saveObservation(false);
      });

      document.getElementById('bahmniBridgeBtnLock').addEventListener('click', function () {
        self.toggleLock();
      });

      var unlockBtn = document.getElementById('bahmniBridgeBtnUnlockBanner');
      if (unlockBtn) {
        unlockBtn.addEventListener('click', function () {
          self.requestUnlock();
        });
      }

      document.getElementById('bahmniBridgeBtnHandover').addEventListener('click', function () {
        self.openShiftHandoverModal();
      });
    },

    renderAuditTrailSection: function () {
      var existing = document.getElementById('bahmniAuditTrailSection');
      if (existing) existing.remove();

      var section = document.createElement('div');
      section.id = 'bahmniAuditTrailSection';
      section.className = 'bahmni-audit-section';
      section.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
          <h4 style="margin: 0; font-size: 13.5px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            <span>🛡️ Clinical Governance &amp; Audit Trail</span>
          </h4>
          <span id="bahmniAuditCountBadge" style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 9999px;">
            0 activities recorded
          </span>
        </div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: #64748b;">
          Permanent chronological log of all healthcare providers who edited, saved, handed over, or locked this record with timestamps.
        </p>
        <table class="bahmni-audit-table">
          <thead>
            <tr>
              <th style="width: 200px;">Date &amp; Time (E.C. / G.C.)</th>
              <th style="width: 220px;">Clinician / Provider Full Name</th>
              <th style="width: 140px;">Action Taken</th>
              <th>Clinical Details / Summary</th>
            </tr>
          </thead>
          <tbody id="bahmniAuditTableBody">
            <tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">No activity recorded yet</td></tr>
          </tbody>
        </table>
      `;

      // Append before closing body
      document.body.appendChild(section);
    },

    renderShiftHandoverModal: function () {
      var existing = document.getElementById('bahmniShiftHandoverModal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'bahmniShiftHandoverModal';
      modal.style.display = 'none';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.zIndex = '999999';
      modal.style.background = 'rgba(15, 23, 42, 0.6)';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.padding = '16px';
      modal.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); width: 100%; max-width: 500px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 15.5px; font-weight: 700; color: #4f46e5; display: flex; align-items: center; gap: 6px;">
              <span>🤝 Clinical Shift Handover</span>
            </h3>
            <button type="button" id="bahmniCloseHandoverBtn" style="border: none; background: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
          </div>
          <p style="margin: 0 0 14px 0; font-size: 12px; color: #64748b;">
            Allows clinician logout/shift handover without locking the entire form. Only the outgoing clinician's session and documentation timestamp are locked.
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 12.5px;">
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #334155;">Outgoing Clinician (Current User)</label>
              <input type="text" id="bahmniHoOutgoing" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" readonly>
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #334155;">Incoming Clinician (Receiving Staff)</label>
              <input type="text" id="bahmniHoIncoming" placeholder="e.g. Dr. Abebe / Nurse Tigist" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; color: #334155;">Clinical Handover Summary / Notes</label>
              <textarea id="bahmniHoNotes" rows="3" placeholder="Condition stable, vital signs monitored, next evaluation due..." style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;"></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
              <button type="button" id="bahmniCancelHandoverBtn" class="bahmni-bridge-btn bahmni-bridge-btn-secondary">Cancel</button>
              <button type="button" id="bahmniSubmitHandoverBtn" class="bahmni-bridge-btn bahmni-bridge-btn-handover">Sign &amp; Complete Handover</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      var self = this;
      document.getElementById('bahmniCloseHandoverBtn').addEventListener('click', function () {
        modal.style.display = 'none';
      });
      document.getElementById('bahmniCancelHandoverBtn').addEventListener('click', function () {
        modal.style.display = 'none';
      });
      document.getElementById('bahmniSubmitHandoverBtn').addEventListener('click', function () {
        self.submitShiftHandover();
      });
    },

    openShiftHandoverModal: function () {
      if (this.isLocked) {
        this.showToast('Form is already finalized and locked.', true);
        return;
      }
      var modal = document.getElementById('bahmniShiftHandoverModal');
      document.getElementById('bahmniHoOutgoing').value = this.currentUserFullName;
      document.getElementById('bahmniHoIncoming').value = '';
      document.getElementById('bahmniHoNotes').value = '';
      modal.style.display = 'flex';
    },

    submitShiftHandover: function () {
      var outgoing = document.getElementById('bahmniHoOutgoing').value.trim() || this.currentUserFullName;
      var incoming = document.getElementById('bahmniHoIncoming').value.trim() || 'Incoming Clinical Team';
      var notes = document.getElementById('bahmniHoNotes').value.trim() || 'Shift handover completed';

      // 1. Freeze currently documented (non-empty) fields for this handover
      var currentLocked = this.handoverLockedFields ? this.handoverLockedFields.slice() : [];
      var inputs = document.querySelectorAll('input:not(#bahmniHoIncoming):not(#bahmniHoNotes):not(#bahmniHoOutgoing), select, textarea:not(#bahmniHoNotes)');
      inputs.forEach(function (el) {
        var key = el.id || el.name;
        if (!key) return;
        var hasVal = false;
        if (el.type === 'checkbox' || el.type === 'radio') {
          hasVal = el.checked;
        } else if (el.value && el.value.trim() !== '') {
          hasVal = true;
        }
        if (hasVal && currentLocked.indexOf(key) === -1) {
          currentLocked.push(key);
        }
      });
      this.handoverLockedFields = currentLocked;

      var handoverEntry = {
        timestamp: new Date().toISOString(),
        outgoingUser: outgoing,
        incomingUser: incoming,
        notes: notes,
        lockedFieldCount: currentLocked.length
      };

      if (!this.handovers) this.handovers = [];
      this.handovers.push(handoverEntry);

      this.addAuditLog('SHIFT HANDOVER', `Handover from ${outgoing} to ${incoming}: ${notes}. Outgoing documentation frozen.`, outgoing);
      document.getElementById('bahmniShiftHandoverModal').style.display = 'none';
      this.applyLockState(this.isLocked);
      this.saveObservation(false);
      this.showToast(`Shift handover recorded successfully to ${incoming}! Outgoing documentation locked.`);
    },

    addAuditLog: function (action, details, user) {
      if (!this.auditTrail) this.auditTrail = [];
      var entry = {
        timestamp: new Date().toISOString(),
        user: user || this.currentUserFullName || 'Attending Clinician',
        action: action,
        details: details || ''
      };
      this.auditTrail.push(entry);
      this.renderAuditTrail();
    },

    renderAuditTrail: function () {
      var tbody = document.getElementById('bahmniAuditTableBody');
      var badge = document.getElementById('bahmniAuditCountBadge');
      if (!tbody) return;

      var logs = this.auditTrail || [];
      if (badge) badge.textContent = `${logs.length} activit${logs.length === 1 ? 'y' : 'ies'} recorded`;

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">No activity recorded yet</td></tr>';
        return;
      }

      var self = this;
      tbody.innerHTML = logs.slice().reverse().map(function (log) {
        var dt = new Date(log.timestamp);
        var dtStr = isNaN(dt.getTime()) ? log.timestamp : dt.toLocaleString();
        var etStr = self.formatEthiopianDate(log.timestamp);
        var timeDisplay = etStr ? `${dtStr}<br><span style="color: #4f46e5; font-size: 10.5px; font-weight: 600;">(${etStr})</span>` : dtStr;

        var actionBadge = 'background: #f1f5f9; color: #334155;';
        if (log.action.indexOf('LOCK') !== -1) {
          actionBadge = 'background: #ffe4e6; color: #9f1239; font-weight: 700;';
        } else if (log.action.indexOf('SAVE') !== -1) {
          actionBadge = 'background: #d1fae5; color: #065f46; font-weight: 700;';
        } else if (log.action.indexOf('HANDOVER') !== -1) {
          actionBadge = 'background: #e0e7ff; color: #3730a3; font-weight: 700;';
        }

        return `
          <tr>
            <td style="font-family: monospace; font-size: 11px;">${timeDisplay}</td>
            <td style="font-weight: 600; color: #0f172a;">${log.user || 'Attending Clinician'}</td>
            <td><span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; ${actionBadge}">${log.action}</span></td>
            <td style="color: #334155; font-size: 11.5px;">${log.details || '-'}</td>
          </tr>
        `;
      }).join('');
    },

    formatEthiopianDate: function (isoStr) {
      if (!isoStr) return '';
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      var gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
      var a = Math.floor((14 - gm) / 12);
      var y = gy + 4800 - a;
      var m = gm + 12 * a - 3;
      var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
      var r = (jdn - 1724221) % 1461;
      var n = (r % 365) + 365 * Math.floor(r / 1460);
      var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
      var etMonth = Math.floor(n / 30) + 1;
      var etDay = (n % 30) + 1;
      var monthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
      return `${monthsAm[etMonth - 1] || etMonth} ${etDay}, ${etYear} ዓ.ም`;
    },

    fetchCurrentClinicianInfo: function () {
      var self = this;
      fetch('/openmrs/ws/rest/v1/session', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.authenticated && data.user) {
            var fullName = data.user.person ? (data.user.person.display || (data.user.person.names && data.user.person.names[0] && data.user.person.names[0].display)) : null;
            if (fullName) {
              self.currentUserFullName = fullName;
            } else if (data.currentProvider && data.currentProvider.display) {
              self.currentUserFullName = data.currentProvider.display;
            } else if (data.user.username) {
              self.currentUserFullName = data.user.username;
            }
          }
          self.renderAuditTrail();
        })
        .catch(function () {});
    },

    fetchPatientDemographics: function () {
      if (!this.patientUuid) return;
      var self = this;
      fetch(`/openmrs/ws/rest/v1/patient/${this.patientUuid}?v=full`, {
        credentials: 'include'
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (pt) {
        if (!pt) return;
        var person = pt.person || {};
        var preferredName = person.preferredName || {};
        var preferredAddress = person.preferredAddress || {};

        var fullName = '';
        if (preferredName.givenName || preferredName.familyName) {
          fullName = [preferredName.givenName, preferredName.middleName, preferredName.familyName].filter(Boolean).join(' ');
        }
        if (!fullName) {
          fullName = (person.display) || pt.display || '';
        }

        var identifier = (pt.identifiers && pt.identifiers[0] && pt.identifiers[0].identifier) || '';
        var age = person.age != null ? String(person.age) : '';
        var gender = person.gender || '';
        var genderFull = gender === 'M' ? 'Male' : (gender === 'F' ? 'Female' : gender);
        var birthdate = person.birthdate ? person.birthdate.substring(0, 10) : '';

        // Address parts
        var kebele = preferredAddress.address1 || '';
        var zone = preferredAddress.countyDistrict || preferredAddress.address2 || '';
        var woreda = preferredAddress.cityVillage || '';
        var region = preferredAddress.stateProvince || '';
        var fullAddress = [region, zone, woreda, kebele].filter(Boolean).join(', ');

        // Phone number from attributes
        var phone = '';
        if (person.attributes && person.attributes.length > 0) {
          for (var a = 0; a < person.attributes.length; a++) {
            var attr = person.attributes[a];
            var typeName = (attr.attributeType && (attr.attributeType.name || attr.attributeType.display || '')).toLowerCase();
            if (typeName.includes('phone') || typeName.includes('tele') || typeName.includes('mobile') || typeName.includes('contact')) {
              phone = attr.value;
              break;
            }
          }
        }

        var ptInfo = {
          uuid: pt.uuid,
          identifier: identifier,
          fullName: fullName,
          firstName: preferredName.givenName || '',
          middleName: preferredName.middleName || '',
          familyName: preferredName.familyName || '',
          age: age,
          gender: gender,
          genderFull: genderFull,
          birthdate: birthdate,
          kebele: kebele,
          zone: zone,
          woreda: woreda,
          region: region,
          fullAddress: fullAddress,
          phone: phone,
          raw: pt
        };

        self.patientInfo = ptInfo;
        if (fullName) self.patientName = fullName;

        // 1. Update Top Bar banner
        var ptNameEl = document.getElementById('bahmniBridgePtName');
        if (ptNameEl) ptNameEl.textContent = fullName;

        var idEl = document.getElementById('bahmniBridgePtId');
        if (idEl) {
          idEl.textContent = `ID: ${identifier || pt.uuid.slice(0, 8)} | ${age ? age + 'y' : ''} ${genderFull || gender}`;
        }

        // 2. Auto fill form inputs
        self.autoFillFormFields(ptInfo);

        // 3. Optional callback in form bridge config
        if (typeof self.config.setPatientDetails === 'function') {
          try { self.config.setPatientDetails(ptInfo); } catch (e) { console.warn('setPatientDetails error:', e); }
        }
      })
      .catch(function (err) {
        console.warn('fetchPatientDemographics error:', err);
      });
    },

    autoFillFormFields: function (pt) {
      if (!pt) return;

      var setVal = function (el, val) {
        if (!el || val == null || val === '') return;
        if (!el.value || el.value.trim() === '') {
          el.value = val;
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        }
      };

      var setChecked = function (el, checked) {
        if (!el) return;
        el.checked = checked;
        try {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      };

      // 1. Specific Form Mappings
      // Ethiopian OTP Follow-up Card
      setVal(document.getElementById('inputPatientName'), pt.fullName);
      setVal(document.getElementById('inputRegNo'), pt.identifier);

      // FMOH Ethiopia DM & Hypertension Follow-Up Form
      setVal(document.getElementById('pt-name'), pt.fullName);
      setVal(document.getElementById('pt-mrn'), pt.identifier);
      setVal(document.getElementById('pt-age'), pt.age);
      setVal(document.getElementById('pt-sex'), pt.genderFull);
      setVal(document.getElementById('pt-zone'), pt.zone);
      setVal(document.getElementById('pt-woreda'), pt.woreda);
      setVal(document.getElementById('pt-kebele'), pt.kebele);
      setVal(document.getElementById('pt-tel'), pt.phone);

      // Interactive Ophthalmic Eye Examination Form
      setVal(document.getElementById('patientName'), pt.fullName);
      setVal(document.getElementById('mrn'), pt.identifier);
      if (document.getElementById('dobAge')) {
        var dobAgeStr = (pt.birthdate || '') + (pt.age ? ' (' + pt.age + 'y)' : '');
        setVal(document.getElementById('dobAge'), dobAgeStr.trim());
      }
      if (pt.gender === 'M') setChecked(document.getElementById('sexMale'), true);
      if (pt.gender === 'F') setChecked(document.getElementById('sexFemale'), true);
      setVal(document.getElementById('phone'), pt.phone);

      // WHO Postpartum Hemorrhage (PPH) Observation Chart
      setVal(document.getElementById('patientNameMrn'), pt.fullName + (pt.identifier ? ' / ' + pt.identifier : ''));

      // Safe Childbirth Checklist Ethiopian
      setVal(document.getElementById('patientName'), pt.fullName + (pt.identifier ? ' (ID: ' + pt.identifier + ')' : ''));

      // Stabilisation Centre (SC) Multi-Chart
      setVal(document.querySelector('input[data-field="child_name"]'), pt.fullName);
      setVal(document.querySelector('input[data-field="reg_no"]'), pt.identifier);
      setVal(document.querySelector('input[data-field="age"]'), pt.age);
      setVal(document.getElementById('field-age'), pt.age);
      if (document.querySelector('select[data-field="sex"]')) {
        var sexSel = document.querySelector('select[data-field="sex"]');
        if (!sexSel.value) {
          sexSel.value = pt.gender === 'M' ? 'M' : (pt.gender === 'F' ? 'F' : '');
          try { sexSel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }
      }
      setVal(document.querySelector('input[data-field="address"]'), pt.fullAddress || [pt.kebele, pt.woreda, pt.region].filter(Boolean).join(', '));

      // National Perioperative Clinical Forms
      ['sa_name', 'sp_name', 'an_name', 'ar_name'].forEach(function(n) {
        setVal(document.querySelector(`input[name="${n}"]`), pt.fullName);
      });
      ['sa_mrn', 'sp_mrn', 'an_mrn'].forEach(function(n) {
        setVal(document.querySelector(`input[name="${n}"]`), pt.identifier);
      });
      ['sa_age', 'sp_age', 'an_age', 'ar_age_wt'].forEach(function(n) {
        setVal(document.querySelector(`input[name="${n}"]`), pt.age);
      });
      ['sa_gender', 'sp_gender', 'an_sex'].forEach(function(n) {
        setVal(document.querySelector(`input[name="${n}"]`), pt.genderFull);
      });

      // 2. Generic heuristics for any input or textarea
      var allInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea, select');
      for (var i = 0; i < allInputs.length; i++) {
        var inp = allInputs[i];
        if (inp.value && inp.value.trim() !== '') continue;
        var tagId = (inp.id || '').toLowerCase();
        var tagName = (inp.name || '').toLowerCase();
        var tagPh = (inp.placeholder || '').toLowerCase();
        var combined = tagId + ' ' + tagName + ' ' + tagPh;

        // Skip provider, clinician, outgoing, incoming, drug inputs
        if (combined.includes('provider') || combined.includes('clinician') || combined.includes('outgoing') || combined.includes('incoming') || combined.includes('drug') || combined.includes('facility')) {
          continue;
        }

        if (combined.includes('patient') && combined.includes('name')) {
          setVal(inp, pt.fullName);
        } else if (combined.includes('mrn') || combined.includes('regno') || combined.includes('reg_no') || combined.includes('hospital_no') || combined.includes('patient_id') || combined.includes('patientid')) {
          setVal(inp, pt.identifier);
        } else if ((tagId === 'age' || tagName === 'age' || tagPh === 'age' || combined.includes('patient age') || combined.includes('pt age')) && !combined.includes('group')) {
          setVal(inp, pt.age);
        } else if (tagId === 'gender' || tagName === 'gender' || tagId === 'sex' || tagName === 'sex') {
          setVal(inp, pt.genderFull || pt.gender);
        } else if (combined.includes('birthdate') || combined.includes('dob') || combined.includes('date of birth')) {
          setVal(inp, pt.birthdate);
        } else if (combined.includes('kebele')) {
          setVal(inp, pt.kebele);
        } else if (combined.includes('woreda')) {
          setVal(inp, pt.woreda);
        } else if (combined.includes('zone') || combined.includes('subcity') || combined.includes('sub-city')) {
          setVal(inp, pt.zone);
        } else if (combined.includes('region')) {
          setVal(inp, pt.region);
        } else if (combined.includes('phone') || combined.includes('telephone') || combined.includes('tel')) {
          setVal(inp, pt.phone);
        }
      }
    },

    loadObservationData: function () {
      var self = this;
      // Step 1: check direct obsUuidParam
      if (this.currentObsUuid) {
        fetch(`/openmrs/ws/rest/v1/obs/${this.currentObsUuid}?v=custom:(uuid,obsDatetime,value,encounter:(uuid,encounterDatetime))`, {
          credentials: 'include'
        })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (obs) {
          if (obs && obs.value) {
            self.applyObservationPayload(obs.value, obs.uuid, obs.encounter && obs.encounter.uuid);
          }
        })
        .catch(function () {});
        return;
      }

      // Step 2: Query all observations for this patient and concept
      if (!this.patientUuid || !this.config.conceptUuid) return;

      fetch(`/openmrs/ws/rest/v1/obs?patient=${this.patientUuid}&concept=${this.config.conceptUuid}&v=custom:(uuid,obsDatetime,value,encounter:(uuid,encounterDatetime))`, {
        credentials: 'include'
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.results || data.results.length === 0) return;

        var sorted = data.results.slice().sort(function (a, b) {
          return new Date(b.obsDatetime) - new Date(a.obsDatetime);
        });

        var activeUnlocked = null;
        for (var i = 0; i < sorted.length; i++) {
          var o = sorted[i];
          var parsed = null;
          try { parsed = typeof o.value === 'object' ? o.value : JSON.parse(o.value); } catch (e) {}
          if (parsed && !parsed.locked) {
            activeUnlocked = o;
            break;
          }
        }

        // RULE: If an active unlocked chart exists, update it!
        // Only start fresh if all existing charts are locked (or explicit obsUuid)!
        var target = activeUnlocked || (new URLSearchParams(window.location.search).get('obsUuid') ? sorted[0] : null);
        if (target) {
          self.applyObservationPayload(target.value, target.uuid, target.encounter && target.encounter.uuid);
        }
      })
      .catch(function () {});
    },

    applyObservationPayload: function (rawVal, obsUuid, encUuid) {
      this.currentObsUuid = obsUuid;
      if (encUuid) this.encounterUuid = encUuid;

      var parsed = null;
      if (typeof rawVal === 'object' && rawVal !== null) {
        parsed = rawVal;
      } else if (typeof rawVal === 'string') {
        try { parsed = JSON.parse(rawVal); } catch (e) {}
      }

      if (!parsed) return;

      this.isLocked = Boolean(parsed.locked);
      this.lockedBy = parsed.lockedBy || null;
      this.lockedAt = parsed.lockedAt || null;
      this.auditTrail = parsed.auditTrail || [];
      this.handovers = parsed.handovers || [];
      this.handoverLockedFields = parsed.handoverLockedFields || [];

      // Apply form domain data
      if (parsed.formData && typeof this.config.setData === 'function') {
        this.config.setData(parsed.formData);
      } else if (typeof this.config.setData === 'function') {
        this.config.setData(parsed);
      }

      this.applyLockState(this.isLocked);
      this.renderAuditTrail();
    },

    applyLockState: function (locked) {
      this.isLocked = Boolean(locked);
      var banner = document.getElementById('bahmniBridgeLockBanner');
      var bannerText = document.getElementById('bahmniBridgeLockBannerText');
      var btnLock = document.getElementById('bahmniBridgeBtnLock');
      var txtLock = document.getElementById('bahmniBridgeTxtLock');
      var btnSave = document.getElementById('bahmniBridgeBtnSave');
      var btnHandover = document.getElementById('bahmniBridgeBtnHandover');
      var statusBadge = document.getElementById('bahmniBridgeStatusBadge');

      if (this.isLocked) {
        if (banner) {
          banner.style.display = 'flex';
          var dtStr = this.lockedAt ? new Date(this.lockedAt).toLocaleString() : 'Recent';
          bannerText.textContent = `This clinical record was finalized & locked on ${dtStr} by ${this.lockedBy || 'Authorized Staff'}. All fields are non-editable for data safety.`;
        }
        if (btnLock && txtLock) {
          btnLock.className = 'bahmni-bridge-btn bahmni-bridge-btn-unlock';
          txtLock.textContent = 'Unlock Form 🔓';
        }
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.style.opacity = '0.45';
          btnSave.style.cursor = 'not-allowed';
          btnSave.style.pointerEvents = 'none';
          btnSave.title = 'Record is finalized & locked. Unlock the form first to save edits.';
        }
        if (btnHandover) {
          btnHandover.disabled = true;
          btnHandover.style.opacity = '0.45';
          btnHandover.style.cursor = 'not-allowed';
          btnHandover.style.pointerEvents = 'none';
        }
        if (statusBadge) {
          statusBadge.style.background = '#ffe4e6';
          statusBadge.style.color = '#9f1239';
          statusBadge.textContent = `🔒 Locked by ${this.lockedBy || 'Clinician'}`;
        }
      } else {
        if (banner) banner.style.display = 'none';
        if (btnLock && txtLock) {
          btnLock.className = 'bahmni-bridge-btn bahmni-bridge-btn-lock';
          txtLock.textContent = '🔒 Lock Form';
        }
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.style.opacity = '1';
          btnSave.style.cursor = 'pointer';
          btnSave.style.pointerEvents = 'auto';
          btnSave.title = 'Save clinical observations to patient encounter';
        }
        if (btnHandover) {
          btnHandover.disabled = false;
          btnHandover.style.opacity = '1';
          btnHandover.style.cursor = 'pointer';
          btnHandover.style.pointerEvents = 'auto';
        }
        if (statusBadge) {
          statusBadge.style.background = '#e0f2fe';
          statusBadge.style.color = '#0284c7';
          statusBadge.textContent = 'Active Monitoring';
        }
      }

      // Delegate field disabling to form callback
      if (typeof this.config.setLockState === 'function') {
        this.config.setLockState(this.isLocked, this.handoverLockedFields);
      }

      // Handle input element disabling & partial handover freeze
      var lockedKeys = (this.handovers && this.handovers.length > 0 && this.handoverLockedFields) ? this.handoverLockedFields : [];
      document.querySelectorAll('input:not(#bahmniHoIncoming):not(#bahmniHoNotes):not(#bahmniHoOutgoing), select, textarea:not(#bahmniHoNotes)').forEach(function (el) {
        var key = el.id || el.name;
        if (locked) {
          el.disabled = true;
          el.style.backgroundColor = '';
          el.title = 'Form finalized & locked';
        } else if (lockedKeys.length > 0 && key && lockedKeys.indexOf(key) !== -1) {
          el.disabled = true;
          el.style.backgroundColor = '#f1f5f9';
          el.title = 'Documented in previous shift (locked at handover)';
        } else {
          el.disabled = false;
          el.style.backgroundColor = '';
          el.title = '';
        }
      });
    },

    toggleLock: function () {
      if (this.isLocked) {
        this.requestUnlock();
        return;
      }

      var confirmed = confirm(
        `Are you sure you want to FINALIZE AND LOCK this ${this.config.formTitle}?\n\n` +
        `• Activity will be marked as finished.\n` +
        `• The form will become strictly NON-EDITABLE for legal clinical integrity.\n` +
        `• Your full name (${this.currentUserFullName}) will be permanently recorded in the audit trail.`
      );

      if (!confirmed) return;

      this.isLocked = true;
      this.lockedBy = this.currentUserFullName;
      this.lockedAt = new Date().toISOString();

      this.addAuditLog('FORM LOCKED', `Record finalized and locked as read-only by ${this.currentUserFullName}`);
      this.applyLockState(true);
      this.saveObservation(false);
      this.showToast('Form finalized and locked successfully!');
    },

    requestUnlock: function () {
      var reason = prompt(
        'This record is currently LOCKED for patient safety and data integrity.\n\n' +
        'To unlock for corrections, please enter the clinical authorization reason:',
        ''
      );

      if (!reason || !reason.trim()) {
        this.showToast('Unlock cancelled. Form remains non-editable.', true);
        return;
      }

      this.isLocked = false;
      this.addAuditLog('FORM UNLOCKED', `Unlocked by ${this.currentUserFullName}. Reason: "${reason.trim()}"`);
      this.applyLockState(false);
      this.saveObservation(false);
      this.showToast('Record unlocked for editing.');
    },

    saveObservation: async function (silent) {
      if (this.isLocked) {
        if (!silent) {
          this.showToast('This clinical record is finalized & locked. Unlock to make edits.', true);
        }
        return;
      }
      var btn = document.getElementById('bahmniBridgeBtnSave');
      var txt = document.getElementById('bahmniBridgeTxtSave');
      var origText = txt ? txt.textContent : 'Save to Encounter';

      if (!silent && btn && txt) {
        txt.textContent = 'Saving to EMR...';
        btn.disabled = true;
      }

      var formData = typeof this.config.getData === 'function' ? this.config.getData() : {};
      var summaryMetrics = typeof this.config.extractSummary === 'function' ? this.config.extractSummary(formData) : {};

      if (!silent) {
        this.addAuditLog(this.isLocked ? 'RECORD LOCKED & SAVED' : 'RECORD SAVED', `Clinical observations saved to patient encounter by ${this.currentUserFullName}`);
      }

      var payload = {
        savedAt: new Date().toISOString(),
        lastSavedByName: this.currentUserFullName,
        patientUuid: this.patientUuid,
        encounterUuid: this.encounterUuid,
        obsUuid: this.currentObsUuid,
        locked: this.isLocked,
        lockedBy: this.lockedBy,
        lockedAt: this.lockedAt,
        summaryMetrics: summaryMetrics,
        formData: formData,
        auditTrail: this.auditTrail,
        handovers: this.handovers,
        handoverLockedFields: this.handoverLockedFields || []
      };

      var targetPtUuid = this.patientUuid;
      if (!targetPtUuid) {
        if (silent) return;
        targetPtUuid = prompt('Enter Patient UUID to save to OpenMRS Encounter (or click Cancel to save in browser):', '');
        if (!targetPtUuid) {
          this.showToast('Saved locally in browser storage!');
          if (btn && txt) { txt.textContent = origText; btn.disabled = false; }
          return;
        }
        this.patientUuid = targetPtUuid;
      }

      var self = this;

      // Check whether an active unlocked observation exists in OpenMRS before creating a new one
      if (!this.currentObsUuid && targetPtUuid && this.config.conceptUuid) {
        try {
          var checkRes = await fetch(`/openmrs/ws/rest/v1/obs?patient=${encodeURIComponent(targetPtUuid)}&concept=${encodeURIComponent(this.config.conceptUuid)}&v=custom:(uuid,obsDatetime,value,encounter:(uuid))`, { credentials: 'include' });
          if (checkRes.ok) {
            var checkData = await checkRes.json();
            var results = (checkData.results || []).slice().sort(function (a, b) { return new Date(b.obsDatetime) - new Date(a.obsDatetime); });
            for (var i = 0; i < results.length; i++) {
              var p = null;
              try { p = typeof results[i].value === 'string' ? JSON.parse(results[i].value) : results[i].value; } catch(e) {}
              if (p && !p.locked) {
                this.currentObsUuid = results[i].uuid;
                payload.obsUuid = this.currentObsUuid;
                if (results[i].encounter && results[i].encounter.uuid) this.encounterUuid = results[i].encounter.uuid;
                break;
              }
            }
          }
        } catch (e) {}
      }

      // In-place update if currentObsUuid already exists!
      if (this.currentObsUuid) {
        try {
          var updateRes = await fetch(`/openmrs/ws/rest/v1/obs/${this.currentObsUuid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ value: JSON.stringify(payload) })
          });

          if (updateRes.ok) {
            var updatedObs = await updateRes.json();
            if (updatedObs && updatedObs.uuid) {
              self.currentObsUuid = updatedObs.uuid;
            }
            self.showToast('Record updated successfully in-place!');
            if (!silent && txt && btn) {
              txt.textContent = 'Updated in EMR ✓';
              setTimeout(function () { txt.textContent = origText; btn.disabled = false; }, 2500);
            }
            return;
          }
        } catch (err) {
          console.warn('Direct obs update failed, creating encounter fallback:', err);
        }
      }

      // First time saving: Create encounter + observation
      var encounterPayload = {
        patient: targetPtUuid,
        encounterType: 'Consultation',
        encounterDatetime: new Date().toISOString(),
        obs: [
          {
            concept: this.config.conceptUuid,
            value: JSON.stringify(payload)
          }
        ]
      };

      try {
        var encUrl = this.encounterUuid ? `/openmrs/ws/rest/v1/encounter/${this.encounterUuid}` : '/openmrs/ws/rest/v1/encounter';
        var res = await fetch(encUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(encounterPayload)
        });

        if (res.ok) {
          var encData = await res.json();
          self.encounterUuid = encData.uuid;
          if (encData.obs && encData.obs.length > 0) {
            self.currentObsUuid = encData.obs[0].uuid;
          }
          self.showToast('Saved to Patient Encounter successfully!');
          if (!silent && txt && btn) {
            txt.textContent = 'Saved to Encounter ✓';
            setTimeout(function () { txt.textContent = origText; btn.disabled = false; }, 2500);
          }
        } else {
          var errData = await res.json().catch(function () { return {}; });
          self.showToast(`OpenMRS error: ${errData.error ? errData.error.message : res.statusText}`, true);
          if (txt && btn) { txt.textContent = origText; btn.disabled = false; }
        }
      } catch (e) {
        console.error('Encounter save network error:', e);
        self.showToast('Network error saving to encounter', true);
        if (txt && btn) { txt.textContent = origText; btn.disabled = false; }
      }
    },

    setupMessageListener: function () {
      var self = this;
      window.addEventListener('message', function (e) {
        if (e.data && e.data.action === 'saveToOpenMRS') {
          if (e.data.patientUuid && !self.patientUuid) {
            self.patientUuid = e.data.patientUuid;
          }
          self.saveObservation(true);
        }
      });
    },

    showToast: function (msg, isError) {
      var toast = document.getElementById('bahmniBridgeToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'bahmniBridgeToast';
        toast.className = 'bahmni-bridge-toast';
        document.body.appendChild(toast);
      }
      toast.className = 'bahmni-bridge-toast ' + (isError ? 'bahmni-bridge-toast-error' : 'bahmni-bridge-toast-success');
      toast.innerHTML = (isError ? '⚠️ ' : '✓ ') + msg;
      toast.style.display = 'flex';
      setTimeout(function () { if (toast) toast.style.display = 'none'; }, 3500);
    }
  };

  window.BahmniCustomFormBridge = BahmniCustomFormBridge;
})(window, document);

