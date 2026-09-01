/* ============================================================
   Shared demo data store — seeds Projects, Labourers, Materials
   etc. once, then persists to localStorage so every page reads
   the same live records. No backend: this file *is* the database.
   ============================================================ */

(function () {
  "use strict";

  var USERS_KEY = "cui_users_v1";
  var PROJECTS_KEY = "cui_projects_v1";
  var LABOURERS_KEY = "cui_labourers_v1";
  var ATTENDANCE_KEY = "cui_attendance_v1";
  var WAGE_PAYMENTS_KEY = "cui_wage_payments_v1";
  var MATERIALS_KEY = "cui_materials_v1";
  var STOCK_TXNS_KEY = "cui_stock_txns_v1";
  var EXPENSES_KEY = "cui_expenses_v1";
  var WORK_REPORTS_KEY = "cui_work_reports_v1";
  var PROGRESS_KEY = "cui_progress_v1";

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function isoDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function addDays(base, days) {
    var d = new Date(base.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function displayDate(iso) {
    var parts = iso.split("-");
    return parts[2] + " " + MONTHS[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  function today() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* ---------------- generic get/save with lazy seeding ---------------- */

  function makeStore(key, buildSeed) {
    return {
      get: function () {
        var raw = localStorage.getItem(key);
        if (raw) {
          try { return JSON.parse(raw); } catch (e) { /* fall through to reseed */ }
        }
        var seeded = buildSeed();
        localStorage.setItem(key, JSON.stringify(seeded));
        return seeded;
      },
      save: function (list) {
        localStorage.setItem(key, JSON.stringify(list));
      }
    };
  }

  /* ---------------- Users (demo login directory) ---------------- */

  function buildSeedUsers() {
    return [
      { id: "u1", name: "Vijay Kumar", role: "admin", phone: "9840012345", assignedProjectIds: [] },
      { id: "u2", name: "Ramesh Babu", role: "supervisor", phone: "9840023456", assignedProjectIds: ["p1"] },
      { id: "u3", name: "Suresh Raj", role: "supervisor", phone: "9840034567", assignedProjectIds: ["p2"] },
      { id: "u4", name: "Anitha Selvam", role: "supervisor", phone: "9840045678", assignedProjectIds: ["p1", "p3"] }
    ];
  }

  var usersStore = makeStore(USERS_KEY, buildSeedUsers);

  /* ---------------- Projects ---------------- */

  function buildSeedProjects() {
    var t = today();
    return [
      {
        id: "p1",
        name: "Skyline Residency",
        code: "PRJ-101",
        address: "Plot 14, Anna Nagar West, Chennai",
        clientName: "Skyline Builders Pvt Ltd",
        startDate: isoDate(addDays(t, -140)),
        targetEndDate: isoDate(addDays(t, 70)),
        status: "active",
        budget: 18500000,
        description: "G+4 residential apartment block, 12 units."
      },
      {
        id: "p2",
        name: "Green Valley Apartments",
        code: "PRJ-102",
        address: "Survey 22/3, Perungudi, Chennai",
        clientName: "Green Valley Developers",
        startDate: isoDate(addDays(t, -60)),
        targetEndDate: isoDate(addDays(t, 160)),
        status: "active",
        budget: 24500000,
        description: "G+6 residential tower with basement parking."
      },
      {
        id: "p3",
        name: "Riverside Commercial Complex",
        code: "PRJ-103",
        address: "NH-45 Service Road, Tambaram",
        clientName: "Riverside Ventures LLP",
        startDate: isoDate(addDays(t, -20)),
        targetEndDate: isoDate(addDays(t, 260)),
        status: "planning",
        budget: 41000000,
        description: "Ground+3 commercial complex with retail units."
      }
    ];
  }

  var projectsStore = makeStore(PROJECTS_KEY, buildSeedProjects);

  /* ---------------- Labourers (global master) ---------------- */

  var LABOURER_FIRST = ["Murugan", "Selvam", "Kannan", "Raja", "Mani", "Senthil", "Vasu", "Elango", "Prakash", "Dinesh", "Bala", "Gopal", "Iyyappan", "Karuppasamy", "Marimuthu"];
  var LABOURER_LAST = ["Kumar", "Raj", "Pillai", "Nadar", "Gounder", "Naidu", "Chettiar"];
  var SKILLS = ["Mason", "Helper", "Electrician", "Plumber", "Carpenter", "Painter", "Welder", "Bar Bender"];
  var SKILL_WAGE = { Mason: 850, Helper: 550, Electrician: 900, Plumber: 850, Carpenter: 800, Painter: 700, Welder: 900, "Bar Bender": 750 };

  function buildSeedLabourers() {
    return LABOURER_FIRST.map(function (first, i) {
      var last = LABOURER_LAST[i % LABOURER_LAST.length];
      var skill = SKILLS[i % SKILLS.length];
      return {
        id: "lb" + (i + 1),
        name: first + " " + last,
        skill: skill,
        defaultDailyWage: SKILL_WAGE[skill] + (i % 3) * 25,
        phone: "9" + String(700000000 + i * 91117).slice(0, 9),
        isActive: i % 11 !== 0
      };
    });
  }

  var labourersStore = makeStore(LABOURERS_KEY, buildSeedLabourers);

  /* ---------------- Attendance (dated labourer<->project join) ---------------- */

  function buildSeedAttendance() {
    var labourers = buildSeedLabourers();
    var records = [];
    var t = today();

    for (var d = 30; d >= 1; d--) {
      var date = isoDate(addDays(t, -d));
      var dayIndex = 30 - d;
      var projectForDay = dayIndex % 5 === 4 ? "p2" : "p1";

      labourers.forEach(function (lab, li) {
        if (!lab.isActive) return;
        var worksToday = (li + dayIndex) % 4 !== 0;
        if (!worksToday) return;
        var half = (li + dayIndex) % 9 === 0;
        records.push({
          id: "att_" + date + "_" + lab.id,
          labourerId: lab.id,
          projectId: projectForDay,
          date: date,
          daysWorked: half ? 0.5 : 1,
          wageRate: lab.defaultDailyWage,
          status: "present",
          notes: "",
          markedByUserId: projectForDay === "p1" ? "u2" : "u3"
        });
      });
    }
    return records;
  }

  var attendanceStore = makeStore(ATTENDANCE_KEY, buildSeedAttendance);

  /* ---------------- Wage payments ---------------- */

  function buildSeedWagePayments() {
    var labourers = buildSeedLabourers();
    var t = today();
    var payments = [];
    labourers.forEach(function (lab, i) {
      if (!lab.isActive) return;
      if (i % 3 === 0) {
        payments.push({
          id: "wp_" + lab.id + "_1",
          labourerId: lab.id,
          projectId: "p1",
          amount: Math.round(lab.defaultDailyWage * 6),
          type: "advance",
          date: isoDate(addDays(t, -22)),
          notes: "Advance for family expenses"
        });
      }
      if (i % 4 === 0) {
        payments.push({
          id: "wp_" + lab.id + "_2",
          labourerId: lab.id,
          projectId: "p1",
          amount: Math.round(lab.defaultDailyWage * 10),
          type: "payment",
          date: isoDate(addDays(t, -8)),
          notes: "Fortnightly settlement"
        });
      }
    });
    return payments;
  }

  var wagePaymentsStore = makeStore(WAGE_PAYMENTS_KEY, buildSeedWagePayments);

  /* ---------------- Materials (global master) ---------------- */

  function buildSeedMaterials() {
    return [
      { id: "m1", name: "TMT Steel (Iron Rod)", category: "Steel", unit: "ton", reorderThreshold: 2 },
      { id: "m2", name: "Cement (OPC 53)", category: "Cement", unit: "bag", reorderThreshold: 100 },
      { id: "m3", name: "River Sand", category: "Sand", unit: "cft", reorderThreshold: 500 },
      { id: "m4", name: "Blue Metal Jelly", category: "Aggregate", unit: "cft", reorderThreshold: 400 },
      { id: "m5", name: "Red Bricks", category: "Masonry", unit: "piece", reorderThreshold: 2000 },
      { id: "m6", name: "Plywood Sheet", category: "Carpentry", unit: "sheet", reorderThreshold: 20 },
      { id: "m7", name: "Emulsion Paint", category: "Finishing", unit: "litre", reorderThreshold: 50 },
      { id: "m8", name: "Vitrified Tiles", category: "Finishing", unit: "sqft", reorderThreshold: 300 }
    ];
  }

  var materialsStore = makeStore(MATERIALS_KEY, buildSeedMaterials);

  /* ---------------- Stock transactions (inward / outward / adjustment) ---------------- */

  var SUPPLIERS = ["Sri Balaji Steels", "Chennai Cement Depot", "Anna Sand Suppliers", "Metro Building Materials", "Tamil Nadu Hardware Mart"];

  function buildSeedStockTxns() {
    var materials = buildSeedMaterials();
    var t = today();
    var txns = [];
    var projects = ["p1", "p2"];

    projects.forEach(function (pid, pIdx) {
      materials.forEach(function (mat, mIdx) {
        var baseQty = mat.reorderThreshold * 2.6;
        var rate = [1, 2, 3, 4, 5, 6, 7, 8][mIdx] === mIdx ? 1 : 1;
        var unitRate = { m1: 62000, m2: 380, m3: 55, m4: 60, m5: 9, m6: 1450, m7: 260, m8: 68 }[mat.id];

        txns.push({
          id: "st_" + pid + "_" + mat.id + "_in1",
          projectId: pid,
          materialId: mat.id,
          type: "inward",
          quantity: baseQty,
          ratePerUnit: unitRate,
          totalAmount: Math.round(baseQty * unitRate),
          date: isoDate(addDays(t, -35 + pIdx * 5)),
          supplierName: SUPPLIERS[(pIdx + mIdx) % SUPPLIERS.length],
          invoiceNumber: "INV-" + (4000 + pIdx * 80 + mIdx * 7),
          notes: ""
        });

        var usedQty = Math.round(baseQty * 0.55);
        txns.push({
          id: "st_" + pid + "_" + mat.id + "_out1",
          projectId: pid,
          materialId: mat.id,
          type: "outward",
          quantity: usedQty,
          ratePerUnit: unitRate,
          totalAmount: Math.round(usedQty * unitRate),
          date: isoDate(addDays(t, -18 + pIdx * 5)),
          supplierName: "",
          invoiceNumber: "",
          notes: "Issued to site for construction use"
        });

        if (mIdx % 3 === 0) {
          var topUp = Math.round(baseQty * 0.4);
          txns.push({
            id: "st_" + pid + "_" + mat.id + "_in2",
            projectId: pid,
            materialId: mat.id,
            type: "inward",
            quantity: topUp,
            ratePerUnit: unitRate,
            totalAmount: Math.round(topUp * unitRate),
            date: isoDate(addDays(t, -6 + pIdx * 3)),
            supplierName: SUPPLIERS[(pIdx + mIdx + 2) % SUPPLIERS.length],
            invoiceNumber: "INV-" + (4200 + pIdx * 80 + mIdx * 7),
            notes: "Restock"
          });
        }
      });
    });

    return txns;
  }

  var stockTxnsStore = makeStore(STOCK_TXNS_KEY, buildSeedStockTxns);

  /* ---------------- Expenses ---------------- */

  var EXPENSE_CATEGORIES = ["transport", "equipment_rental", "permits_fees", "utilities", "misc"];
  var EXPENSE_DESCRIPTIONS = {
    transport: ["Material transport lorry hire", "Site vehicle fuel", "Labour transport van"],
    equipment_rental: ["Concrete mixer rental", "Scaffolding rental", "JCB excavator hire"],
    permits_fees: ["Corporation building permit fee", "Electricity connection fee"],
    utilities: ["Site electricity bill", "Water tanker charges"],
    misc: ["Site office supplies", "Tea and refreshments", "Miscellaneous site expense"]
  };

  function buildSeedExpenses() {
    var t = today();
    var expenses = [];
    var projects = ["p1", "p2"];
    projects.forEach(function (pid, pIdx) {
      EXPENSE_CATEGORIES.forEach(function (cat, cIdx) {
        var options = EXPENSE_DESCRIPTIONS[cat];
        options.forEach(function (desc, dIdx) {
          expenses.push({
            id: "ex_" + pid + "_" + cat + "_" + dIdx,
            projectId: pid,
            category: cat,
            amount: 1500 + (pIdx * 700) + (cIdx * 900) + (dIdx * 350),
            date: isoDate(addDays(t, -25 + pIdx * 4 + cIdx * 3 + dIdx)),
            description: desc
          });
        });
      });
    });
    return expenses;
  }

  var expensesStore = makeStore(EXPENSES_KEY, buildSeedExpenses);

  /* ---------------- Work reports ---------------- */

  var WORK_LOG_TEMPLATES = [
    "Foundation excavation completed for grid line {n}.",
    "Column casting done for {n} columns on this level.",
    "Brickwork completed for east wing wall, level {n}.",
    "Plastering work in progress, {n}% of floor completed.",
    "Electrical conduit laying completed for {n} rooms.",
    "Plumbing rough-in work completed for {n} bathrooms.",
    "Flooring tile work completed for {n} sqft.",
    "Painting primer coat applied to {n} rooms."
  ];

  function buildSeedWorkReports() {
    var t = today();
    var reports = [];
    var projects = ["p1", "p2", "p3"];
    projects.forEach(function (pid, pIdx) {
      for (var i = 0; i < 8; i++) {
        var template = WORK_LOG_TEMPLATES[(pIdx + i) % WORK_LOG_TEMPLATES.length];
        var n = 3 + ((pIdx + i) % 12);
        reports.push({
          id: "wr_" + pid + "_" + i,
          projectId: pid,
          date: isoDate(addDays(t, -(i * 4 + pIdx))),
          title: "Daily site update",
          description: template.replace("{n}", n)
        });
      }
    });
    return reports;
  }

  var workReportsStore = makeStore(WORK_REPORTS_KEY, buildSeedWorkReports);

  /* ---------------- Progress updates ---------------- */

  function buildSeedProgress() {
    var t = today();
    var updates = [];
    var config = {
      p1: { points: [5, 18, 34, 47, 58, 66], startOffset: -130 },
      p2: { points: [4, 12, 22, 31], startOffset: -55 },
      p3: { points: [2, 6], startOffset: -18 }
    };
    Object.keys(config).forEach(function (pid) {
      var cfg = config[pid];
      cfg.points.forEach(function (pct, i) {
        var dayOffset = cfg.startOffset + i * Math.round(Math.abs(cfg.startOffset) / cfg.points.length);
        updates.push({
          id: "pu_" + pid + "_" + i,
          projectId: pid,
          date: isoDate(addDays(t, dayOffset)),
          percentComplete: pct,
          notes: pct < 15 ? "Foundation stage" : pct < 40 ? "Structure stage" : pct < 60 ? "Masonry & plastering" : "Finishing stage"
        });
      });
    });
    return updates;
  }

  var progressStore = makeStore(PROGRESS_KEY, buildSeedProgress);

  /* ---------------- Cross-entity helpers ---------------- */

  function addAttendance(record) {
    var all = attendanceStore.get();
    var conflict = all.some(function (r) {
      return r.labourerId === record.labourerId && r.date === record.date && r.id !== record.id;
    });
    if (conflict) {
      return { ok: false, error: "This labourer already has attendance marked on " + displayDate(record.date) + " for another project." };
    }
    if (!record.id) record.id = uid("att");
    if (record.wageRate === undefined || record.wageRate === null) {
      var lab = labourersStore.get().find(function (l) { return l.id === record.labourerId; });
      record.wageRate = lab ? lab.defaultDailyWage : 0;
    }
    var idx = all.findIndex(function (r) { return r.id === record.id; });
    if (idx >= 0) all[idx] = record; else all.push(record);
    attendanceStore.save(all);
    return { ok: true, record: record };
  }

  window.Data = {
    uid: uid,
    isoDate: isoDate,
    displayDate: displayDate,
    addDays: addDays,
    today: today,

    getUsers: usersStore.get, saveUsers: usersStore.save,
    getProjects: projectsStore.get, saveProjects: projectsStore.save,
    getLabourers: labourersStore.get, saveLabourers: labourersStore.save,
    getAttendance: attendanceStore.get, saveAttendance: attendanceStore.save,
    addAttendance: addAttendance,
    getWagePayments: wagePaymentsStore.get, saveWagePayments: wagePaymentsStore.save,
    getMaterials: materialsStore.get, saveMaterials: materialsStore.save,
    getStockTransactions: stockTxnsStore.get, saveStockTransactions: stockTxnsStore.save,
    getExpenses: expensesStore.get, saveExpenses: expensesStore.save,
    getWorkReports: workReportsStore.get, saveWorkReports: workReportsStore.save,
    getProgressUpdates: progressStore.get, saveProgressUpdates: progressStore.save,

    SKILLS: SKILLS,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES
  };
})();
