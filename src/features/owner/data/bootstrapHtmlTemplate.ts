export const bootstrapHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ParkJom - Property Owner Dashboard</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- FontAwesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet">
    <!-- Google Fonts: Plus Jakarta Sans -->
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --parkjom-primary: #0f172a; /* Deep Slate Blue */
            --parkjom-accent: #10b981;  /* Emerald Access Control Green */
            --parkjom-secondary: #1e293b;
            --parkjom-bg: #f8fafc;
            --parkjom-sidebar-width: 260px;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--parkjom-bg);
            color: #0f172a;
            overflow-x: hidden;
        }

        .mono-text {
            font-family: 'JetBrains Mono', monospace;
        }

        /* --- SIDEBAR --- */
        #sidebar {
            width: var(--parkjom-sidebar-width);
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            background-color: var(--parkjom-primary);
            color: #f1f5f9;
            z-index: 1000;
            transition: all 0.3s;
            box-shadow: 4px 0 10px rgba(0,0,0,0.1);
        }

        .sidebar-brand {
            padding: 1.5rem 1rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
        }

        .sidebar-brand i {
            color: var(--parkjom-accent);
            font-size: 1.8rem;
            margin-right: 0.75rem;
        }

        .sidebar-brand h5 {
            margin: 0;
            font-weight: 800;
            letter-spacing: 0.5px;
        }

        .nav-link-custom {
            color: #94a3b8;
            padding: 0.85rem 1.5rem;
            display: flex;
            align-items: center;
            border-left: 4px solid transparent;
            text-decoration: none;
            transition: all 0.2s;
            font-weight: 500;
        }

        .nav-link-custom:hover {
            color: #f8fafc;
            background-color: rgba(255,255,255,0.05);
        }

        .nav-link-custom.active {
            color: #fff;
            background-color: rgba(255,255,255,0.08);
            border-left-color: var(--parkjom-accent);
        }

        .nav-link-custom i {
            width: 25px;
            font-size: 1.1rem;
            margin-right: 0.75rem;
        }

        /* --- MAIN CONTENT LAYOUT --- */
        #content-wrapper {
            margin-left: var(--parkjom-sidebar-width);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            transition: all 0.3s;
        }

        /* --- HEADER --- */
        #top-navbar {
            background-color: #fff;
            border-bottom: 1px solid #e2e8f0;
            padding: 0.75rem 1.5rem;
        }

        .notification-badge {
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 0.65rem;
            padding: 0.25em 0.4em;
            border-radius: 50%;
        }

        /* --- CARDS & PANELS --- */
        .dashboard-card {
            background-color: #fff;
            border: 1px solid rgba(226, 232, 240, 0.8);
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02);
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .dashboard-card:hover {
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02);
        }

        .wallet-card {
            background: linear-gradient(135deg, var(--parkjom-primary) 0%, var(--parkjom-secondary) 100%);
            color: #fff;
            border: none;
        }

        /* --- SCHEDULING CALENDAR --- */
        .schedule-grid-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 5px;
            text-align: center;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .schedule-day-column {
            background-color: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px;
            min-height: 250px;
        }

        .time-block-tag {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--parkjom-accent);
            border: 1px solid rgba(16, 185, 129, 0.2);
            border-radius: 6px;
            padding: 5px 8px;
            font-size: 0.8rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }

        .time-block-tag i {
            cursor: pointer;
            color: #ef4444;
            transition: color 0.15s;
        }

        .time-block-tag i:hover {
            color: #b91c1c;
        }

        /* --- DRAG & DROP ZONE --- */
        .upload-dropzone {
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 2.5rem 1.5rem;
            text-align: center;
            background-color: #f8fafc;
            cursor: pointer;
            transition: all 0.2s;
        }

        .upload-dropzone:hover, .upload-dropzone.dragover {
            border-color: var(--parkjom-accent);
            background-color: rgba(16, 185, 129, 0.02);
        }

        .upload-dropzone i {
            color: #94a3b8;
            font-size: 2.5rem;
            margin-bottom: 1rem;
            transition: color 0.2s;
        }

        .upload-dropzone:hover i {
            color: var(--parkjom-accent);
        }

        /* --- RESPONSIVE TOGGLES --- */
        @media (max-width: 991.98px) {
            #sidebar {
                left: -260px;
            }
            #sidebar.active {
                left: 0;
            }
            #content-wrapper {
                margin-left: 0;
            }
            #content-wrapper.active {
                margin-left: var(--parkjom-sidebar-width);
            }
        }
    </style>
