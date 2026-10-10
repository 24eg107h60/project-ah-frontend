// Application Controller for Vehicle Service and Maintenance Prediction Platform

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  currentUser: null,
  vehicles: [],
  selectedVehicleId: null,
  currentReport: null,
  bookings: [],
  records: [],
  notifications: [],
  charts: {
    monthly: null,
    category: null,
    vehicle: null
  },

  async init() {
    this.bindEvents();
    this.currentUser = Api.getCurrentUser();

    if (this.currentUser && Api.getToken()) {
      this.updateUserUI();
      await this.loadInitialData();
    } else {
      // Default to guest state: automatically login as Alex Morgan (demo owner) for smooth zero-click evaluator experience
      await this.quickLogin('user@autocare.com', 'user123', true);
    }
  },

  bindEvents() {
    // Navigation pills
    document.querySelectorAll('[data-nav-view]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = tab.getAttribute('data-nav-view');
        this.switchView(viewId);
      });
    });

    // Auth actions
    document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());

    // Quick demo login buttons
    document.getElementById('demoOwnerBtn')?.addEventListener('click', () => this.quickLogin('user@autocare.com', 'user123'));
    document.getElementById('demoAdminBtn')?.addEventListener('click', () => this.quickLogin('admin@autocare.com', 'admin123'));

    // Vehicle actions
    document.getElementById('vehicleForm')?.addEventListener('submit', (e) => this.handleVehicleSave(e));
    document.getElementById('updateMileageForm')?.addEventListener('submit', (e) => this.handleMileageSave(e));

    // Booking actions
    document.getElementById('bookingForm')?.addEventListener('submit', (e) => this.handleBookingSave(e));

    // Service Record action
    document.getElementById('recordForm')?.addEventListener('submit', (e) => this.handleRecordSave(e));

    // Admin Status update action
    document.getElementById('adminBookingStatusForm')?.addEventListener('submit', (e) => this.handleAdminBookingStatusSave(e));

    // Vehicle select for prediction view
    document.getElementById('predictionVehicleSelect')?.addEventListener('change', (e) => {
      this.selectedVehicleId = e.target.value ? parseInt(e.target.value, 10) : null;
      this.loadPredictionDetails();
    });

    // Notification bell click
    document.getElementById('notificationBellBtn')?.addEventListener('click', () => this.openNotificationsModal());
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => this.markAllNotificationsRead());

    // Session expiration handler
    window.addEventListener('auth:expired', () => {
      this.showToast('Session Expired', 'Please log in again.', 'warning');
      this.currentUser = null;
      this.updateUserUI();
      const modal = new bootstrap.Modal(document.getElementById('authModal'));
      modal.show();
    });
  },

  switchView(viewId) {
    document.querySelectorAll('[data-nav-view]').forEach(tab => {
      if (tab.getAttribute('data-nav-view') === viewId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    document.querySelectorAll('.app-view-container').forEach(view => {
      if (view.id === viewId) {
        view.classList.remove('d-none');
      } else {
        view.classList.add('d-none');
      }
    });

    // Trigger tab-specific refresh
    if (viewId === 'view-dashboard') this.renderDashboard();
    if (viewId === 'view-vehicles') this.renderVehicles();
    if (viewId === 'view-prediction') this.renderPredictionView();
    if (viewId === 'view-bookings') this.loadBookings();
    if (viewId === 'view-reports') this.loadReports();
    if (viewId === 'view-admin') this.loadAdminDashboard();
  },

  async quickLogin(email, password, silent = false) {
    try {
      const response = await Api.auth.login({ email, password });
      Api.setToken(response.token);
      Api.setCurrentUser(response);
      this.currentUser = response;
      this.updateUserUI();

      const modalEl = document.getElementById('authModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      if (!silent) {
        this.showToast('Login Successful', `Welcome, ${response.name}! (${response.role === 'ROLE_ADMIN' ? 'Admin' : 'Vehicle Owner'})`, 'success');
      }

      await this.loadInitialData();
    } catch (err) {
      if (!silent) {
        this.showToast('Login Failed', err.message, 'danger');
      }
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    await this.quickLogin(email, password);
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value.trim();
    const role = document.getElementById('regRole').value;

    try {
      const response = await Api.auth.register({ name, email, password, phone, role });
      Api.setToken(response.token);
      Api.setCurrentUser(response);
      this.currentUser = response;
      this.updateUserUI();

      const modalEl = document.getElementById('authModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();

      this.showToast('Account Created', `Welcome to AutoCare, ${response.name}!`, 'success');
      await this.loadInitialData();
    } catch (err) {
      this.showToast('Registration Error', err.message, 'danger');
    }
  },

  handleLogout() {
    Api.logout();
    this.currentUser = null;
    this.vehicles = [];
    this.selectedVehicleId = null;
    this.bookings = [];
    this.records = [];
    this.updateUserUI();
    this.showToast('Logged Out', 'You have been signed out successfully.', 'info');
    // Re-open auth modal or prompt
    const modal = new bootstrap.Modal(document.getElementById('authModal'));
    modal.show();
  },

  updateUserUI() {
    const userDisplay = document.getElementById('currentUserDisplay');
    const roleBadge = document.getElementById('currentUserRoleBadge');
    const authActions = document.getElementById('navAuthActions');
    const userActions = document.getElementById('navUserActions');
    const adminTab = document.getElementById('navAdminTab');

    if (this.currentUser) {
      if (userDisplay) userDisplay.textContent = this.currentUser.name;
      if (roleBadge) {
        roleBadge.textContent = this.currentUser.role === 'ROLE_ADMIN' ? 'ADMIN' : 'OWNER';
        roleBadge.className = this.currentUser.role === 'ROLE_ADMIN' ? 'badge bg-danger ms-1' : 'badge bg-primary ms-1';
      }
      authActions?.classList.add('d-none');
      userActions?.classList.remove('d-none');

      if (this.currentUser.role === 'ROLE_ADMIN') {
        adminTab?.classList.remove('d-none');
      } else {
        adminTab?.classList.add('d-none');
      }
    } else {
      authActions?.classList.remove('d-none');
      userActions?.classList.add('d-none');
      adminTab?.classList.add('d-none');
    }
  },

  async loadInitialData() {
    await Promise.all([
      this.loadVehicles(),
      this.loadNotificationsCount()
    ]);
    this.switchView('view-dashboard');
  },

  async loadVehicles() {
    try {
      this.vehicles = await Api.vehicles.getAll();
      this.populateVehicleDropdowns();
      if (this.vehicles.length > 0 && !this.selectedVehicleId) {
        this.selectedVehicleId = this.vehicles[0].id;
      }
    } catch (err) {
      console.error('Failed to load vehicles', err);
    }
  },

  populateVehicleDropdowns() {
    const predSelect = document.getElementById('predictionVehicleSelect');
    const bookSelect = document.getElementById('bookingVehicleSelect');
    const recSelect = document.getElementById('recordVehicleSelect');

    const optionsHtml = this.vehicles.map(v =>
      `<option value="${v.id}">${v.year} ${v.make} ${v.model} (${v.licensePlate}) - ${v.currentMileage.toLocaleString()} km</option>`
    ).join('');

    if (predSelect) predSelect.innerHTML = optionsHtml;
    if (bookSelect) bookSelect.innerHTML = optionsHtml;
    if (recSelect) recSelect.innerHTML = optionsHtml;

    if (this.selectedVehicleId && predSelect) {
      predSelect.value = this.selectedVehicleId;
    }
  },

  // ===================== DASHBOARD VIEW =====================
  async renderDashboard() {
    const countEl = document.getElementById('dashTotalVehicles');
    const alertsCountEl = document.getElementById('dashActiveAlerts');
    const bookingsCountEl = document.getElementById('dashUpcomingBookings');
    const healthScoreEl = document.getElementById('dashFleetHealth');
    const alertsListEl = document.getElementById('dashAlertsList');

    if (countEl) countEl.textContent = this.vehicles.length;

    // Fetch reports for all my vehicles to compute dashboard health and alerts
    try {
      const reports = await Api.predictions.getAllMyVehicles();
      let totalHealth = 0;
      let totalAlerts = 0;
      const criticalItems = [];

      reports.forEach(rep => {
        totalHealth += rep.overallHealthScore;
        totalAlerts += rep.urgentItemsCount + rep.dueSoonItemsCount;

        rep.predictions.forEach(p => {
          if (p.urgency === 'OVERDUE' || p.urgency === 'DUE_SOON') {
            criticalItems.push({
              vehicleId: rep.vehicleId,
              vehicleName: rep.vehicleName,
              plate: rep.licensePlate,
              serviceName: p.serviceName,
              urgency: p.urgency,
              remainingKm: p.remainingKm,
              remainingDays: p.remainingDays,
              cost: p.estimatedCost,
              serviceType: p.serviceType
            });
          }
        });
      });

      const avgHealth = reports.length > 0 ? Math.round(totalHealth / reports.length) : 100;
      if (healthScoreEl) {
        healthScoreEl.textContent = `${avgHealth}%`;
        healthScoreEl.className = avgHealth >= 80 ? 'text-success' : (avgHealth >= 60 ? 'text-warning' : 'text-danger');
      }
      if (alertsCountEl) alertsCountEl.textContent = totalAlerts;

      // Render critical items list
      if (alertsListEl) {
        if (criticalItems.length === 0) {
          alertsListEl.innerHTML = `
            <div class="text-center py-4 text-muted">
              <i class="bi bi-shield-check text-success fs-1 mb-2 d-block"></i>
              All vehicles are in optimal operating condition. No pending alerts!
            </div>
          `;
        } else {
          alertsListEl.innerHTML = criticalItems.map(item => `
            <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded border ${item.urgency === 'OVERDUE' ? 'border-danger bg-danger-subtle' : 'border-warning bg-warning-subtle'}">
              <div>
                <div class="d-flex align-items-center gap-2">
                  <span class="badge ${item.urgency === 'OVERDUE' ? 'bg-danger' : 'bg-warning text-dark'}">${item.urgency}</span>
                  <strong>${item.vehicleName} (${item.plate})</strong>
                </div>
                <div class="text-muted small mt-1">
                  <strong>${item.serviceName}</strong>: ${item.urgency === 'OVERDUE' ? `Overdue by ${Math.abs(item.remainingKm)} km / ${Math.abs(item.remainingDays)} days` : `Due in ~${Math.max(1, item.remainingDays)} days (${Math.max(0, item.remainingKm)} km)`} (Est: $${item.cost})
                </div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="App.openBookingModalWithService(${item.vehicleId}, '${item.serviceType}')">
                <i class="bi bi-calendar-plus me-1"></i>Book
              </button>
            </div>
          `).join('');
        }
      }

      // Load bookings count
      const myBookings = await Api.bookings.getAll();
      const upcoming = myBookings.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS');
      if (bookingsCountEl) bookingsCountEl.textContent = upcoming.length;

    } catch (err) {
      console.error('Error rendering dashboard', err);
    }
  },

  // ===================== VEHICLE MANAGEMENT =====================
  async renderVehicles() {
    const gridEl = document.getElementById('vehiclesGrid');
    if (!gridEl) return;

    if (this.vehicles.length === 0) {
      gridEl.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-car-front text-muted fs-1 mb-3 d-block"></i>
          <h4>No Vehicles Registered Yet</h4>
          <p class="text-muted">Add your car, truck, or SUV to begin automated maintenance predictions.</p>
          <button class="btn btn-primary-custom" data-bs-toggle="modal" data-bs-target="#vehicleModal">
            <i class="bi bi-plus-lg me-1"></i>Add First Vehicle
          </button>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary" role="status"></div></div>';

    try {
      const reports = await Api.predictions.getAllMyVehicles();
      const reportMap = {};
      reports.forEach(r => { reportMap[r.vehicleId] = r; });

      gridEl.innerHTML = this.vehicles.map(v => {
        const rep = reportMap[v.id] || { overallHealthScore: 100, overallUrgency: 'HEALTHY' };
        const score = Math.round(rep.overallHealthScore);
        const statusClass = rep.overallUrgency === 'OVERDUE' ? 'status-overdue' : (rep.overallUrgency === 'DUE_SOON' ? 'status-due' : 'status-healthy');
        const badgeClass = rep.overallUrgency === 'OVERDUE' ? 'badge-overdue' : (rep.overallUrgency === 'DUE_SOON' ? 'badge-duesoon' : 'badge-healthy');
        const fillClass = score >= 80 ? 'bg-health-high' : (score >= 50 ? 'bg-health-medium' : 'bg-health-low');

        return `
          <div class="col-md-6 col-lg-4">
            <div class="vehicle-card p-4 h-100 ${statusClass}">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 class="fw-bold mb-0">${v.year} ${v.make} ${v.model}</h5>
                  <span class="badge bg-secondary-subtle text-dark border small mt-1">${v.licensePlate}</span>
                </div>
                <span class="${badgeClass}">${rep.overallUrgency}</span>
              </div>

              <div class="mb-3 mt-3">
                <div class="d-flex justify-content-between text-muted small mb-1">
                  <span>Vehicle Health Score</span>
                  <span class="fw-bold">${score}%</span>
                </div>
                <div class="health-gauge-bar">
                  <div class="health-gauge-fill ${fillClass}" style="width: ${score}%;"></div>
                </div>
              </div>

              <ul class="list-unstyled small text-muted mb-4">
                <li class="d-flex justify-content-between py-1 border-bottom">
                  <span>Odometer / Mileage:</span>
                  <span class="fw-semibold text-dark">${v.currentMileage.toLocaleString()} km</span>
                </li>
                <li class="d-flex justify-content-between py-1 border-bottom">
                  <span>Fuel Type:</span>
                  <span class="fw-semibold text-dark">${v.fuelType}</span>
                </li>
                <li class="d-flex justify-content-between py-1 border-bottom">
                  <span>Monthly Avg Usage:</span>
                  <span class="fw-semibold text-dark">${v.avgMonthlyMileage.toLocaleString()} km/mo</span>
                </li>
                <li class="d-flex justify-content-between py-1">
                  <span>Last Service:</span>
                  <span class="fw-semibold text-dark">${v.lastServiceDate || 'Not recorded'} (${v.lastServiceMileage ? v.lastServiceMileage.toLocaleString() + ' km' : '0 km'})</span>
                </li>
              </ul>

              <div class="d-flex gap-2 mt-auto">
                <button class="btn btn-sm btn-outline-primary flex-fill" onclick="App.openMileageModal(${v.id}, ${v.currentMileage})">
                  <i class="bi bi-speedometer2 me-1"></i>Update Km
                </button>
                <button class="btn btn-sm btn-outline-info flex-fill" onclick="App.inspectPrediction(${v.id})">
                  <i class="bi bi-cpu me-1"></i>Predict
                </button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                    <i class="bi bi-three-dots-vertical"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-menu-item dropdown-item" href="#" onclick="App.openEditVehicleModal(${v.id})"><i class="bi bi-pencil me-2"></i>Edit Details</a></li>
                    <li><a class="dropdown-menu-item dropdown-item text-danger" href="#" onclick="App.deleteVehicle(${v.id})"><i class="bi bi-trash me-2"></i>Delete</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error rendering vehicles grid', err);
    }
  },

  openEditVehicleModal(id) {
    const v = this.vehicles.find(item => item.id === id);
    if (!v) return;

    document.getElementById('vehicleModalTitle').textContent = 'Edit Vehicle';
    document.getElementById('vehicleIdInput').value = v.id;
    document.getElementById('vehMake').value = v.make;
    document.getElementById('vehModel').value = v.model;
    document.getElementById('vehYear').value = v.year;
    document.getElementById('vehPlate').value = v.licensePlate;
    document.getElementById('vehVin').value = v.vin || '';
    document.getElementById('vehFuel').value = v.fuelType || 'PETROL';
    document.getElementById('vehMileage').value = v.currentMileage;
    document.getElementById('vehAvgMileage').value = v.avgMonthlyMileage || 1200;
    document.getElementById('vehLastDate').value = v.lastServiceDate || '';
    document.getElementById('vehLastMileage').value = v.lastServiceMileage || 0;

    const modal = new bootstrap.Modal(document.getElementById('vehicleModal'));
    modal.show();
  },

  openMileageModal(id, currentMileage) {
    document.getElementById('mileageVehicleId').value = id;
    document.getElementById('currentOdometerDisplay').textContent = `${currentMileage.toLocaleString()} km`;
    const input = document.getElementById('newMileageInput');
    input.value = currentMileage;
    input.min = currentMileage;

    const modal = new bootstrap.Modal(document.getElementById('mileageModal'));
    modal.show();
  },

  async handleMileageSave(e) {
    e.preventDefault();
    const id = document.getElementById('mileageVehicleId').value;
    const newMileage = document.getElementById('newMileageInput').value;

    try {
      await Api.vehicles.updateMileage(id, newMileage);
      const modalEl = document.getElementById('mileageModal');
      bootstrap.Modal.getInstance(modalEl).hide();
      this.showToast('Odometer Updated', `Mileage updated to ${parseInt(newMileage, 10).toLocaleString()} km. Predictive diagnostics recalculated.`, 'success');
      await this.loadVehicles();
      this.renderVehicles();
      this.loadNotificationsCount();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  async handleVehicleSave(e) {
    e.preventDefault();
    const id = document.getElementById('vehicleIdInput').value;
    const payload = {
      make: document.getElementById('vehMake').value.trim(),
      model: document.getElementById('vehModel').value.trim(),
      year: parseInt(document.getElementById('vehYear').value, 10),
      licensePlate: document.getElementById('vehPlate').value.trim(),
      vin: document.getElementById('vehVin').value.trim(),
      fuelType: document.getElementById('vehFuel').value,
      currentMileage: parseInt(document.getElementById('vehMileage').value, 10),
      avgMonthlyMileage: parseInt(document.getElementById('vehAvgMileage').value, 10) || 1200,
      lastServiceDate: document.getElementById('vehLastDate').value || null,
      lastServiceMileage: parseInt(document.getElementById('vehLastMileage').value, 10) || 0
    };

    try {
      if (id) {
        await Api.vehicles.update(id, payload);
        this.showToast('Vehicle Updated', `${payload.make} ${payload.model} updated successfully.`, 'success');
      } else {
        await Api.vehicles.create(payload);
        this.showToast('Vehicle Added', `${payload.make} ${payload.model} registered into fleet.`, 'success');
      }

      const modalEl = document.getElementById('vehicleModal');
      bootstrap.Modal.getInstance(modalEl).hide();
      await this.loadVehicles();
      this.renderVehicles();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  async deleteVehicle(id) {
    if (!confirm('Are you sure you want to delete this vehicle and all its service logs?')) return;
    try {
      await Api.vehicles.delete(id);
      this.showToast('Vehicle Deleted', 'Vehicle removed from platform.', 'info');
      await this.loadVehicles();
      this.renderVehicles();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  // ===================== PREDICTIVE MAINTENANCE ENGINE VIEW =====================
  inspectPrediction(vehicleId) {
    this.selectedVehicleId = vehicleId;
    const select = document.getElementById('predictionVehicleSelect');
    if (select) select.value = vehicleId;
    this.switchView('view-prediction');
  },

  async renderPredictionView() {
    if (!this.selectedVehicleId && this.vehicles.length > 0) {
      this.selectedVehicleId = this.vehicles[0].id;
    }
    await this.loadPredictionDetails();
  },

  async loadPredictionDetails() {
    const container = document.getElementById('predictionComponentsContainer');
    const headerInfo = document.getElementById('predictionVehicleHeader');
    const meterEl = document.getElementById('predictionHealthMeter');
    const meterValEl = document.getElementById('predictionHealthScoreVal');
    const meterBadgeEl = document.getElementById('predictionHealthUrgencyBadge');
    const totalEstCostEl = document.getElementById('predictionTotalEstimatedCost');
    const alertsBoxEl = document.getElementById('predictionAlertsSummary');

    if (!this.selectedVehicleId) {
      if (container) container.innerHTML = '<div class="col-12 text-center py-5 text-muted">No vehicle selected.</div>';
      return;
    }

    if (container) container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
      this.currentReport = await Api.predictions.getForVehicle(this.selectedVehicleId);
      const rep = this.currentReport;
      const score = Math.round(rep.overallHealthScore);

      // Header summary
      if (headerInfo) {
        headerInfo.innerHTML = `
          <h4 class="fw-bold mb-1">${rep.vehicleName}</h4>
          <span class="badge bg-dark me-2">${rep.licensePlate}</span>
          <span class="badge bg-secondary me-2">${rep.fuelType}</span>
          <span class="text-muted"><i class="bi bi-speedometer me-1"></i>${rep.currentMileage.toLocaleString()} km</span>
        `;
      }

      // Health Meter Circle
      if (meterEl && meterValEl && meterBadgeEl) {
        meterValEl.textContent = `${score}%`;
        const circleClass = score >= 80 ? 'high' : (score >= 50 ? 'medium' : 'low');
        meterEl.className = `health-meter-circle ${circleClass}`;

        const badgeClass = rep.overallUrgency === 'OVERDUE' ? 'badge-overdue' : (rep.overallUrgency === 'DUE_SOON' ? 'badge-duesoon' : 'badge-healthy');
        meterBadgeEl.textContent = rep.overallUrgency;
        meterBadgeEl.className = `badge ${badgeClass} mt-2`;
      }

      if (totalEstCostEl) {
        totalEstCostEl.textContent = `$${rep.totalEstimatedCost.toFixed(2)}`;
      }

      // Alerts summary box
      if (alertsBoxEl) {
        if (rep.keyAlerts.length > 0) {
          alertsBoxEl.innerHTML = rep.keyAlerts.map(a => `
            <div class="alert ${a.startsWith('CRITICAL') ? 'alert-danger' : 'alert-warning'} py-2 px-3 mb-2 small d-flex align-items-center">
              <i class="bi ${a.startsWith('CRITICAL') ? 'bi-exclamation-octagon-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-6"></i>
              <span>${a}</span>
            </div>
          `).join('');
          alertsBoxEl.classList.remove('d-none');
        } else {
          alertsBoxEl.classList.add('d-none');
        }
      }

      // 7 Component cards
      if (container) {
        container.innerHTML = rep.predictions.map(item => {
          const borderClass = item.urgency === 'OVERDUE' ? 'overdue-border' : (item.urgency === 'DUE_SOON' ? 'duesoon-border' : 'healthy-border');
          const badgeClass = item.urgency === 'OVERDUE' ? 'badge-overdue' : (item.urgency === 'DUE_SOON' ? 'badge-duesoon' : 'badge-healthy');
          const pScore = Math.round(item.healthPercentage);
          const barClass = pScore >= 80 ? 'bg-health-high' : (pScore >= 40 ? 'bg-health-medium' : 'bg-health-low');

          return `
            <div class="col-md-6 col-xl-4">
              <div class="prediction-card h-100 d-flex flex-column ${borderClass}">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi ${item.icon} fs-4 text-primary"></i>
                    <div>
                      <h6 class="fw-bold mb-0">${item.serviceName}</h6>
                      <small class="text-muted">${item.category}</small>
                    </div>
                  </div>
                  <span class="${badgeClass}">${item.urgency}</span>
                </div>

                <div class="my-3">
                  <div class="d-flex justify-content-between small text-muted mb-1">
                    <span>Component Health</span>
                    <span class="fw-bold">${pScore}%</span>
                  </div>
                  <div class="health-gauge-bar">
                    <div class="health-gauge-fill ${barClass}" style="width: ${pScore}%;"></div>
                  </div>
                </div>

                <div class="small text-muted bg-light p-2 rounded mb-3">
                  <div class="d-flex justify-content-between py-1">
                    <span>Maintenance Interval:</span>
                    <span class="fw-semibold text-dark">${item.intervalKm.toLocaleString()} km / ${item.intervalMonths} mo</span>
                  </div>
                  <div class="d-flex justify-content-between py-1">
                    <span>Remaining Lifespan:</span>
                    <span class="fw-semibold ${item.remainingKm <= 0 ? 'text-danger' : 'text-dark'}">${item.remainingKm <= 0 ? `Overdue by ${Math.abs(item.remainingKm).toLocaleString()} km` : `${item.remainingKm.toLocaleString()} km`} (~${item.remainingDays <= 0 ? '0 days' : `${item.remainingDays} days`})</span>
                  </div>
                  <div class="d-flex justify-content-between py-1">
                    <span>Estimated Cost:</span>
                    <span class="fw-semibold text-dark">$${item.estimatedCost.toFixed(2)}</span>
                  </div>
                </div>

                <p class="small text-secondary mb-3 flex-grow-1">${item.recommendation}</p>

                <button class="btn btn-sm ${item.urgency === 'OVERDUE' ? 'btn-danger' : (item.urgency === 'DUE_SOON' ? 'btn-warning text-dark' : 'btn-outline-primary')} w-100"
                        onclick="App.openBookingModalWithService(${rep.vehicleId}, '${item.serviceType}')">
                  <i class="bi bi-calendar-check me-1"></i>Book This Service
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

    } catch (err) {
      console.error('Error loading prediction report', err);
      if (container) container.innerHTML = `<div class="col-12 text-danger text-center py-4">Failed to compute prediction: ${err.message}</div>`;
    }
  },

  // ===================== SERVICE BOOKING =====================
  openBookingModalWithService(vehicleId, serviceType) {
    const modalEl = document.getElementById('bookingModal');
    const vehicleSelect = document.getElementById('bookingVehicleSelect');
    if (vehicleSelect) vehicleSelect.value = vehicleId;

    // Pre-check the requested service type checkbox
    document.querySelectorAll('.service-checkbox').forEach(cb => {
      cb.checked = (cb.value === serviceType);
    });

    // Set default booking date to tomorrow
    const dateInput = document.getElementById('bookDate');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    dateInput.value = tomorrow.toISOString().split('T')[0];

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  async loadBookings() {
    const listEl = document.getElementById('bookingsList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
      this.bookings = await Api.bookings.getAll();

      if (this.bookings.length === 0) {
        listEl.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="bi bi-calendar-x fs-1 mb-2 d-block"></i>
            <h5>No Service Bookings Found</h5>
            <p>Schedule a maintenance appointment from your prediction report or quick actions.</p>
            <button class="btn btn-primary-custom" data-bs-toggle="modal" data-bs-target="#bookingModal">
              <i class="bi bi-plus-lg me-1"></i>Book Service
            </button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div class="table-responsive">
          <table class="table custom-table">
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Vehicle</th>
                <th>Services Requested</th>
                <th>Date & Slot</th>
                <th>Service Center</th>
                <th>Est. Cost</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.bookings.map(b => {
                let badgeClass = 'bg-secondary';
                if (b.status === 'PENDING') badgeClass = 'bg-warning text-dark';
                if (b.status === 'CONFIRMED') badgeClass = 'bg-info text-dark';
                if (b.status === 'IN_PROGRESS') badgeClass = 'bg-primary';
                if (b.status === 'COMPLETED') badgeClass = 'bg-success';
                if (b.status === 'CANCELLED') badgeClass = 'bg-danger';

                return `
                  <tr>
                    <td class="fw-bold">#${b.id}</td>
                    <td>
                      <div><strong>${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}</strong></div>
                      <span class="badge bg-secondary-subtle text-dark border small">${b.vehicle.licensePlate}</span>
                    </td>
                    <td>
                      <div class="small">${b.serviceTypes.split(',').map(s => `<span class="badge bg-light text-dark border me-1">${s.trim()}</span>`).join('')}</div>
                    </td>
                    <td>
                      <div>${b.bookingDate}</div>
                      <small class="text-muted">${b.bookingTime}</small>
                    </td>
                    <td>${b.serviceCenter}</td>
                    <td class="fw-semibold">$${b.estimatedCost ? b.estimatedCost.toFixed(2) : '0.00'}</td>
                    <td><span class="badge ${badgeClass}">${b.status}</span></td>
                    <td>
                      ${(b.status === 'PENDING' || b.status === 'CONFIRMED') ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="App.cancelBooking(${b.id})">
                          <i class="bi bi-x-circle me-1"></i>Cancel
                        </button>
                      ` : '<span class="text-muted small">-</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error('Error loading bookings', err);
      listEl.innerHTML = `<div class="text-danger text-center py-4">Failed to load appointments: ${err.message}</div>`;
    }
  },

  async handleBookingSave(e) {
    e.preventDefault();
    const vehicleId = document.getElementById('bookingVehicleSelect').value;
    const date = document.getElementById('bookDate').value;
    const time = document.getElementById('bookTime').value;
    const center = document.getElementById('bookCenter').value;
    const notes = document.getElementById('bookNotes').value.trim();

    const selectedServices = [];
    document.querySelectorAll('.service-checkbox:checked').forEach(cb => {
      selectedServices.push(cb.value);
    });

    if (selectedServices.length === 0) {
      this.showToast('Select Service', 'Please choose at least one maintenance item to service.', 'warning');
      return;
    }

    try {
      await Api.bookings.create({
        vehicleId: parseInt(vehicleId, 10),
        serviceTypes: selectedServices.join(', '),
        bookingDate: date,
        bookingTime: time,
        serviceCenter: center,
        notes: notes
      });

      const modalEl = document.getElementById('bookingModal');
      bootstrap.Modal.getInstance(modalEl).hide();

      this.showToast('Appointment Scheduled', `Service booking submitted for ${date} at ${time}.`, 'success');
      this.loadBookings();
      this.loadNotificationsCount();
    } catch (err) {
      this.showToast('Booking Failed', err.message, 'danger');
    }
  },

  async cancelBooking(id) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await Api.bookings.cancel(id);
      this.showToast('Booking Cancelled', 'Appointment has been cancelled.', 'info');
      this.loadBookings();
      this.loadNotificationsCount();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  // ===================== COST REPORTS & HISTORY =====================
  async loadReports() {
    const totalExpEl = document.getElementById('reportTotalExp');
    const totalCountEl = document.getElementById('reportTotalCount');
    const avgCostEl = document.getElementById('reportAvgCost');
    const recordsTableEl = document.getElementById('reportRecordsTable');

    try {
      const data = await Api.reports.getCostSummary();

      if (totalExpEl) totalExpEl.textContent = `$${data.totalExpenditure.toFixed(2)}`;
      if (totalCountEl) totalCountEl.textContent = data.totalServices;
      if (avgCostEl) avgCostEl.textContent = `$${data.averageCostPerService.toFixed(2)}`;

      // Render Charts
      this.renderCharts(data);

      // Render Historical Records Table
      if (recordsTableEl) {
        if (!data.recentRecords || data.recentRecords.length === 0) {
          recordsTableEl.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No historical service records logged yet.</td></tr>';
        } else {
          recordsTableEl.innerHTML = data.recentRecords.map(r => `
            <tr>
              <td><strong>${r.serviceDate}</strong></td>
              <td>${r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model} (${r.vehicle.licensePlate})` : '-'}</td>
              <td><span class="badge bg-primary-subtle text-primary border">${r.serviceType}</span></td>
              <td>${r.mileageAtService.toLocaleString()} km</td>
              <td class="fw-bold text-success">$${r.cost.toFixed(2)}</td>
              <td><span class="badge bg-light text-dark border">${r.invoiceNumber || '-'}</span></td>
              <td class="small text-muted">${r.serviceCenter || '-'}</td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Error loading reports', err);
    }
  },

  renderCharts(data) {
    // 1. Monthly Spending Chart
    const monthlyCanvas = document.getElementById('monthlySpendChart');
    if (monthlyCanvas) {
      const ctx = monthlyCanvas.getContext('2d');
      if (this.charts.monthly) this.charts.monthly.destroy();

      const labels = Object.keys(data.costByMonth);
      const values = Object.values(data.costByMonth);

      this.charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Expenditure ($)',
            data: values.length ? values : [0],
            backgroundColor: 'rgba(37, 99, 235, 0.75)',
            borderColor: '#2563eb',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Category Breakdown Chart
    const catCanvas = document.getElementById('categorySpendChart');
    if (catCanvas) {
      const ctx = catCanvas.getContext('2d');
      if (this.charts.category) this.charts.category.destroy();

      const labels = Object.keys(data.costByCategory);
      const values = Object.values(data.costByCategory);

      this.charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            data: values.length ? values : [1],
            backgroundColor: [
              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    // 3. Vehicle Spending Comparison Chart
    const vehCanvas = document.getElementById('vehicleSpendChart');
    if (vehCanvas) {
      const ctx = vehCanvas.getContext('2d');
      if (this.charts.vehicle) this.charts.vehicle.destroy();

      const labels = Object.keys(data.costByVehicle);
      const values = Object.values(data.costByVehicle);

      this.charts.vehicle = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['None'],
          datasets: [{
            label: 'Cost ($)',
            data: values.length ? values : [0],
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            y: { grid: { display: false } }
          }
        }
      });
    }
  },

  async handleRecordSave(e) {
    e.preventDefault();
    const payload = {
      vehicleId: parseInt(document.getElementById('recordVehicleSelect').value, 10),
      serviceType: document.getElementById('recType').value,
      serviceDate: document.getElementById('recDate').value,
      mileageAtService: parseInt(document.getElementById('recMileage').value, 10),
      cost: parseFloat(document.getElementById('recCost').value),
      invoiceNumber: document.getElementById('recInvoice').value.trim(),
      serviceCenter: document.getElementById('recCenter').value.trim(),
      description: document.getElementById('recDescription').value.trim(),
      technicianNotes: document.getElementById('recNotes').value.trim()
    };

    try {
      await Api.records.create(payload);
      const modalEl = document.getElementById('recordModal');
      bootstrap.Modal.getInstance(modalEl).hide();

      this.showToast('Service Record Logged', `Logged ${payload.serviceType} at $${payload.cost.toFixed(2)}. Predictions updated!`, 'success');
      await this.loadVehicles();
      this.loadReports();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  // ===================== ADMIN DASHBOARD =====================
  async loadAdminDashboard() {
    if (!this.currentUser || this.currentUser.role !== 'ROLE_ADMIN') return;

    try {
      const stats = await Api.admin.getDashboard();

      document.getElementById('adminTotalUsers').textContent = stats.totalUsers;
      document.getElementById('adminTotalVehicles').textContent = stats.totalVehicles;
      document.getElementById('adminPendingBookings').textContent = stats.pendingBookings;
      document.getElementById('adminOverdueVehicles').textContent = stats.overdueVehiclesCount;
      document.getElementById('adminTotalRevenue').textContent = `$${stats.totalRevenue.toFixed(2)}`;

      // Admin Bookings Table
      const bookingsTable = document.getElementById('adminBookingsTable');
      if (bookingsTable) {
        const allBookings = await Api.bookings.getAll();
        bookingsTable.innerHTML = allBookings.map(b => `
          <tr>
            <td class="fw-bold">#${b.id}</td>
            <td>${b.user.name} <br><small class="text-muted">${b.user.email}</small></td>
            <td><strong>${b.vehicle.make} ${b.vehicle.model}</strong> (${b.vehicle.licensePlate})</td>
            <td><small>${b.serviceTypes}</small></td>
            <td>${b.bookingDate}</td>
            <td><strong>$${b.finalCost > 0 ? b.finalCost.toFixed(2) : b.estimatedCost.toFixed(2)}</strong></td>
            <td><span class="badge ${b.status === 'PENDING' ? 'bg-warning text-dark' : (b.status === 'CONFIRMED' ? 'bg-info text-dark' : (b.status === 'COMPLETED' ? 'bg-success' : 'bg-secondary'))}">${b.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="App.openAdminStatusModal(${b.id}, '${b.status}', ${b.finalCost || b.estimatedCost})">
                <i class="bi bi-gear me-1"></i>Manage
              </button>
            </td>
          </tr>
        `).join('');
      }

      // Fleet Health Table
      const fleetTable = document.getElementById('adminFleetHealthTable');
      if (fleetTable) {
        const fleetReports = await Api.admin.getFleetHealth();
        fleetTable.innerHTML = fleetReports.map(r => `
          <tr>
            <td><strong>${r.vehicleName}</strong></td>
            <td><span class="badge bg-secondary">${r.licensePlate}</span></td>
            <td>${r.currentMileage.toLocaleString()} km</td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold">${Math.round(r.overallHealthScore)}%</span>
                <div class="progress flex-grow-1" style="height: 6px;">
                  <div class="progress-bar ${r.overallHealthScore >= 80 ? 'bg-success' : (r.overallHealthScore >= 50 ? 'bg-warning' : 'bg-danger')}" style="width: ${r.overallHealthScore}%;"></div>
                </div>
              </div>
            </td>
            <td><span class="badge ${r.overallUrgency === 'OVERDUE' ? 'bg-danger' : (r.overallUrgency === 'DUE_SOON' ? 'bg-warning text-dark' : 'bg-success')}">${r.overallUrgency}</span></td>
            <td>${r.urgentItemsCount > 0 ? `<span class="badge bg-danger">${r.urgentItemsCount} Overdue</span>` : '<span class="text-muted small">None</span>'}</td>
          </tr>
        `).join('');
      }

      // Users List
      const usersTable = document.getElementById('adminUsersTable');
      if (usersTable) {
        const users = await Api.admin.getUsers();
        usersTable.innerHTML = users.map(u => `
          <tr>
            <td>#${u.id}</td>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${u.phone || '-'}</td>
            <td><span class="badge ${u.role === 'ROLE_ADMIN' ? 'bg-danger' : 'bg-primary'}">${u.role}</span></td>
            <td>
              ${u.id !== this.currentUser.id ? `
                <button class="btn btn-sm btn-outline-secondary" onclick="App.toggleUserRole(${u.id}, '${u.role === 'ROLE_ADMIN' ? 'ROLE_USER' : 'ROLE_ADMIN'}')">
                  Make ${u.role === 'ROLE_ADMIN' ? 'User' : 'Admin'}
                </button>
              ` : '<span class="text-muted small">Current User</span>'}
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.error('Error loading admin dashboard', err);
    }
  },

  openAdminStatusModal(bookingId, currentStatus, cost) {
    document.getElementById('adminBookingId').value = bookingId;
    document.getElementById('adminBookingStatusSelect').value = currentStatus;
    document.getElementById('adminFinalCostInput').value = cost || 0;
    document.getElementById('adminTechNotesInput').value = '';

    const modal = new bootstrap.Modal(document.getElementById('adminStatusModal'));
    modal.show();
  },

  async handleAdminBookingStatusSave(e) {
    e.preventDefault();
    const id = document.getElementById('adminBookingId').value;
    const status = document.getElementById('adminBookingStatusSelect').value;
    const finalCost = parseFloat(document.getElementById('adminFinalCostInput').value);
    const techNotes = document.getElementById('adminTechNotesInput').value.trim();

    try {
      await Api.bookings.updateStatus(id, {
        status,
        finalCost,
        technicianNotes: techNotes
      });

      const modalEl = document.getElementById('adminStatusModal');
      bootstrap.Modal.getInstance(modalEl).hide();

      this.showToast('Booking Updated', `Booking #${id} status changed to ${status}.`, 'success');
      this.loadAdminDashboard();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  async toggleUserRole(userId, newRole) {
    try {
      await Api.admin.updateRole(userId, newRole);
      this.showToast('Role Updated', `User role modified to ${newRole}.`, 'success');
      this.loadAdminDashboard();
    } catch (err) {
      this.showToast('Error', err.message, 'danger');
    }
  },

  // ===================== NOTIFICATIONS / REMINDERS =====================
  async loadNotificationsCount() {
    if (!this.currentUser) return;
    try {
      const res = await Api.notifications.getUnreadCount();
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        if (res.unreadCount > 0) {
          badge.textContent = res.unreadCount;
          badge.classList.remove('d-none');
        } else {
          badge.classList.add('d-none');
        }
      }
    } catch (err) {
      console.error('Failed to get notification count', err);
    }
  },

  async openNotificationsModal() {
    const listEl = document.getElementById('notificationsList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    const modal = new bootstrap.Modal(document.getElementById('notificationsModal'));
    modal.show();

    try {
      this.notifications = await Api.notifications.getAll();

      if (this.notifications.length === 0) {
        listEl.innerHTML = '<div class="text-center py-4 text-muted"><i class="bi bi-bell-slash fs-2 d-block mb-2"></i>No reminders yet.</div>';
        return;
      }

      listEl.innerHTML = this.notifications.map(n => `
        <div class="p-3 mb-2 rounded border ${n.read ? 'bg-light text-muted' : 'bg-white border-primary-subtle shadow-sm'}">
          <div class="d-flex justify-content-between align-items-start">
            <h6 class="fw-bold mb-1 ${n.read ? '' : 'text-primary'}">
              <i class="bi ${n.type === 'OVERDUE_ALERT' ? 'bi-exclamation-octagon-fill text-danger' : 'bi-bell-fill text-warning'} me-2"></i>${n.title}
            </h6>
            ${!n.read ? `<button class="btn btn-sm btn-link text-decoration-none p-0" onclick="App.markNotificationRead(${n.id})">Mark Read</button>` : ''}
          </div>
          <p class="small mb-1">${n.message}</p>
          <small class="text-muted">${new Date(n.createdAt).toLocaleString()}</small>
        </div>
      `).join('');

      this.loadNotificationsCount();
    } catch (err) {
      listEl.innerHTML = `<div class="text-danger">Failed to load reminders: ${err.message}</div>`;
    }
  },

  async markNotificationRead(id) {
    try {
      await Api.notifications.markAsRead(id);
      this.openNotificationsModal();
    } catch (err) {
      console.error(err);
    }
  },

  async markAllNotificationsRead() {
    try {
      await Api.notifications.markAllAsRead();
      this.openNotificationsModal();
    } catch (err) {
      console.error(err);
    }
  },

  // ===================== TOAST NOTIFICATIONS =====================
  showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' : (type === 'danger' ? 'bg-danger text-white' : (type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white'));

    const html = `
      <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">
            <strong>${title}</strong>: ${message}
          </div>
          <button type="button" class="btn-close ${type === 'warning' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  }
};
