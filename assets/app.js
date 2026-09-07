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
    warehouse: '<path d="M3 21V10l9-6 9 6v11"/><path d="M3 21h18"/><path d="M9 21v-7h6v7"/>'
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
    { key: "labour", href: "labour-list.html", label: "Labourers", icon: "people", require: "labour:read" },
    { key: "materials", href: "godown.html", label: "Godown", icon: "warehouse", require: "stock:read" },
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
    { key: "labour", href: "project-labour.html", label: "Labour", icon: "people" },
    { key: "wages", href: "project-wages.html", label: "Wages", icon: "coins" },
    { key: "stock", href: "project-stock.html", label: "Stock", icon: "box" },
    { key: "expenses", href: "project-expenses.html", label: "Expenses", icon: "wallet" },
    { key: "reports", href: "project-reports.html", label: "Reports", icon: "fileText" },
    { key: "progress", href: "project-progress.html", label: "Progress", icon: "trendingUp" }
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
    projectTabsHtml: projectTabsHtml
  };
})();
