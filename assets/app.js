/* ============================================================
   Shared app behavior: auth guard, sidebar toggle, logout,
   active-nav highlighting, role/project-access helpers.
   Included on every protected page. NOTE: since there is no
   backend, none of this is real security — it exists only to
   demo role-appropriate views (Admin vs Supervisor).
   ============================================================ */

(function () {
  "use strict";

  var SESSION_KEY = "cui_session_user_id";

  function isLoggedIn() {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = "index.html";
    }
  }

  function login(userId) {
    sessionStorage.setItem(SESSION_KEY, userId);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  function getCurrentUser() {
    var id = sessionStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return window.Data.getUsers().find(function (u) { return u.id === id; }) || null;
  }

  function getCurrentRole() {
    var u = getCurrentUser();
    if (!u) return null;
    return window.Data.getRoles().find(function (r) { return r.id === u.roleId; }) || null;
  }

  /* "Admin" here means "sees every project" (role.allProjects), not necessarily
     full module permissions — a role can have allProjects:true (e.g. Accountant)
     while still being denied create/edit on most modules. Use can() for that. */
  function isAdmin() {
    var role = getCurrentRole();
    return !!role && role.allProjects === true;
  }

  function can(moduleKey, action) {
    var role = getCurrentRole();
    if (!role) return false;
    var perms = role.permissions && role.permissions[moduleKey];
    return !!(perms && perms[action]);
  }

  function canAccessProject(projectId) {
    var u = getCurrentUser();
    var role = getCurrentRole();
    if (!u || !role) return false;
    if (role.allProjects) return true;
    return (u.assignedProjectIds || []).indexOf(projectId) !== -1;
  }

  function visibleProjects() {
    var u = getCurrentUser();
    var role = getCurrentRole();
    var all = window.Data.getProjects();
    if (!u || !role) return [];
    if (role.allProjects) return all;
    return all.filter(function (p) { return (u.assignedProjectIds || []).indexOf(p.id) !== -1; });
  }

  /* Call at the top of any project-scoped page (project-*.html?id=X).
     Shows a restricted overlay and halts if the current user can't see this project. */
  function guardProjectAccess(projectId) {
    if (canAccessProject(projectId)) return true;
    showAccessRestricted();
    return false;
  }

  function guardAdminOnly() {
    if (isAdmin()) return true;
    showAccessRestricted();
    return false;
  }

  /* Call at the top of a global (non-project-scoped) page whose module requires
     "read" permission to view at all, e.g. guardPermission('roles', 'read'). */
  function guardPermission(moduleKey, action) {
    if (can(moduleKey, action)) return true;
    showAccessRestricted();
    return false;
  }

  function applyRoleVisibility() {
    document.querySelectorAll("[data-require]").forEach(function (el) {
      var parts = el.getAttribute("data-require").split(":");
      if (!can(parts[0], parts[1])) el.style.display = "none";
    });
  }

  function initSidebar() {
    var sidebar = document.querySelector(".sidebar");
    var backdrop = document.querySelector(".sidebar-backdrop");
    var toggleBtn = document.querySelector(".menu-toggle");

    if (!sidebar || !toggleBtn) return;

    function open() {
      sidebar.classList.add("open");
      if (backdrop) backdrop.classList.add("show");
    }

    function close() {
      sidebar.classList.remove("open");
      if (backdrop) backdrop.classList.remove("show");
    }

    toggleBtn.addEventListener("click", function () {
      sidebar.classList.contains("open") ? close() : open();
    });

    if (backdrop) backdrop.addEventListener("click", close);
  }

  function initLogout() {
    document.querySelectorAll("[data-logout]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        logout();
      });
    });
  }

  function initUserBadge() {
    var u = getCurrentUser();
    var role = getCurrentRole();
    var name = u ? u.name : "Guest";
    var roleName = role ? role.name : "";
    var initial = name.charAt(0).toUpperCase();

    document.querySelectorAll("[data-user-name]").forEach(function (el) { el.textContent = name; });
    document.querySelectorAll("[data-user-role]").forEach(function (el) { el.textContent = roleName; });
    document.querySelectorAll("[data-user-initial]").forEach(function (el) { el.textContent = initial; });
  }

  function positionActionMenu(id) {
    var trigger = document.querySelector('[data-menu-toggle="' + id + '"]');
    var menu = document.querySelector('[data-menu="' + id + '"]');
    if (!trigger || !menu) return;

    // Must be visible (display:block) before measuring — callers show the menu
    // right after this runs, but a display:none menu measures as 0x0, which
    // breaks the "flip upward near the bottom of the viewport" check below.
    menu.classList.add("show");

    var triggerRect = trigger.getBoundingClientRect();
    var menuRect = menu.getBoundingClientRect();
    var viewportW = window.innerWidth;
    var viewportH = window.innerHeight;
    var gap = 6;

    var top;
    if (viewportH - triggerRect.bottom < menuRect.height + gap + 8 && triggerRect.top > menuRect.height + gap) {
      top = triggerRect.top - menuRect.height - gap;
    } else {
      top = triggerRect.bottom + gap;
    }

    var left = triggerRect.right - menuRect.width;
    if (left < 8) left = 8;
    if (left + menuRect.width > viewportW - 8) left = viewportW - menuRect.width - 8;

    menu.style.top = top + "px";
    menu.style.left = left + "px";
  }

  /* ---------------- Searchable combobox (labourer/material/project pickers) ---------------- */

  function initCombobox(opts) {
    var filtered = [];
    var activeIndex = -1;

    function position() {
      var rect = opts.wrap.getBoundingClientRect();
      opts.panel.style.left = rect.left + "px";
      opts.panel.style.top = (rect.bottom + 6) + "px";
      opts.panel.style.width = rect.width + "px";
    }

    function renderOptions() {
      if (!filtered.length) {
        opts.panel.innerHTML = '<div class="combo-empty">No matches found</div>';
        return;
      }
      opts.panel.innerHTML = filtered.map(function (item, i) {
        return '<div class="combo-option' + (i === activeIndex ? ' active' : '') + '" data-idx="' + i + '">' +
          '<div class="combo-avatar">' + opts.getInitial(item) + '</div>' +
          '<div class="combo-text"><span class="combo-title">' + opts.getLabel(item) + '</span><span class="combo-sub">' + opts.getSub(item) + '</span></div>' +
        '</div>';
      }).join("");
    }

    function filter() {
      var term = opts.input.value.trim().toLowerCase();
      filtered = opts.items.filter(function (item) { return opts.matches(item, term); });
      activeIndex = -1;
      renderOptions();
    }

    function open() {
      filter();
      position();
      opts.panel.classList.add("show");
    }

    function close() {
      opts.panel.classList.remove("show");
      activeIndex = -1;
    }

    function select(item) {
      opts.onSelect(item);
      close();
    }

    opts.input.addEventListener("focus", open);
    opts.input.addEventListener("input", open);

    opts.input.addEventListener("keydown", function (e) {
      if (!opts.panel.classList.contains("show")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        renderOptions();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        renderOptions();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && filtered[activeIndex]) {
          e.preventDefault();
          select(filtered[activeIndex]);
        }
      } else if (e.key === "Escape") {
        close();
      }
    });

    opts.panel.addEventListener("mousedown", function (e) {
      var optEl = e.target.closest(".combo-option");
      if (!optEl) return;
      e.preventDefault();
      var idx = parseInt(optEl.getAttribute("data-idx"), 10);
      select(filtered[idx]);
    });

    document.addEventListener("click", function (e) {
      if (!opts.wrap.contains(e.target) && !opts.panel.contains(e.target)) close();
    });
    window.addEventListener("scroll", function () { if (opts.panel.classList.contains("show")) position(); }, true);
    window.addEventListener("resize", function () { if (opts.panel.classList.contains("show")) position(); });

    return {
      close: close,
      setItems: function (items) { opts.items = items; }
    };
  }

  /* ---------------- Icon library (feather-style paths, no outer <svg>) ---------------- */

  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    building: '<path d="M3 21h18"/><path d="M5 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16"/><path d="M13 9h6a1 1 0 0 1 1 1v11"/><path d="M8 8h.01"/><path d="M8 12h.01"/><path d="M8 16h.01"/>',
    people: '<path d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    userCircle: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    truck: '<rect x="1" y="7" width="15" height="13" rx="1"/><path d="M16 11h4l3 3v6h-7z"/><circle cx="5.5" cy="20.5" r="1.5"/><circle cx="17.5" cy="20.5" r="1.5"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    trendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    alert: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88l.7.71-2.82 2.82"/>',
    hardHat: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 6v5"/><path d="M9 6h6a1 1 0 0 1 1 1v1H8V7a1 1 0 0 1 1-1z"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    columns: '<rect x="3" y="4" width="6" height="16" rx="1"/><rect x="9" y="4" width="6" height="10" rx="1"/><rect x="15" y="4" width="6" height="13" rx="1"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5L19 11"/><path d="M12 11l4 4"/>',
    warehouse: '<path d="M3 21V10l9-6 9 6v11"/><path d="M3 21h18"/><path d="M9 21v-7h6v7"/>',
    messageCircle: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    sparkles: '<path d="M12 3v4M12 17v4M5 5l2.5 2.5M16.5 16.5L19 19M3 12h4M17 12h4M5 19l2.5-2.5M16.5 7.5L19 5"/><circle cx="12" cy="12" r="3"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>'
  };

  function svg(name, extraClass) {
    return '<svg class="' + (extraClass || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + '</svg>';
  }

  /* ---------------- Shared shell (sidebar + topbar) ---------------- */

  var NAV_ITEMS = [
    { section: "Menu" },
    { key: "dashboard", href: "dashboard.html", label: "Dashboard", icon: "dashboard" },
    { key: "projects", href: "projects.html", label: "Projects", icon: "building" },
    { section: "Workforce & Materials" },
    /* Labourers is hidden from the dashboard sidebar. */
    { key: "godown", href: "godown.html", label: "Godown", icon: "warehouse", require: "stock:read" },
    { key: "materials", href: "godown-materials.html", label: "Materials", icon: "box", require: "stock:read" },
    { key: "quotation", href: "quotation.html", label: "Quotation", icon: "fileText", require: "stock:read" },
    { section: "Business" },
    { key: "customers", href: "customers.html", label: "Customers", icon: "briefcase", require: "customers:read" },
    { section: "Account" },
    { key: "users", href: "user-list.html", label: "Users", icon: "hardHat", require: "users:read" },
    { key: "roles", href: "roles.html", label: "Roles & Permissions", icon: "shield", require: "roles:read" },
    { key: "profile", href: "profile.html", label: "Profile", icon: "userCircle" }
  ];

  function renderShell(opts) {
    opts = opts || {};
    var user = getCurrentUser();
    if (!user) return;

    var sidebar = document.getElementById("sidebar");
    var topbar = document.getElementById("topbar");
    if (sidebar) sidebar.innerHTML = buildSidebarHtml(opts.active);
    if (topbar) topbar.innerHTML = buildTopbarHtml(opts.title, opts.subtitle);

    initSidebar();
    initLogout();
    initUserBadge();
    applyRoleVisibility();
    initAIAssistant();

    var role = getCurrentRole();
    var badge = document.querySelector("[data-user-role-badge]");
    if (badge) badge.textContent = role ? role.name : "";
  }

  function buildSidebarHtml(activeKey) {
    var navHtml = NAV_ITEMS.map(function (item) {
      if (item.section) {
        return '<span class="nav-section-label">' + item.section + '</span>';
      }
      var activeCls = item.key === activeKey ? " active" : "";
      var reqAttr = item.require ? ' data-require="' + item.require + '"' : "";
      return '<a class="nav-item' + activeCls + '" href="' + item.href + '"' + reqAttr + '>' +
        svg(item.icon) + item.label + '</a>';
    }).join("");

    return (
      '<div class="sidebar-brand">' +
        '<div class="brand-mark">BT</div>' +
        '<div class="brand-text"><strong>BuildTrack</strong><span>Construction Console</span></div>' +
      '</div>' +
      '<nav class="sidebar-nav">' + navHtml +
        '<button class="nav-item logout-item" data-logout>' + svg("logout") + 'Logout</button>' +
      '</nav>' +
      '<div class="sidebar-footer">' +
        '<div class="avatar" data-user-initial>?</div>' +
        '<div class="who"><strong data-user-name>...</strong><span data-user-role>...</span></div>' +
      '</div>'
    );
  }

  function buildTopbarHtml(title, subtitle) {
    return (
      '<div class="topbar-left">' +
        '<button class="menu-toggle" aria-label="Toggle menu">' + svg("menu") + '</button>' +
        '<div class="page-title">' + (title || "") + (subtitle ? '<span>' + subtitle + '</span>' : "") + '</div>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<div class="topbar-welcome">' +
          '<div class="tw-avatar" data-user-initial>?</div>' +
          '<div class="tw-text"><span class="tw-greeting" data-user-role-badge>...</span><span class="tw-name" data-user-name>...</span></div>' +
        '</div>' +
        '<a class="icon-btn" href="profile.html" aria-label="Profile">' + svg("userCircle") + '</a>' +
      '</div>'
    );
  }

  var PROJECT_TABS = [
    { key: "overview", href: "project-overview.html", label: "Overview", icon: "dashboard" },
    { key: "tasks", href: "project-tasks.html", label: "Tasks", icon: "columns" },
    /* Labour tab is hidden from project navigation — labour wage costs can still be
       entered manually from the Expenses tab (category: Labour / Wages) as well. */
    { key: "wages", href: "project-wages.html", label: "Wages", icon: "coins" },
    { key: "salary", href: "project-salary.html", label: "Salary", icon: "briefcase" },
    { key: "stock", href: "project-stock.html", label: "Stock", icon: "box" },
    { key: "expenses", href: "project-expenses.html", label: "Expenses", icon: "wallet" },
    { key: "reports", href: "project-reports.html", label: "Reports", icon: "fileText" }
    /* Progress tab is hidden from project navigation. */
  ];

  function projectTabsHtml(projectId, activeKey) {
    return '<div class="page-tabs">' + PROJECT_TABS.map(function (t) {
      var cls = t.key === activeKey ? "page-tab active" : "page-tab";
      return '<a class="' + cls + '" href="' + t.href + '?id=' + projectId + '">' + svg(t.icon) + t.label + '</a>';
    }).join("") + '</div>';
  }

  function showAccessRestricted() {
    if (document.querySelector(".perm-restricted-overlay")) return;
    var overlay = document.createElement("div");
    overlay.className = "perm-restricted-overlay";
    overlay.innerHTML =
      '<div class="perm-restricted-card">' +
        '<div class="perm-restricted-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
        '</div>' +
        '<h3>Access Restricted</h3>' +
        '<p>You are not assigned to this project. Contact your administrator if you believe this is a mistake.</p>' +
        '<div class="perm-restricted-actions">' +
          '<a class="btn btn-primary" href="dashboard.html">Go to Dashboard</a>' +
          '<a class="btn btn-outline" href="#" data-logout>Logout</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector("[data-logout]").addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  var toastTimer = null;
  function showToast(message, isError) {
    var el = document.getElementById("appToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "appToast";
      el.className = "toast-notice";
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg><span></span>';
      document.body.appendChild(el);
    }
    var icon = el.querySelector("svg");
    icon.innerHTML = isError
      ? '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
      : '<path d="M20 6L9 17l-5-5"/>';
    icon.style.color = isError ? "var(--danger)" : "var(--success)";
    el.querySelector("span").textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ============================================================
     Reusable table sorting + numbered pagination.
     Each page keeps its own { field, dir } sort state and page
     number, then calls these helpers to sort/slice/render.
     ============================================================ */

  function sortRows(rows, sortState, accessor) {
    if (!sortState || !sortState.field) return rows;
    var field = sortState.field;
    var mult = sortState.dir === "desc" ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var av = accessor ? accessor(a, field) : a[field];
      var bv = accessor ? accessor(b, field) : b[field];
      if (av === undefined || av === null) av = "";
      if (bv === undefined || bv === null) bv = "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });
  }

  function sortableTh(label, field, sortState, extraClass) {
    var isActive = sortState && sortState.field === field;
    var arrow = isActive ? (sortState.dir === "asc" ? "&#9650;" : "&#9660;") : "&#8645;";
    return '<th class="sortable-th' + (extraClass ? " " + extraClass : "") + '" data-sort-field="' + field + '">' +
      '<span class="sortable-th-inner">' + label + '<span class="sort-arrow' + (isActive ? " active" : "") + '">' + arrow + '</span></span>' +
    '</th>';
  }

  function refreshSortArrows(container, sortState) {
    container.querySelectorAll("[data-sort-field]").forEach(function (th) {
      var field = th.getAttribute("data-sort-field");
      var isActive = sortState.field === field;
      var arrowEl = th.querySelector(".sort-arrow");
      if (!arrowEl) return;
      arrowEl.classList.toggle("active", isActive);
      arrowEl.innerHTML = isActive ? (sortState.dir === "asc" ? "&#9650;" : "&#9660;") : "&#8645;";
    });
  }

  function wireSort(theadEl, sortState, onChange) {
    theadEl.addEventListener("click", function (e) {
      var th = e.target.closest("[data-sort-field]");
      if (!th) return;
      var field = th.getAttribute("data-sort-field");
      if (sortState.field === field) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.field = field;
        sortState.dir = "asc";
      }
      refreshSortArrows(theadEl, sortState);
      onChange();
    });
  }

  function renderPager(container, page, totalPages, onChange) {
    totalPages = Math.max(1, totalPages);
    page = Math.min(Math.max(1, page), totalPages);
    if (totalPages <= 1) { container.innerHTML = ""; return; }

    var maxShown = 5;
    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, start + maxShown - 1);
    start = Math.max(1, end - maxShown + 1);

    var html = '<div class="pager">';
    html += '<button class="pager-btn pager-nav" data-pg="prev" ' + (page <= 1 ? "disabled" : "") + '>&lsaquo;</button>';
    if (start > 1) {
      html += '<button class="pager-btn" data-pg="1">1</button>';
      if (start > 2) html += '<span class="pager-ellipsis">&hellip;</span>';
    }
    for (var i = start; i <= end; i++) {
      html += '<button class="pager-btn' + (i === page ? " active" : "") + '" data-pg="' + i + '">' + i + '</button>';
    }
    if (end < totalPages) {
      if (end < totalPages - 1) html += '<span class="pager-ellipsis">&hellip;</span>';
      html += '<button class="pager-btn" data-pg="' + totalPages + '">' + totalPages + '</button>';
    }
    html += '<button class="pager-btn pager-nav" data-pg="next" ' + (page >= totalPages ? "disabled" : "") + '>&rsaquo;</button>';
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll("[data-pg]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-pg");
        var newPage = v === "prev" ? page - 1 : v === "next" ? page + 1 : Number(v);
        onChange(newPage);
      });
    });
  }

  function paginate(rows, page, pageSize) {
    var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(Math.max(1, page), totalPages);
    return { page: page, totalPages: totalPages, pageItems: rows.slice((page - 1) * pageSize, page * pageSize) };
  }

  /* ============================================================
     Table export (CSV / PDF).
     Every download modal in the app shares this: pass the same
     `columns` ({label, value(row)}) + `rows` the table is currently
     showing (already filtered/sorted) and the caller's chosen format.
     CSV downloads directly as a file; PDF opens a print-formatted
     window and triggers the browser's print dialog (Save as PDF) —
     no external library, works offline.
     ============================================================ */

  function escapeHtml(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function cellValue(col, row) {
    var v = typeof col.value === "function" ? col.value(row) : row[col.key];
    return v === null || v === undefined ? "" : v;
  }

  function downloadCSV(filename, columns, rows) {
    function csvCell(v) {
      var s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [columns.map(function (c) { return csvCell(c.label); }).join(",")];
    rows.forEach(function (row) {
      lines.push(columns.map(function (c) { return csvCell(cellValue(c, row)); }).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadPDF(title, subtitle, columns, rows) {
    var win = window.open("", "_blank");
    if (!win) { showToast("Allow pop-ups to download a PDF", true); return; }
    var theadHtml = "<tr>" + columns.map(function (c) { return "<th>" + escapeHtml(c.label) + "</th>"; }).join("") + "</tr>";
    var tbodyHtml = rows.length
      ? rows.map(function (row) {
          return "<tr>" + columns.map(function (c) { return "<td>" + escapeHtml(cellValue(c, row)) + "</td>"; }).join("") + "</tr>";
        }).join("")
      : '<tr><td colspan="' + columns.length + '" style="text-align:center;color:#888">No rows to show.</td></tr>';
    win.document.write(
      "<!DOCTYPE html><html><head><title>" + escapeHtml(title) + "</title><meta charset=\"utf-8\"><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#1a1a1a}" +
      "h1{font-size:18px;margin:0 0 4px}p{margin:0 0 18px;color:#666;font-size:12px}" +
      "table{width:100%;border-collapse:collapse;font-size:11px}" +
      "th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}" +
      "th{background:#f2f2f2}" +
      "@media print{body{padding:0}}" +
      "</style></head><body>" +
      "<h1>" + escapeHtml(title) + "</h1>" + (subtitle ? "<p>" + escapeHtml(subtitle) + "</p>" : "") +
      "<table><thead>" + theadHtml + "</thead><tbody>" + tbodyHtml + "</tbody></table>" +
      "<script>window.onload=function(){window.print();};<" + "/script>" +
      "</body></html>"
    );
    win.document.close();
  }

  /* Shared handler for the standard download modal (#downloadModal / #dlFormat) used across
     the app: pass a function that returns {columns, rows, title, subtitle, filenameBase} for
     whatever is currently on screen, and this builds the CSV or PDF from it. */
  function exportTable(format, filenameBase, title, subtitle, columns, rows) {
    var safeBase = String(filenameBase || title || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (format === "csv") {
      downloadCSV(safeBase + ".csv", columns, rows);
    } else {
      downloadPDF(title, subtitle, columns, rows);
    }
  }

  /* ============================================================
     AI Assistant — a lightweight, local (non-LLM) Q&A widget over
     the app's own data. Global: initAIAssistant() is called once
     from renderShell() so it's available on every authenticated
     page. State (open/closed + message history) lives in
     sessionStorage so a conversation survives page-to-page
     navigation within the same login session — this is a static
     multi-page app, not an SPA, so every link click is a full
     page load that would otherwise wipe the chat.
     ============================================================ */

  var AI_CHAT_KEY = "cui_ai_chat_v1";

  function aiLoadState() {
    try {
      var raw = sessionStorage.getItem(AI_CHAT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { open: false, messages: [] };
  }
  function aiSaveState(state) {
    try { sessionStorage.setItem(AI_CHAT_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function aiFmtRupee(n) {
    return "₹" + Math.round(n || 0).toLocaleString("en-IN");
  }

  /* An explicit project name mentioned in the question wins; otherwise scope to whatever
     project the current page is showing (?id= in the URL); otherwise every project the
     logged-in user can see. */
  function aiResolveScope(qLower) {
    var all = visibleProjects();
    var named = all.filter(function (p) { return qLower.indexOf(p.name.toLowerCase()) !== -1; });
    if (named.length === 1) return { projects: named };

    var urlId = new URLSearchParams(window.location.search).get("id");
    if (urlId) {
      var current = all.find(function (p) { return p.id === urlId; });
      if (current) return { projects: [current] };
    }
    return { projects: all };
  }

  function aiScopeLabel(scope) {
    if (scope.projects.length === 1) return "for " + scope.projects[0].name;
    if (!scope.projects.length) return "";
    return "across all " + scope.projects.length + " of your projects";
  }

  function aiTasksIn(scope) {
    var ids = scope.projects.map(function (p) { return p.id; });
    return window.Data.getTasks().filter(function (t) { return ids.indexOf(t.projectId) !== -1; });
  }

  function aiProjectTag(scope, projectId) {
    if (scope.projects.length === 1) return "";
    var p = scope.projects.find(function (x) { return x.id === projectId; });
    return p ? " (" + p.name + ")" : "";
  }

  function aiListLines(items, limit) {
    var shown = items.slice(0, limit);
    var lines = shown.map(function (s) { return "• " + s; });
    if (items.length > limit) lines.push("…and " + (items.length - limit) + " more.");
    return lines.join("\n");
  }

  function aiHelpText() {
    return "I can answer questions about your projects using the data already in the app, e.g.:\n" +
      "• \"What tasks are overdue?\"\n" +
      "• \"How much have we spent in total?\"\n" +
      "• \"Which materials are low on stock?\"\n" +
      "• \"How much wages are owed?\"\n" +
      "• \"What's the progress on Skyline Residency?\"\n" +
      "• \"Is any project over budget?\"\n" +
      "Mention a project by name to scope a question to it — otherwise I'll use whatever project you're currently viewing, or all of your projects.";
  }

  function answerAssistantQuery(question) {
    var q = question.toLowerCase().trim();
    if (!q) return "Ask me something about your projects — tasks, expenses, stock, wages, or budget.";

    if (/^(hi|hello|hey|yo)\b/.test(q) || /\bhelp\b|what can you do|what do you do/.test(q)) {
      return aiHelpText();
    }

    var scope = aiResolveScope(q);
    if (!scope.projects.length) return "You don't have access to any projects yet.";

    if (/overdue|behind schedule|\blate\b/.test(q)) {
      var today = window.Data.isoDate(window.Data.today());
      var overdueTasks = aiTasksIn(scope).filter(function (t) { return t.status !== "done" && t.date && t.date < today; });
      if (!overdueTasks.length) return "No overdue tasks " + aiScopeLabel(scope) + ". Nice work!";
      return overdueTasks.length + " task" + (overdueTasks.length === 1 ? " is" : "s are") + " overdue " + aiScopeLabel(scope) + ":\n" +
        aiListLines(overdueTasks.map(function (t) { return t.title + aiProjectTag(scope, t.projectId) + " — was due " + window.Data.displayDate(t.date); }), 6);
    }

    if (/in.?progress/.test(q)) {
      var ipTasks = aiTasksIn(scope).filter(function (t) { return t.status === "in_progress"; });
      if (!ipTasks.length) return "No tasks are currently in progress " + aiScopeLabel(scope) + ".";
      return ipTasks.length + " task" + (ipTasks.length === 1 ? " is" : "s are") + " in progress " + aiScopeLabel(scope) + ":\n" +
        aiListLines(ipTasks.map(function (t) { return t.title + aiProjectTag(scope, t.projectId); }), 6);
    }

    if (/incomplete|pending|not done|remaining|to.?do/.test(q)) {
      var pendTasks = aiTasksIn(scope).filter(function (t) { return t.status !== "done"; });
      if (!pendTasks.length) return "Every task is done " + aiScopeLabel(scope) + ".";
      var byStatus = {};
      pendTasks.forEach(function (t) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
      var breakdown = Object.keys(byStatus).map(function (k) { return byStatus[k] + " " + k.replace(/_/g, " "); }).join(", ");
      return pendTasks.length + " task" + (pendTasks.length === 1 ? " is" : "s are") + " not yet done " + aiScopeLabel(scope) + " (" + breakdown + "):\n" +
        aiListLines(pendTasks.map(function (t) { return t.title + aiProjectTag(scope, t.projectId); }), 6);
    }

    if (/completed|finished|\bdone\b/.test(q)) {
      var doneTasks = aiTasksIn(scope).filter(function (t) { return t.status === "done"; });
      var totalTasks = aiTasksIn(scope).length;
      if (!totalTasks) return "There are no tasks " + aiScopeLabel(scope) + " yet.";
      return doneTasks.length + " of " + totalTasks + " task" + (totalTasks === 1 ? "" : "s") + " " + (totalTasks === 1 ? "is" : "are") + " marked done " + aiScopeLabel(scope) + ".";
    }

    if (/how many task/.test(q)) {
      var allTasks = aiTasksIn(scope);
      return allTasks.length + " task" + (allTasks.length === 1 ? "" : "s") + " total " + aiScopeLabel(scope) + ".";
    }

    if (/low stock|reorder|running (out|low)/.test(q)) {
      var scopeIds = scope.projects.map(function (p) { return p.id; });
      var alerts = window.Business.getLowStockAlerts().filter(function (a) { return scopeIds.indexOf(a.project.id) !== -1; });
      if (!alerts.length) return "Nothing is low on stock " + aiScopeLabel(scope) + ".";
      return alerts.length + " material" + (alerts.length === 1 ? " is" : "s are") + " low on stock " + aiScopeLabel(scope) + ":\n" +
        aiListLines(alerts.map(function (a) { return a.material.name + aiProjectTag(scope, a.project.id) + " — " + a.balance + " " + a.material.unit + " left"; }), 6);
    }

    if (/wages?.*(owed|due|unpaid)|owe.*(labour|wages)/.test(q)) {
      if (scope.projects.length === 1) {
        var owed = window.Business.getWagesDueTotal(scope.projects[0].id);
        return "Wages owed " + aiScopeLabel(scope) + ": " + aiFmtRupee(owed) + ".";
      }
      var owedRows = scope.projects.map(function (p) { return { p: p, owed: window.Business.getWagesDueTotal(p.id) }; }).filter(function (r) { return r.owed > 0; });
      var totalOwed = owedRows.reduce(function (s, r) { return s + r.owed; }, 0);
      if (!owedRows.length) return "No wages currently owed " + aiScopeLabel(scope) + ".";
      return "Wages owed " + aiScopeLabel(scope) + ": " + aiFmtRupee(totalOwed) + " total.\n" +
        aiListLines(owedRows.map(function (r) { return r.p.name + " — " + aiFmtRupee(r.owed); }), 6);
    }

    if (/budget/.test(q)) {
      var budRows = scope.projects.map(function (p) {
        var cost = window.Business.getProjectCost(p.id);
        return { p: p, spent: cost.totalCashSpent, budget: p.budget || 0 };
      });
      if (scope.projects.length === 1) {
        var r0 = budRows[0];
        if (!r0.budget) return r0.p.name + " doesn't have a budget set.";
        var pct = Math.round((r0.spent / r0.budget) * 100);
        return r0.p.name + " has spent " + aiFmtRupee(r0.spent) + " of a " + aiFmtRupee(r0.budget) + " budget (" + pct + "%)" + (r0.spent > r0.budget ? " — over budget." : ".");
      }
      var overBudget = budRows.filter(function (r) { return r.budget && r.spent > r.budget; });
      if (!overBudget.length) return "No projects are over budget " + aiScopeLabel(scope) + ".";
      return overBudget.length + " project" + (overBudget.length === 1 ? " is" : "s are") + " over budget:\n" +
        aiListLines(overBudget.map(function (r) { return r.p.name + " — " + aiFmtRupee(r.spent) + " spent vs " + aiFmtRupee(r.budget) + " budget"; }), 6);
    }

    if (/progress|% ?complete|percent complete|how far along/.test(q)) {
      var progRows = scope.projects.map(function (p) { return { p: p, est: window.Business.estimateCompletion(p) }; });
      if (scope.projects.length === 1) {
        var est0 = progRows[0].est;
        if (!est0.hasData) return "No progress has been logged for " + progRows[0].p.name + " yet.";
        return progRows[0].p.name + " is " + est0.percentComplete + "% complete" + (est0.estimatedDate ? ", estimated finish " + window.Data.displayDate(est0.estimatedDate) : "") + (est0.atRisk ? " — at risk of missing its target date." : ".");
      }
      return aiListLines(progRows.map(function (r) { return r.p.name + " — " + (r.est.hasData ? r.est.percentComplete + "% complete" : "no progress logged"); }), 8);
    }

    if (/total expense|how much.*spen|total cost|total spend/.test(q)) {
      var costRows = scope.projects.map(function (p) { return { p: p, cost: window.Business.getProjectCost(p.id) }; });
      if (scope.projects.length === 1) {
        var c0 = costRows[0].cost;
        return costRows[0].p.name + " has spent " + aiFmtRupee(c0.totalCashSpent) + " total — materials " + aiFmtRupee(c0.stockCost) + ", wages " + aiFmtRupee(c0.wagesPaid) + ", supervisor salary " + aiFmtRupee(c0.supervisorSalary) + ", other " + aiFmtRupee(c0.otherExpenses) + ".";
      }
      var totalSpent = costRows.reduce(function (s, r) { return s + r.cost.totalCashSpent; }, 0);
      return "Total spent " + aiScopeLabel(scope) + ": " + aiFmtRupee(totalSpent) + ".\n" +
        aiListLines(costRows.map(function (r) { return r.p.name + " — " + aiFmtRupee(r.cost.totalCashSpent); }), 8);
    }

    var categoryMap = { transport: "transport", equipment: "equipment_rental", permit: "permits_fees", utilit: "utilities", supervisor: "supervisor_salary", misc: "misc" };
    var catKey = Object.keys(categoryMap).filter(function (k) { return q.indexOf(k) !== -1; })[0];
    if (catKey) {
      var catIds = scope.projects.map(function (p) { return p.id; });
      var catExpenses = window.Data.getExpenses().filter(function (e) { return catIds.indexOf(e.projectId) !== -1 && e.category === categoryMap[catKey]; });
      var catTotal = catExpenses.reduce(function (s, e) { return s + e.amount; }, 0);
      return aiFmtRupee(catTotal) + " spent on " + catKey + "-related expenses " + aiScopeLabel(scope) + " (" + catExpenses.length + " entr" + (catExpenses.length === 1 ? "y" : "ies") + ").";
    }

    var materials = window.Data.getMaterials();
    /* Match on the material's base name with any "(...)" qualifier stripped (e.g. "Cement
       (OPC 53)" -> "cement"), or any of its own significant words, so "how much cement do we
       have" matches without the question needing the material's exact catalog name. */
    var mentionedMaterial = materials.find(function (m) {
      var base = m.name.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
      if (base && q.indexOf(base) !== -1) return true;
      return base.split(/\s+/).some(function (w) { return w.length >= 4 && q.indexOf(w) !== -1; });
    });
    if (mentionedMaterial && /stock|balance|left|how much|remaining/.test(q)) {
      if (scope.projects.length === 1) {
        var singleBal = window.Business.getStockBalance(scope.projects[0].id, mentionedMaterial.id).balance;
        return mentionedMaterial.name + " balance " + aiScopeLabel(scope) + ": " + singleBal + " " + mentionedMaterial.unit + ".";
      }
      var matRows = scope.projects.map(function (p) { return { p: p, bal: window.Business.getStockBalance(p.id, mentionedMaterial.id).balance }; }).filter(function (r) { return r.bal !== 0; });
      var matTotal = matRows.reduce(function (s, r) { return s + r.bal; }, 0);
      if (!matRows.length) return "No " + mentionedMaterial.name + " recorded " + aiScopeLabel(scope) + ".";
      return mentionedMaterial.name + " total balance " + aiScopeLabel(scope) + ": " + matTotal + " " + mentionedMaterial.unit + ".\n" +
        aiListLines(matRows.map(function (r) { return r.p.name + " — " + r.bal + " " + mentionedMaterial.unit; }), 8);
    }

    if (/how many project|list project|active project|all project/.test(q)) {
      var visProjects = visibleProjects();
      if (!visProjects.length) return "You don't have access to any projects.";
      return visProjects.length + " project" + (visProjects.length === 1 ? "" : "s") + " you can see:\n" +
        aiListLines(visProjects.map(function (p) { return p.name + " (" + p.code + ") — " + p.status; }), 10);
    }

    return "I couldn't match that to something I track yet. " + aiHelpText();
  }

  var AI_SUGGESTIONS = ["What's overdue?", "Total expenses?", "Low stock materials?", "Wages owed?"];

  function aiRenderMessages(state) {
    var el = document.getElementById("aiAssistantMessages");
    if (!el) return;
    el.innerHTML = state.messages.map(function (m) {
      return '<div class="ai-msg ' + (m.role === "user" ? "ai-msg-user" : "ai-msg-bot") + '">' + escapeHtml(m.text) + '</div>';
    }).join("");
    var suggestionsEl = document.getElementById("aiAssistantSuggestions");
    if (suggestionsEl) suggestionsEl.style.display = state.messages.length ? "none" : "flex";
    el.scrollTop = el.scrollHeight;
  }

  function initAIAssistant() {
    if (document.getElementById("aiAssistantFab")) return;

    var fab = document.createElement("button");
    fab.className = "ai-fab";
    fab.id = "aiAssistantFab";
    fab.type = "button";
    fab.setAttribute("aria-label", "AI Assistant");
    fab.innerHTML = svg("messageCircle");
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "ai-panel";
    panel.id = "aiAssistantPanel";
    panel.innerHTML =
      '<div class="ai-panel-header">' +
        '<div class="ai-panel-title">' + svg("sparkles") + 'AI Assistant<span class="ai-panel-badge">Local</span></div>' +
        '<div class="ai-panel-header-actions">' +
          '<button type="button" class="ai-panel-icon-btn" id="aiAssistantClear" title="Clear chat">' + svg("trash") + '</button>' +
          '<button type="button" class="ai-panel-icon-btn ai-panel-close-x" id="aiAssistantClose" title="Close">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="ai-panel-messages" id="aiAssistantMessages"></div>' +
      '<div class="ai-panel-suggestions" id="aiAssistantSuggestions">' +
        AI_SUGGESTIONS.map(function (s) { return '<button type="button" class="ai-suggestion-chip" data-ai-suggestion="' + escapeHtml(s) + '">' + s + '</button>'; }).join("") +
      '</div>' +
      '<form class="ai-panel-input-row" id="aiAssistantForm">' +
        '<input type="text" id="aiAssistantInput" placeholder="Ask about tasks, expenses, stock…" autocomplete="off">' +
        '<button type="submit" class="ai-panel-send" aria-label="Send">' + svg("send") + '</button>' +
      '</form>';
    document.body.appendChild(panel);

    var state = aiLoadState();
    if (state.open) panel.classList.add("show");
    aiRenderMessages(state);

    function persist() { aiSaveState(state); }

    fab.addEventListener("click", function () {
      state.open = !state.open;
      panel.classList.toggle("show", state.open);
      persist();
      if (state.open) document.getElementById("aiAssistantInput").focus();
    });
    document.getElementById("aiAssistantClose").addEventListener("click", function () {
      state.open = false;
      panel.classList.remove("show");
      persist();
    });
    document.getElementById("aiAssistantClear").addEventListener("click", function () {
      state.messages = [];
      persist();
      aiRenderMessages(state);
    });

    function sendMessage(text) {
      text = text.trim();
      if (!text) return;
      state.messages.push({ role: "user", text: text });
      persist();
      aiRenderMessages(state);

      var messagesEl = document.getElementById("aiAssistantMessages");
      var typingEl = document.createElement("div");
      typingEl.className = "ai-msg ai-msg-bot ai-msg-typing";
      typingEl.innerHTML = "<span></span><span></span><span></span>";
      messagesEl.appendChild(typingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      setTimeout(function () {
        var answer;
        try { answer = answerAssistantQuery(text); } catch (e) { answer = "Something went wrong answering that — try rephrasing."; }
        state.messages.push({ role: "assistant", text: answer });
        persist();
        aiRenderMessages(state);
      }, 380);
    }

    document.getElementById("aiAssistantForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("aiAssistantInput");
      sendMessage(input.value);
      input.value = "";
    });
    document.getElementById("aiAssistantSuggestions").addEventListener("click", function (e) {
      var chip = e.target.closest("[data-ai-suggestion]");
      if (!chip) return;
      sendMessage(chip.getAttribute("data-ai-suggestion"));
    });
  }

  window.App = {
    isLoggedIn: isLoggedIn,
    requireAuth: requireAuth,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getCurrentRole: getCurrentRole,
    isAdmin: isAdmin,
    can: can,
    canAccessProject: canAccessProject,
    visibleProjects: visibleProjects,
    guardProjectAccess: guardProjectAccess,
    guardAdminOnly: guardAdminOnly,
    guardPermission: guardPermission,
    applyRoleVisibility: applyRoleVisibility,
    initSidebar: initSidebar,
    initLogout: initLogout,
    initUserBadge: initUserBadge,
    positionActionMenu: positionActionMenu,
    initCombobox: initCombobox,
    showToast: showToast,
    renderShell: renderShell,
    svg: svg,
    icons: ICONS,
    projectTabsHtml: projectTabsHtml,
    sortRows: sortRows,
    sortableTh: sortableTh,
    wireSort: wireSort,
    refreshSortArrows: refreshSortArrows,
    renderPager: renderPager,
    paginate: paginate,
    downloadCSV: downloadCSV,
    downloadPDF: downloadPDF,
    exportTable: exportTable
  };
})();