</head>
<body>

    <!-- ========================================== -->
    <!--            ASP.NET MVC MASTER LAYOUT      -->
    <!-- This sidebar/navbar block becomes _Layout.cshtml -->
    <!-- ========================================== -->
    
    <!-- Sidebar -->
    <nav id="sidebar">
        <div class="sidebar-brand">
            <i class="fa-solid fa-square-p"></i>
            <h5>ParkJom</h5>
        </div>
        <div class="mt-4">
            <a href="#" class="nav-link-custom active" data-view="dashboard">
                <i class="fa-solid fa-chart-line"></i> Dashboard
            </a>
            <a href="#" class="nav-link-custom" data-view="availability">
                <i class="fa-solid fa-calendar-days"></i> Availability
            </a>
            <a href="#" class="nav-link-custom" data-view="registration">
                <i class="fa-solid fa-square-plus"></i> Property Registration
            </a>
            <a href="#" class="nav-link-custom" data-view="settings">
                <i class="fa-solid fa-sliders"></i> Settings
            </a>
        </div>
        <div class="position-absolute bottom-0 w-100 p-3 text-center border-top border-secondary">
            <small class="text-muted"><i class="fa-solid fa-microchip me-1"></i> IoT Edge Access Actived</small>
        </div>
    </nav>

    <!-- Main Content Wrapper -->
    <div id="content-wrapper">
        
        <!-- Header / Top Bar -->
        <header id="top-navbar" class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <button id="sidebar-toggle" class="btn btn-outline-secondary btn-sm me-3 d-lg-none">
                    <i class="fa-solid fa-bars"></i>
                </button>
                <div class="d-none d-sm-block">
                    <span class="text-muted">Welcome back,</span>
                    <strong class="text-dark ms-1">Chun Jia</strong>
                </div>
            </div>
            
            <!-- Header Utilities -->
            <div class="d-flex align-items-center gap-3">
                <!-- Notifications Bell -->
                <div class="dropdown">
                    <button class="btn btn-light position-relative p-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fa-regular fa-bell fs-5"></i>
                        <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" id="notification-badge-count">
                            3
                        </span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm" style="width: 320px;">
                        <li><h6 class="dropdown-header">Recent Notifications</h6></li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item py-2" href="#">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong class="text-success"><i class="fa-solid fa-wallet me-1"></i> Withdrawal Success</strong>
                                    <small class="text-muted">1h ago</small>
                                </div>
                                <p class="mb-0 text-muted small">RM 120.00 transferred to Maybank account</p>
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item py-2" href="#">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong><i class="fa-solid fa-circle-check text-info me-1"></i> New Booking Confirmed</strong>
                                    <small class="text-muted">3h ago</small>
                                </div>
                                <p class="mb-0 text-muted small">Wira WXG 2345 at Bay 104 (Wangsa Maju LRT)</p>
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item py-2" href="#">
                                <div class="d-flex justify-content-between align-items-center">
                                    <strong class="text-warning"><i class="fa-solid fa-triangle-exclamation me-1"></i> Spot Disputed</strong>
                                    <small class="text-muted">1d ago</small>
                                </div>
                                <p class="mb-0 text-muted small">Booking resolved: Overstay penalty credited</p>
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-center text-primary py-2 small" href="#">Mark all as read</a></li>
                    </ul>
                </div>

                <!-- User Dropdown -->
                <div class="dropdown">
                    <button class="btn btn-light dropdown-toggle d-flex align-items-center gap-2 p-1 pe-3 border rounded-pill" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop" alt="Profile" class="rounded-circle" style="width: 32px; height: 32px; object-fit: cover;">
                        <span class="small fw-semibold">Chun Jia (Owner)</span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                        <li><a class="dropdown-item" href="#" onclick="switchView('settings')"><i class="fa-solid fa-user me-2"></i> Profile Settings</a></li>
                        <li><a class="dropdown-item" href="#"><i class="fa-solid fa-building me-2"></i> My Parking Bays</a></li>
                        <li><a class="dropdown-item" href="#"><i class="fa-solid fa-wallet me-2"></i> Wallet Ledger</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#"><i class="fa-solid fa-right-from-bracket me-2"></i> Log Out</a></li>
                    </ul>
                </div>
            </div>
        </header>

        <!-- Main Content (Razor RenderBody() in ASP.NET Core) -->
        <main class="flex-grow-1 p-4">
            
            <!-- ========================================== -->
            <!--          VIEW 1: EARNINGS & HOME VIEW       -->
            <!-- ========================================== -->
            <div id="view-dashboard" class="view-panel">
                <div class="row align-items-center mb-4">
                    <div class="col">
                        <h4 class="fw-bold mb-1">Owner Supply Overview</h4>
                        <p class="text-muted mb-0">Monitor your earnings and real-time reservations near RapidKL transit nodes.</p>
                    </div>
                    <div class="col-auto">
                        <span class="badge bg-success-subtle text-success border border-success p-2">
                            <span class="status-pulse me-1"></span> Platform Integrity: Active
                        </span>
                    </div>
                </div>

                <!-- Metrics & Balance -->
                <div class="row">
                    <!-- Current in-app Wallet Balance -->
                    <div class="col-lg-4 col-md-12 mb-4">
                        <div class="dashboard-card wallet-card h-100 d-flex flex-column justify-content-between">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="text-white-50"><i class="fa-solid fa-wallet me-2"></i> In-App Wallet</span>
                                    <span class="badge bg-success text-white">Verified Host</span>
                                </div>
                                <h6 class="text-white-50 mb-1">Current Withdrawable Balance</h6>
                                <h1 class="fw-bold mb-3 mono-text text-white">RM <span id="wallet-balance">450.00</span></h1>
                            </div>
                            <button class="btn btn-light text-dark w-100 fw-bold py-2 mt-2" data-bs-toggle="modal" data-bs-target="#withdrawModal">
                                <i class="fa-solid fa-money-bill-transfer me-2"></i> Withdraw Funds
                            </button>
                        </div>
                    </div>

                    <!-- Upcoming Bookings Metric -->
                    <div class="col-lg-8 col-md-12">
                        <div class="row h-100">
                            <div class="col-md-4 mb-4">
                                <div class="dashboard-card h-100 d-flex flex-column justify-content-between">
                                    <div class="d-flex align-items-center justify-content-between">
                                        <span class="text-muted font-weight-bold">Upcoming Bookings</span>
                                        <div class="p-2 bg-primary-subtle text-primary rounded-3">
                                            <i class="fa-regular fa-calendar-check fs-4"></i>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <h2 class="fw-bold mb-1">3</h2>
                                        <p class="text-success small mb-0"><i class="fa-solid fa-arrow-up me-1"></i> Next spot today 08:30 AM</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4 mb-4">
                                <div class="dashboard-card h-100 d-flex flex-column justify-content-between">
                                    <div class="d-flex align-items-center justify-content-between">
                                        <span class="text-muted font-weight-bold">Completed Bookings</span>
                                        <div class="p-2 bg-success-subtle text-success rounded-3">
                                            <i class="fa-solid fa-circle-check fs-4"></i>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <h2 class="fw-bold mb-1">42</h2>
                                        <p class="text-muted small mb-0">Total Platform Rentals</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4 mb-4">
                                <div class="dashboard-card h-100 d-flex flex-column justify-content-between">
                                    <div class="d-flex align-items-center justify-content-between">
                                        <span class="text-muted font-weight-bold">Commission Deducted</span>
                                        <div class="p-2 bg-danger-subtle text-danger rounded-3">
                                            <i class="fa-solid fa-percent fs-4"></i>
                                        </div>
                                    </div>
                                    <div class="mt-3">
                                        <h2 class="fw-bold mb-1 font-monospace">RM 14.50</h2>
                                        <p class="text-muted small mb-0">10% standard platform cut</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Booking History Grid -->
                <div class="dashboard-card">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0"><i class="fa-solid fa-clock-rotate-left text-primary me-2"></i> Recent Booking History</h5>
                        <div class="d-flex gap-2">
                            <input type="text" id="bookingSearch" class="form-control form-control-sm" placeholder="Search vehicle/bay..." style="width: 200px;">
                            <select id="bookingStatusFilter" class="form-select form-select-sm" style="width: 140px;">
                                <option value="">All Statuses</option>
                                <option value="Completed">Completed</option>
                                <option value="Upcoming">Upcoming</option>
                                <option value="Disputed">Disputed</option>
                            </select>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th>Date</th>
                                    <th>Renter Plate</th>
                                    <th>Bay & Location</th>
                                    <th>Duration</th>
                                    <th>Total Earned (RM)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="bookingsTableBody">
                                <!-- Dummy Malaysian Context Booking Data -->
                                <tr>
                                    <td>05 Jul 2026</td>
                                    <td><span class="badge bg-secondary font-monospace p-2">VCS 8824</span></td>
                                    <td><strong>Bay 104</strong> <br><small class="text-muted">Wangsa Maju LRT</small></td>
                                    <td>08:00 AM - 06:00 PM <br><small class="text-muted">(10.0 hrs)</small></td>
                                    <td class="fw-bold text-success mono-text">RM 18.00</td>
                                    <td><span class="badge bg-success-subtle text-success px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i> Completed</span></td>
                                    <td><button class="btn btn-light btn-sm text-primary" onclick="viewDetails('b-1')"><i class="fa-regular fa-eye"></i> Details</button></td>
                                </tr>
                                <tr>
                                    <td>04 Jul 2026</td>
                                    <td><span class="badge bg-secondary font-monospace p-2">WRA 9031</span></td>
                                    <td><strong>Bay 104</strong> <br><small class="text-muted">Wangsa Maju LRT</small></td>
                                    <td>09:00 AM - 05:00 PM <br><small class="text-muted">(8.0 hrs)</small></td>
                                    <td class="fw-bold text-success mono-text">RM 14.40</td>
                                    <td><span class="badge bg-success-subtle text-success px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i> Completed</span></td>
                                    <td><button class="btn btn-light btn-sm text-primary" onclick="viewDetails('b-2')"><i class="fa-regular fa-eye"></i> Details</button></td>
                                </tr>
                                <tr>
                                    <td>03 Jul 2026</td>
                                    <td><span class="badge bg-secondary font-monospace p-2">ALL 5110</span></td>
                                    <td><strong>Bay 208</strong> <br><small class="text-muted">Gombak LRT</small></td>
                                    <td>08:00 AM - 06:00 PM <br><small class="text-muted">(10.0 hrs)</small></td>
                                    <td class="fw-bold text-success mono-text">RM 20.00</td>
                                    <td><span class="badge bg-warning-subtle text-warning px-2 py-1"><i class="fa-solid fa-triangle-exclamation me-1"></i> Disputed</span></td>
                                    <td><button class="btn btn-light btn-sm text-warning" onclick="viewDispute('Overstay detected (23 mins). Verified by ESP32 telemetry.')"><i class="fa-solid fa-circle-exclamation"></i> Resolve</button></td>
                                </tr>
                                <tr>
                                    <td>02 Jul 2026</td>
                                    <td><span class="badge bg-secondary font-monospace p-2">VDE 6729</span></td>
                                    <td><strong>Bay 104</strong> <br><small class="text-muted">Wangsa Maju LRT</small></td>
                                    <td>07:30 AM - 04:30 PM <br><small class="text-muted">(9.0 hrs)</small></td>
                                    <td class="fw-bold text-success mono-text">RM 16.20</td>
                                    <td><span class="badge bg-success-subtle text-success px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i> Completed</span></td>
                                    <td><button class="btn btn-light btn-sm text-primary" onclick="viewDetails('b-4')"><i class="fa-regular fa-eye"></i> Details</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Simple Pagination -->
                    <nav class="d-flex justify-content-between align-items-center mt-3">
                        <small class="text-muted">Showing 1 to 4 of 4 bookings</small>
                        <ul class="pagination pagination-sm mb-0">
                            <li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>
                            <li class="page-item active"><a class="page-link" href="#">1</a></li>
                            <li class="page-item disabled"><a class="page-link" href="#">Next</a></li>
                        </ul>
                    </</nav>
                </div>
            </div>

            <!-- ========================================== -->
            <!--       VIEW 2: AVAILABILITY SCHEDULER       -->
            <!-- ========================================== -->
            <div id="view-availability" class="view-panel d-none">
                <div class="row align-items-center mb-4">
                    <div class="col">
                        <h4 class="fw-bold mb-1">IoT Parking Availability Management</h4>
                        <p class="text-muted mb-0">Define the exact weekly schedule when your slot is vacant for commuters. ESP32 smart bollards automatically raise when booking completes.</p>
                    </div>
                </div>

                <div class="row">
                    <!-- Scheduler Configuration Form -->
                    <div class="col-lg-4 mb-4">
                        <div class="dashboard-card">
                            <h6 class="fw-bold mb-3"><i class="fa-regular fa-clock text-primary me-2"></i> Add Availability Slot</h6>
                            <form id="schedule-form">
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold">Select Parking Bay</label>
                                    <select class="form-select" id="sched-bay">
                                        <option value="bay-104">Bay 104 (Wangsa Maju LRT)</option>
                                        <option value="bay-208">Bay 208 (Gombak LRT)</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold">Day of Week</label>
                                    <select class="form-select" id="sched-day">
                                        <option value="1">Monday</option>
                                        <option value="2">Tuesday</option>
                                        <option value="3">Wednesday</option>
                                        <option value="4">Thursday</option>
                                        <option value="5">Friday</option>
                                        <option value="6">Saturday</option>
                                        <option value="0">Sunday</option>
                                    </select>
                                </div>
                                <div class="row mb-3">
                                    <div class="col">
                                        <label class="form-label small fw-semibold">Start Time</label>
                                        <input type="time" class="form-control" id="sched-start" value="08:00">
                                    </div>
                                    <div class="col">
                                        <label class="form-label small fw-semibold">End Time</label>
                                        <input type="time" class="form-control" id="sched-end" value="18:00">
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label small fw-semibold">Target Hourly Rate (RM)</label>
                                    <div class="input-group">
                                        <span class="input-group-text">RM</span>
                                        <input type="number" step="0.50" class="form-control font-monospace" id="sched-rate" value="2.00">
                                        <span class="input-group-text">/hr</span>
                                    </div>
                                    <small class="text-muted">Avg rate near Wangsa Maju: RM 2.00/hr</small>
                                </div>
                                <div class="d-grid gap-2">
                                    <button type="button" class="btn btn-primary fw-semibold" onclick="addScheduleSlot()">
                                        <i class="fa-solid fa-plus me-1"></i> Save Schedule
                                    </button>
                                    <button type="button" class="btn btn-outline-danger fw-semibold" onclick="blockAllDates()">
                                        <i class="fa-solid fa-ban me-1"></i> Block All Dates
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Visual Weekly Scheduler Display -->
                    <div class="col-lg-8 mb-4">
                        <div class="dashboard-card h-100">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h6 class="fw-bold mb-0"><i class="fa-regular fa-calendar-check text-primary me-2"></i> Current Week Active Listings</h6>
                                <span class="badge bg-success-subtle text-success p-2">Auto-syncs with ESP32 Edge Gateway</span>
                            </div>

                            <div class="schedule-grid-header">
                                <div>Mon</div>
                                <div>Tue</div>
                                <div>Wed</div>
                                <div>Thu</div>
                                <div>Fri</div>
                                <div>Sat</div>
                                <div>Sun</div>
                            </div>

                            <div class="row g-1">
                                <!-- Monday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-1">
                                        <div class="time-block-tag">
                                            <span>08:00-18:00<br><small class="fw-bold">RM2.00/hr</small></span>
                                            <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
                                        </div>
                                    </div>
                                </div>
                                <!-- Tuesday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-2">
                                        <div class="time-block-tag">
                                            <span>08:00-18:00<br><small class="fw-bold">RM2.00/hr</small></span>
                                            <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
                                        </div>
                                    </div>
                                </div>
                                <!-- Wednesday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-3">
                                        <div class="time-block-tag">
                                            <span>08:00-18:00<br><small class="fw-bold">RM2.00/hr</small></span>
                                            <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
                                        </div>
                                    </div>
                                </div>
                                <!-- Thursday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-4">
                                        <div class="time-block-tag">
                                            <span>08:00-18:00<br><small class="fw-bold">RM2.00/hr</small></span>
                                            <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
                                        </div>
                                    </div>
                                </div>
                                <!-- Friday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-5">
                                        <div class="time-block-tag">
                                            <span>08:00-18:00<br><small class="fw-bold">RM2.00/hr</small></span>
                                            <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
                                        </div>
                                    </div>
                                </div>
                                <!-- Saturday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-6">
                                        <div class="text-center text-muted py-5 small">No Rent slots</div>
                                    </div>
                                </div>
                                <!-- Sunday Column -->
                                <div class="col">
                                    <div class="schedule-day-column" id="day-col-0">
                                        <div class="text-center text-muted py-5 small">No Rent slots</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================== -->
            <!--       VIEW 3: PROPERTY REGISTRATION         -->
            <!-- ========================================== -->
            <div id="view-registration" class="view-panel d-none">
                <div class="row align-items-center mb-4">
                    <div class="col">
                        <h4 class="fw-bold mb-1">Onboard New Smart Parking Spot</h4>
                        <p class="text-muted mb-0">Submit strata properties near LRT/MRT stations for administrative approval and IoT hardware deployment.</p>
                    </div>
                </div>

                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <div class="dashboard-card">
                            <div class="d-flex align-items-center mb-4 pb-2 border-bottom">
                                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                                    <i class="fa-solid fa-file-shield"></i>
                                </div>
                                <div>
                                    <h6 class="fw-bold mb-0">Onboarding & Regulatory Compliance Form</h6>
                                    <small class="text-muted">Pursuant to Malaysian Strata Management Act 2013 (SMA 2013)</small>
                                </div>
                            </div>

                            <form id="property-form" onsubmit="handleOnboardingSubmit(event)">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold">Condominium / Property Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" placeholder="e.g. Wangsa Latian Condominium" required id="prop-name">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold">Closest RapidKL Transit Station <span class="text-danger">*</span></label>
                                        <select class="form-select" required id="prop-station">
                                            <option value="">-- Choose closest LRT/MRT station --</option>
                                            <option value="Wangsa Maju LRT">Wangsa Maju LRT (Kelana Jaya Line)</option>
                                            <option value="Gombak LRT">Gombak LRT (Kelana Jaya Line)</option>
                                            <option value="Taman Melati LRT">Taman Melati LRT (Kelana Jaya Line)</option>
                                            <option value="Sri Rampai LRT">Sri Rampai LRT (Kelana Jaya Line)</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-4">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold">Exact Bay Number <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" placeholder="e.g. Bay 104" required id="prop-bay">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-semibold">Level / Floor <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" placeholder="e.g. Ground Floor, Level 3" required id="prop-level">
                                    </div>
                                </div>

                                <!-- Proof of Ownership Upload Zone -->
                                <div class="mb-4">
                                    <label class="form-label small fw-semibold">Strata Title / Purchase Agreement Proof <span class="text-danger">*</span></label>
                                    <div class="upload-dropzone" id="dropzone" onclick="triggerFileInput()">
                                        <i class="fa-solid fa-cloud-arrow-up"></i>
                                        <h6 class="fw-bold mb-1">Drag and drop digital documents here</h6>
                                        <p class="text-muted small mb-2">Support PDF, PNG, JPG formats up to 10MB</p>
                                        <span class="btn btn-sm btn-outline-primary">Browse Files</span>
                                        <input type="file" id="onboardFile" class="d-none" onchange="handleFileSelect(event)">
                                    </div>
                                    <div class="mt-2 d-none" id="file-upload-status">
                                        <div class="p-3 bg-light border rounded d-flex justify-content-between align-items-center">
                                            <div class="d-flex align-items-center">
                                                <i class="fa-solid fa-file-pdf text-danger fs-3 me-3"></i>
                                                <div>
                                                    <span class="fw-bold" id="upload-file-name">Strata_Title_Bay104.pdf</span><br>
                                                    <small class="text-muted font-monospace" id="upload-file-size">4.2 MB</small>
                                                </div>
                                            </div>
                                            <span class="badge bg-success"><i class="fa-solid fa-check me-1"></i> Loaded</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-3 bg-light rounded border border-warning-subtle mb-4">
                                    <div class="d-flex">
                                        <i class="fa-solid fa-scale-balanced text-warning fs-4 me-3 mt-1"></i>
                                        <div>
                                            <strong class="text-warning-emphasis small">Legal Affirmation Statement</strong>
                                            <p class="mb-0 text-muted small mt-1">I hereby affirm that I am the verified owner/accessory parcel holder of the specified parking bay. Under the <strong>Malaysian Strata Management Act 2013</strong>, I grant ParkJom administrators authorization to review this application, perform IoT bollard integration, and whitelist commuter vehicles during approved rental blocks.</p>
                                        </div>
                                    </div>
                                </div>

                                <div class="d-flex justify-content-end">
                                    <button type="submit" class="btn btn-primary px-4 fw-semibold py-2">
                                        <i class="fa-solid fa-paper-plane me-2"></i> Submit Onboarding Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ========================================== -->
            <!--          VIEW 4: SETTINGS PANEL            -->
            <!-- ========================================== -->
            <div id="view-settings" class="view-panel d-none">
                <div class="row align-items-center mb-4">
                    <div class="col">
                        <h4 class="fw-bold mb-1">Platform Settings & Configurations</h4>
                        <p class="text-muted mb-0">Configure your bank account for secure withdrawals, automated settlement triggers, and hardware heartbeat telemetry alerts.</p>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-6 mb-4">
                        <div class="dashboard-card h-100">
                            <h5 class="fw-bold mb-3"><i class="fa-solid fa-building-columns text-primary me-2"></i> Payout Bank Account Details</h5>
                            <form onsubmit="saveBankSettings(event)">
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold">Beneficiary Bank Name</label>
                                    <select class="form-select" id="bank-name">
                                        <option value="Maybank">Malayan Banking Berhad (Maybank)</option>
                                        <option value="CIMB">CIMB Bank Berhad</option>
                                        <option value="Public">Public Bank Berhad</option>
                                        <option value="RHB">RHB Bank Berhad</option>
                                        <option value="HongLeong">Hong Leong Bank Berhad</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-semibold">Account Number</label>
                                    <input type="text" class="form-control font-monospace" value="114012345678" id="bank-acc" required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label small fw-semibold">Account Holder Name</label>
                                    <input type="text" class="form-control" value="CHAW CHUN JIA" id="bank-holder" required>
                                    <small class="text-muted">Must match your uploaded IC document for verified withdrawals</small>
                                </div>
                                <button type="submit" class="btn btn-primary fw-semibold"><i class="fa-solid fa-floppy-disk me-1"></i> Save Bank Account</button>
                            </form>
                        </div>
                    </div>

                    <div class="col-lg-6 mb-4">
                        <div class="dashboard-card h-100 d-flex flex-column justify-content-between">
                            <div>
                                <h5 class="fw-bold mb-3"><i class="fa-solid fa-sliders text-primary me-2"></i> Owner Preference Controls</h5>
                                <div class="mb-3 border-bottom pb-2">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" role="switch" id="notify-email" checked>
                                        <label class="form-check-label fw-semibold text-dark small" for="notify-email">Email Notifications</label>
                                        <p class="text-muted small mb-0">Receive receipts of financial payouts and weekly summaries.</p>
                                    </div>
                                </div>
                                <div class="mb-3 border-bottom pb-2">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" role="switch" id="notify-whatsapp" checked>
                                        <label class="form-check-label fw-semibold text-dark small" for="notify-whatsapp">WhatsApp Access Control Alerts</label>
                                        <p class="text-muted small mb-0">Get notified instantly of vehicle entry/exit anomalies or overstay violations.</p>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" role="switch" id="auto-withdraw">
                                        <label class="form-check-label fw-semibold text-dark small" for="auto-withdraw">Auto-Withdraw Funds</label>
                                        <p class="text-muted small mb-0">Trigger payouts automatically to your Maybank account when wallet balance exceeds RM 150.00.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="p-3 bg-secondary-subtle rounded mt-2">
                                <small class="text-dark d-block fw-semibold mb-1"><i class="fa-solid fa-microchip text-primary me-1"></i> IoT Hardware Hub status</small>
                                <span class="badge bg-success me-1"><i class="fa-solid fa-wifi me-1"></i> ESP32 Online</span>
                                <span class="badge bg-info"><i class="fa-solid fa-battery-three-quarters me-1"></i> 87% Battery</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </main>

        <!-- Footer -->
        <footer class="bg-white border-top py-3 text-center text-muted mt-auto">
            <small>&copy; 2026 ParkJom Malaysia. Designed for sustainable transit-first urban mobility. All Rights Reserved.</small>
        </footer>
    </div>


    <!-- ========================================== -->
    <!--            WITHDRAWAL TRANSACTION DIALOG    -->
    <!-- ========================================== -->
    <div class="modal fade" id="withdrawModal" tabindex="-1" aria-labelledby="withdrawModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fw-bold" id="withdrawModalLabel"><i class="fa-solid fa-money-bill-transfer text-primary me-2"></i> Request Wallet Settlement</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="p-3 bg-light rounded mb-3 text-center">
                        <span class="text-muted small d-block">Current Withdrawable Balance</span>
                        <h3 class="fw-bold text-dark mb-0 mono-text">RM <span id="modal-wallet-balance">450.00</span></h3>
                    </div>
                    <form id="withdraw-form" onsubmit="executeWithdrawal(event)">
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Withdrawal Amount (RM)</label>
                            <input type="number" class="form-control font-monospace" min="10" max="450" id="withdraw-amount" value="150" required>
                            <div class="form-text small">Minimum RM 10.00, Maximum RM 450.00</div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-semibold">Destination Bank Account</label>
                            <div class="p-2 border rounded bg-secondary-subtle">
                                <strong id="modal-bank-display"><i class="fa-solid fa-building-columns text-primary me-2"></i> Malayan Banking Berhad (Maybank)</strong>
                                <br><small class="text-muted" id="modal-bank-acc-display">Account: 114012345678</small>
                            </div>
                        </div>
                        <div class="form-check mb-4">
                            <input class="form-check-input" type="checkbox" id="withdrawConfirm" required>
                            <label class="form-check-label small text-muted" for="withdrawConfirm">
                                I verify that the bank beneficiary name matches my registered identification details. Transfers process within 1-2 hours.
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 fw-bold py-2"><i class="fa-solid fa-circle-check me-1"></i> Authorize Transfer</button>
                    </form>
                </div>
            </div>
        </div>
    </div>


    <!-- ========================================== -->
    <!--            BOOTSTRAP 5 CORE JAVASCRIPT      -->
    <!-- ========================================== -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // --- VIEW ROUTER ---
        document.querySelectorAll('.nav-link-custom').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Active Class switching
                document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                // Show selected View
                const targetView = this.getAttribute('data-view');
                switchView(targetView);
            });
        });

        function switchView(viewName) {
            document.querySelectorAll('.view-panel').forEach(panel => {
                panel.classList.add('d-none');
            });
            const selectedPanel = document.getElementById('view-' + viewName);
            if(selectedPanel) {
                selectedPanel.classList.remove('d-none');
            }
            
            // Sync active sidebar highlighting if triggered externally
            document.querySelectorAll('.nav-link-custom').forEach(l => {
                if(l.getAttribute('data-view') === viewName) {
                    l.classList.add('active');
                } else {
                    l.classList.remove('active');
                }
            });
        }

        // --- SIDEBAR TOGGLE (FOR MOBILE) ---
        const toggleBtn = document.getElementById('sidebar-toggle');
        if(toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                document.getElementById('sidebar').classList.toggle('active');
                document.getElementById('content-wrapper').classList.toggle('active');
            });
        }

        // --- WALLET WITHDRAWAL LOGIC ---
        function executeWithdrawal(event) {
            event.preventDefault();
            const balanceSpan = document.getElementById('wallet-balance');
            const modalBalanceSpan = document.getElementById('modal-wallet-balance');
            const withdrawInput = document.getElementById('withdraw-amount');
            
            let currentBalance = parseFloat(balanceSpan.innerText);
            let withdrawAmount = parseFloat(withdrawInput.value);
            
            if(withdrawAmount > currentBalance) {
                alert('Insufficient wallet balance!');
                return;
            }
            
            // Execute simulated deduction
            let newBalance = currentBalance - withdrawAmount;
            balanceSpan.innerText = newBalance.toFixed(2);
            modalBalanceSpan.innerText = newBalance.toFixed(2);
            withdrawInput.max = newBalance;
            withdrawInput.value = Math.min(10, newBalance);
            
            // Log withdrawal to table
            const table = document.getElementById('bookingsTableBody');
            const newRow = document.createElement('tr');
            
            const today = new Date();
            const dateStr = today.getDate().toString().padStart(2, '0') + ' ' + 
                            today.toLocaleString('en-US', { month: 'short' }) + ' ' + 
                            today.getFullYear();
                            
            newRow.innerHTML = \`
                <td>\${dateStr}</td>
                <td><span class="badge bg-light text-dark font-monospace p-2">- WALLET -</span></td>
                <td><strong>Payout Sent</strong> <br><small class="text-muted">Maybank Transfer</small></td>
                <td>N/A <br><small class="text-muted">(Settlement)</small></td>
                <td class="fw-bold text-danger mono-text">- RM \${withdrawAmount.toFixed(2)}</td>
                <td><span class="badge bg-info-subtle text-info px-2 py-1"><i class="fa-solid fa-spinner fa-spin me-1"></i> Processing</span></td>
                <td><button class="btn btn-light btn-sm" disabled><i class="fa-solid fa-hourglass-start"></i> Pending</button></td>
            \`;
            table.insertBefore(newRow, table.firstChild);
            
            // Close Modal
            const modalEl = document.getElementById('withdrawModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if(modalInstance) {
                modalInstance.hide();
            }
            
            // Update notification counter
            const badgeCount = document.getElementById('notification-badge-count');
            let currentCount = parseInt(badgeCount.innerText);
            badgeCount.innerText = currentCount + 1;
            
            alert('Settlement of RM ' + withdrawAmount.toFixed(2) + ' initiated successfully to your Maybank Account!');
        }

        // --- INTERACTIVE CALENDAR SLOTS ADDITION ---
        function addScheduleSlot() {
            const daySelect = document.getElementById('sched-day');
            const startInput = document.getElementById('sched-start');
            const endInput = document.getElementById('sched-end');
            const rateInput = document.getElementById('sched-rate');
            
            const dayValue = daySelect.value;
            const dayText = daySelect.options[daySelect.selectedIndex].text;
            const startTime = startInput.value;
            const endTime = endInput.value;
            const hourlyRate = parseFloat(rateInput.value).toFixed(2);
            
            if(!startTime || !endTime) {
                alert('Please specify valid start and end times!');
                return;
            }
            
            const targetColumn = document.getElementById('day-col-' + dayValue);
            if(!targetColumn) return;
            
            // Clean empty indicator if any
            if(targetColumn.innerHTML.includes('No Rent slots')) {
                targetColumn.innerHTML = '';
            }
            
            // Create time block tag
            const block = document.createElement('div');
            block.className = 'time-block-tag';
            block.innerHTML = \`
                <span>\${startTime}-\${endTime}<br><small class="fw-bold">RM\${hourlyRate}/hr</small></span>
                <i class="fa-solid fa-circle-xmark ms-1" onclick="removeSlot(this)"></i>
            \`;
            
            targetColumn.appendChild(block);
            alert('Schedule slot for ' + dayText + ' (' + startTime + ' - ' + endTime + ') configured successfully!');
        }

        function removeSlot(element) {
            const column = element.closest('.schedule-day-column');
            element.closest('.time-block-tag').remove();
            
            // Check if column is now empty, re-inject "No Rent slots" placeholder
            if(column.children.length === 0) {
                column.innerHTML = '<div class="text-center text-muted py-5 small">No Rent slots</div>';
            }
        }

        function blockAllDates() {
            for(let i=0; i<=6; i++) {
                const column = document.getElementById('day-col-' + i);
                if(column) {
                    column.innerHTML = '<div class="text-center text-muted py-5 small">No Rent slots</div>';
                }
            }
            alert('All parking slots have been blocked from renting. Smart bollards are locked raised.');
        }

        // --- ONBOARDING FILE DRAG-DROP SIMULATION ---
        function triggerFileInput() {
            document.getElementById('onboardFile').click();
        }

        function handleFileSelect(event) {
            const files = event.target.files;
            if(files.length > 0) {
                displayLoadedFile(files[0].name, (files[0].size / (1024 * 1024)).toFixed(2));
            }
        }

        function displayLoadedFile(name, size) {
            document.getElementById('file-upload-status').classList.remove('d-none');
            document.getElementById('upload-file-name').innerText = name;
            document.getElementById('upload-file-size').innerText = size + ' MB';
        }

        // Setup simple drag & drop listeners
        const dropzone = document.getElementById('dropzone');
        if(dropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                }, false);
            });
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                }, false);
            });
            dropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if(files.length > 0) {
                    displayLoadedFile(files[0].name, (files[0].size / (1024 * 1024)).toFixed(2));
                }
            });
        }

        // --- SUBMIT REGISTRATION ONBOARDING ---
        function handleOnboardingSubmit(event) {
            event.preventDefault();
            const propName = document.getElementById('prop-name').value;
            const station = document.getElementById('prop-station').value;
            const bay = document.getElementById('prop-bay').value;
            const level = document.getElementById('prop-level').value;
            
            alert('Property Registration Submitted Successfully!\\n\\nProperty: ' + propName + '\\nStation: ' + station + '\\nBay: ' + bay + '\\nLevel: ' + level + '\\n\\nAdministrator verification is pending strata file review.');
            
            // Add a temporary mock notification
            const badgeCount = document.getElementById('notification-badge-count');
            let currentCount = parseInt(badgeCount.innerText);
            badgeCount.innerText = currentCount + 1;
            
            // Reset form
            document.getElementById('property-form').reset();
            document.getElementById('file-upload-status').classList.add('d-none');
        }

        // --- SAVE BANK PREFERENCES ---
        function saveBankSettings(event) {
            event.preventDefault();
            const bank = document.getElementById('bank-name').value;
            const acc = document.getElementById('bank-acc').value;
            const holder = document.getElementById('bank-holder').value;
            
            // Update modal display values
            document.getElementById('modal-bank-display').innerHTML = '<i class="fa-solid fa-building-columns text-primary me-2"></i> ' + bank;
            document.getElementById('modal-bank-acc-display').innerText = 'Account: ' + acc;
            
            alert('Settings Saved! Bank payout configuration updated to: ' + bank + ' - ' + acc);
        }

        // --- AUX DETAILS BUTTONS ---
        function viewDetails(bookingId) {
            alert('Viewing booking log details for: ' + bookingId + '\\nAll hardware transactions verified.');
        }

        function viewDispute(reason) {
            alert('DISPUTE RESOLUTION PORTAL:\\n\\n' + reason + '\\n\\nActions to take: Accept compensation credit, Submit security footage, or Appeal to platform arbitration.');
        }
    </script>
</body>
</html>
`;
