// ================= DATA =================
var KEY = "expenseDataV2";   // same key as before, so your old data still loads
var icons = { Food: "🍔", Travel: "🚌", Shopping: "🛍️", Bills: "🧾", Education: "📚",
              Entertainment: "🎬", "Clothing & Shoes": "👟", Salary: "💰", Other: "📌", "Mutual Fund": "📈" };
var categories = ["Food", "Travel", "Shopping", "Clothing & Shoes", "Bills", "Education", "Entertainment", "Mutual Fund", "Other"];
var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

var income = 50000;     // monthly salary
var salaryDay = 1;      // new month starts on this day
var expenses = [];      // {date, name, category, amount, type}  type = "expense" or "income"
var funds = [];         // old mutual fund data (still shown as expenses)
var type = "expense";   // type selected in Add popup
var backendReady = false;
var API_ORIGIN = window.location.origin;
if (window.location.protocol === "file:") {
  API_ORIGIN = "http://127.0.0.1:5000";
} else if ((window.location.protocol === "http:" || window.location.protocol === "https:") &&
           window.location.port && window.location.port !== "5000") {
  API_ORIGIN = window.location.protocol + "//" + window.location.hostname + ":5000";
}
var API_BASE = API_ORIGIN === window.location.origin ? "/api" : API_ORIGIN + "/api";

function pad(n) { return (n < 10 ? "0" : "") + n; }
var now = new Date();
var todayStr = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

var localState = null;
try {
  var storedState = localStorage.getItem(KEY);
  if (storedState) localState = JSON.parse(storedState);
} catch (e) {
  console.error("Could not read locally saved expense data:", e);
}

function save() {
  var snapshot = JSON.stringify({ income: income, salaryDay: salaryDay, expenses: expenses, funds: funds });
  try {
    localStorage.setItem(KEY, snapshot);
  } catch (e) {
    showStatus("Could not save a browser backup: " + e.message);
  }
}

async function apiRequest(route, options) {
  options = options || {};
  options.headers = options.headers || {};
  if (options.body) options.headers["Content-Type"] = "application/json";
  var url = API_BASE + route;
  var response = await fetch(url, options);
  var payload = null;
  try {
    payload = await response.json();
  } catch (e) {
    if (response.ok) throw new Error("The Node.js server returned an invalid response.");
  }
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("API route not found at " + url + ". Open the app at http://localhost:5000 or check the Node.js server.");
    }
    throw new Error(payload && payload.error ? payload.error : "Server returned HTTP " + response.status + ".");
  }
  return payload;
}

function isValidLocalState(state) {
  return state && Array.isArray(state.expenses) && Array.isArray(state.funds) &&
         Number.isFinite(Number(state.income)) && Number.isFinite(Number(state.salaryDay));
}

function applyRemoteState(settings, records) {
  income = Number(settings.income);
  salaryDay = Number(settings.salaryDay);
  expenses = records.filter(function (item) { return item.category !== "Mutual Fund"; });
  funds = records.filter(function (item) { return item.category === "Mutual Fund"; });
}

// ================= HELPERS =================
function money(n) { return "₹" + n.toLocaleString("en-IN"); }
function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fmt(dt) { return dt.getDate() + " " + monthNames[dt.getMonth()] + " " + dt.getFullYear(); }
function fmtStr(d) { var p = d.split("-"); return Number(p[2]) + " " + monthNames[Number(p[1]) - 1] + " " + p[0]; }

// A new month starts on the salary day
function cycleKey(dateStr) {
  var p = dateStr.split("-");
  var y = Number(p[0]), m = Number(p[1]) - 1;
  var k = y * 12 + m;
  var last = new Date(y, m + 1, 0).getDate();   // days in that month
  if (Number(p[2]) < Math.min(salaryDay, last)) k--;
  return k;
}
function keyDate(k, day) {
  var y = Math.floor(k / 12), m = k % 12;
  var last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}
var thisMonth = cycleKey(todayStr);

function byId(id) { return document.getElementById(id); }

function showStatus(message) {
  var status = byId("status");
  if (!status) return;
  status.innerText = message;
  status.classList.toggle("show", Boolean(message));
}

async function initialize() {
  try {
    var remote = await Promise.all([
      apiRequest("/settings"),
      apiRequest("/expenses")
    ]);
    var settings = remote[0];
    var records = remote[1];
    if (!Array.isArray(records)) throw new Error("The server returned an invalid transaction list.");

    if (records.length === 0 && isValidLocalState(localState) &&
        (localState.expenses.length > 0 || localState.funds.length > 0)) {
      await apiRequest("/settings", {
        method: "PUT",
        body: JSON.stringify({ income: localState.income, salaryDay: localState.salaryDay })
      });
      var toImport = localState.expenses.concat(localState.funds.map(function (item) {
        return {
          name: item.name,
          amount: item.amount,
          category: "Mutual Fund",
          date: item.date,
          type: "expense"
        };
      }));
      for (var i = 0; i < toImport.length; i++) {
        await apiRequest("/expenses", { method: "POST", body: JSON.stringify(toImport[i]) });
      }
      remote = await Promise.all([apiRequest("/settings"), apiRequest("/expenses")]);
      settings = remote[0];
      records = remote[1];
    }

    applyRemoteState(settings, records);
    backendReady = true;
    showStatus("");
  } catch (e) {
    backendReady = false;
    if (isValidLocalState(localState)) {
      income = Number(localState.income);
      salaryDay = Number(localState.salaryDay);
      expenses = localState.expenses;
      funds = localState.funds;
    }
    showStatus("Cannot reach the Node.js API at " + API_ORIGIN +
      ". In VS Code, run Terminal > Run Task > Start Expense Tracker API, then refresh this page. " + e.message);
  }
  byId("incomeInput").value = income;
  byId("dayInput").value = salaryDay;
  thisMonth = cycleKey(todayStr);
  repKey = thisMonth;
  showPage();
}

// fill category dropdown
categories.forEach(function (c) { byId("category").innerHTML += "<option>" + c + "</option>"; });
byId("date").value = todayStr;
byId("incomeInput").value = income;
byId("dayInput").value = salaryDay;

// ================= SHOW PAGE =================
function showPage() {
  // join expenses and funds in one list
  var items = [];
  expenses.forEach(function (e, i) {
    items.push({ src: "e", i: i, date: e.date, name: e.name, category: e.category,
                 amount: e.amount, type: e.type || "expense" });
  });
  funds.forEach(function (f, i) {
    items.push({ src: "f", i: i, date: f.date, name: f.name, category: "Mutual Fund",
                 amount: f.amount, type: "expense" });
  });

  // only this month
  items = items.filter(function (t) { return cycleKey(t.date) === thisMonth; });
  items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  var totalIn = income, totalOut = 0;
  items.forEach(function (t) {
    if (t.type === "income") totalIn += t.amount; else totalOut += t.amount;
  });

  byId("balance").innerText = money(totalIn - totalOut);
  byId("sIncome").innerText = money(totalIn);
  byId("sExpense").innerText = money(totalOut);

  var start = keyDate(thisMonth, salaryDay);
  var next = keyDate(thisMonth + 1, salaryDay);
  var end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  var days = Math.round((next - todayMid) / 86400000);
  byId("monthName").innerText = monthNames[start.getMonth()] + " " + start.getFullYear();
  byId("cycleInfo").innerText = fmt(start) + " → " + fmt(end) + " | " + days + " day(s) to next salary";

  // transactions grouped by date
  var html = "", lastDate = "";
  items.forEach(function (t) {
    if (t.date !== lastDate) {
      var dayTotal = 0;
      items.forEach(function (x) {
        if (x.date === t.date) dayTotal += (x.type === "income" ? x.amount : -x.amount);
      });
      html += '<div class="day"><span>' + (t.date === todayStr ? "Today" : fmtStr(t.date)) +
              "</span><span>Total " + (dayTotal < 0 ? "-" : "") + money(Math.abs(dayTotal)) + "</span></div>";
      lastDate = t.date;
    }
    var isIn = t.type === "income";
    html += '<div class="row"><span class="ic">' + (icons[t.category] || "📌") + "</span>" +
            '<div class="info"><b>' + esc(t.name) + "</b><small>" + t.category + "</small></div>" +
            '<span class="amt ' + (isIn ? "plus-amt" : "minus") + '">' + (isIn ? "+" : "-") + money(t.amount) + "</span>" +
            '<button class="x" onclick="removeItem(\'' + t.src + "'," + t.i + ')">✖</button></div>';
  });
  if (items.length === 0) html = '<p class="empty">No transactions yet.<br>Tap + to add one.</p>';
  byId("list").innerHTML = html;

  showReport();
  save();
}

// ================= ACTIONS =================
function removeItem(src, i) {
  var collection = src === "e" ? expenses : funds;
  var item = collection[i];
  if (!item) return;
  if (!backendReady) {
    collection.splice(i, 1);
    showPage();
    return;
  }
  if (!item._id) {
    showStatus("This transaction has no server ID. Reload the page and try again.");
    return;
  }
  var itemId = item._id;
  apiRequest("/expenses/" + encodeURIComponent(itemId), { method: "DELETE" })
    .then(function () {
      var currentIndex = collection.findIndex(function (entry) { return entry._id === itemId; });
      if (currentIndex !== -1) collection.splice(currentIndex, 1);
      showPage();
      showStatus("");
    })
    .catch(function (e) {
      showStatus("Could not delete the transaction: " + e.message);
    });
}

// open and close popups
function openPop(id) { byId(id).classList.add("show"); }
function closePop(id) { byId(id).classList.remove("show"); }
byId("addOpen").onclick = function () { openPop("addPop"); };
byId("setOpen").onclick = function () { openPop("setPop"); };
function showView(v) {
  byId("homeView").style.display = v === "home" ? "block" : "none";
  byId("reportView").style.display = v === "report" ? "block" : "none";
  byId("homeBtn").className = "navbtn" + (v === "home" ? " on" : "");
  byId("repBtn").className = "navbtn" + (v === "report" ? " on" : "");
  window.scrollTo(0, 0);
}
byId("homeBtn").onclick = function () { showView("home"); };
byId("repBtn").onclick = function () { showView("report"); };
document.querySelectorAll("[data-close]").forEach(function (b) {
  b.onclick = function () { closePop(b.getAttribute("data-close")); };
});

// add transaction
byId("form").addEventListener("submit", async function (ev) {
  ev.preventDefault();
  var item = {
    date: byId("date").value,
    name: byId("name").value.trim(),
    category: byId("category").value,
    amount: Number(byId("amount").value),
    type: type
  };
  try {
    if (backendReady) {
      item = await apiRequest("/expenses", { method: "POST", body: JSON.stringify(item) });
      if (item.category === "Mutual Fund") funds.push(item); else expenses.push(item);
    } else if (item.category === "Mutual Fund") {
      funds.push(item);
    } else {
      expenses.push(item);
    }
  } catch (e) {
    showStatus("Could not save the transaction: " + e.message);
    return;
  }
  this.reset();
  byId("date").value = todayStr;
  closePop("addPop");
  showPage();
});

// settings
byId("saveSetBtn").onclick = async function () {
  var inc = Number(byId("incomeInput").value);
  var day = Math.round(Number(byId("dayInput").value));
  if (!(inc > 0) || !(day >= 1 && day <= 30)) {
    showStatus("Enter a salary above zero and a credit date from 1 to 30.");
    return;
  }
  if (backendReady) {
    try {
      await apiRequest("/settings", {
        method: "PUT",
        body: JSON.stringify({ income: inc, salaryDay: day })
      });
    } catch (e) {
      showStatus("Could not save settings: " + e.message);
      return;
    }
  }
  income = inc;
  salaryDay = day;
  byId("incomeInput").value = income;
  byId("dayInput").value = salaryDay;
  showStatus("");
  thisMonth = cycleKey(todayStr);
  closePop("setPop");
  showPage();
};

byId("clearBtn").onclick = function () {
  if (confirm("Delete all transactions?")) {
    if (!backendReady) {
      expenses = [];
      funds = [];
      showPage();
      return;
    }
    apiRequest("/expenses", { method: "DELETE" }).then(function () {
      expenses = [];
      funds = [];
      showPage();
      showStatus("");
    }).catch(function (e) {
      showStatus("Could not clear transactions: " + e.message);
    });
  }
};

byId("themeBtn").onclick = function () {
  var r = document.documentElement;
  var dark = r.getAttribute("data-theme") === "dark" ||
             (!r.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  r.setAttribute("data-theme", dark ? "light" : "dark");
};

// ================= REPORT (month wise) =================
var repKey = thisMonth;       // month being shown in report
var repTab = "expense";       // "expense" or "income"
var repSlices = [];
var colors = { Food: "#e67e22", Travel: "#3498db", Shopping: "#e84393", "Clothing & Shoes": "#ff6d00",
               Bills: "#e74c3c", Education: "#27ae60", Entertainment: "#8e44ad", Other: "#7f8c8d", "Mutual Fund": "#f1c40f" };

function monthItems(k) {
  var items = [];
  expenses.forEach(function (e) {
    items.push({ date: e.date, name: e.name, category: e.category, amount: e.amount, type: e.type || "expense" });
  });
  funds.forEach(function (f) {
    items.push({ date: f.date, name: f.name, category: "Mutual Fund", amount: f.amount, type: "expense" });
  });
  return items.filter(function (t) { return cycleKey(t.date) === k; });
}

function showReport() {
  if (repKey > thisMonth) repKey = thisMonth;
  byId("repMonth").innerText = monthNames[repKey % 12] + " " + Math.floor(repKey / 12);
  byId("nextM").disabled = repKey >= thisMonth;
  byId("repExp").className = repTab === "expense" ? "on" : "";
  byId("repInc").className = repTab === "income" ? "on" : "";
  byId("expPanel").style.display = repTab === "expense" ? "block" : "none";
  byId("incPanel").style.display = repTab === "income" ? "block" : "none";
  var items = monthItems(repKey);
  if (repTab === "expense") showExpenseReport(items); else showIncomeReport(items);
}

function showExpenseReport(items) {
  var totals = {}, total = 0;
  items.forEach(function (t) {
    if (t.type === "expense") { totals[t.category] = (totals[t.category] || 0) + t.amount; total += t.amount; }
  });
  var cats = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; });
  var C = 2 * Math.PI * 70, offset = 0, svg = "", html = "";
  repSlices = [];

  if (total === 0) {
    svg = '<circle cx="100" cy="100" r="70" fill="none" stroke="#ccc" stroke-width="30"></circle>';
    html = '<p class="empty">No expenses in this month.</p>';
  }
  cats.forEach(function (c, i) {
    var part = totals[c] / total, len = part * C;
    var col = colors[c] || "#7f8c8d";
    var pct = (part * 100).toFixed(1);
    repSlices.push(c + ": " + money(totals[c]) + " (" + pct + "%)");
    svg += '<circle class="seg" cx="100" cy="100" r="70" fill="none" stroke="' + col + '" stroke-width="30"' +
           ' stroke-dasharray="' + len + " " + (C - len) + '" stroke-dashoffset="' + (-offset) + '"' +
           ' transform="rotate(-90 100 100)" onclick="showTip(' + i + ')"></circle>';
    offset += len;
    html += '<div class="row"><span class="ic">' + (icons[c] || "📌") + "</span>" +
            '<div class="info"><b>' + c + "</b><small>" + pct + "% of total</small>" +
            '<div class="bar"><div style="width:' + pct + "%;background:" + col + '"></div></div></div>' +
            '<span class="amt">' + money(totals[c]) + "</span></div>";
  });
  svg += '<text x="100" y="94" text-anchor="middle" font-size="11" fill="#888">Total Expenses</text>' +
         '<text x="100" y="116" text-anchor="middle" font-size="17" font-weight="bold" fill="currentColor">' + money(total) + "</text>";

  byId("donut").innerHTML = svg;
  byId("donutTip").innerText = "Tap a slice";
  byId("repTotal").innerText = money(total);
  byId("catList").innerHTML = html;
}
function showTip(i) { byId("donutTip").innerText = repSlices[i]; }

function showIncomeReport(items) {
  var salaryDate = keyDate(repKey, salaryDay);
  var html = '<div class="row"><span class="ic">💰</span><div class="info"><b>Monthly Salary</b><small>' +
             fmt(salaryDate) + '</small></div><span class="amt plus-amt">+' + money(income) + "</span></div>";
  byId("incSalary").innerText = money(income);
  byId("incTotal").innerText = money(income);
  byId("incList").innerHTML = html;
}

byId("repExp").onclick = function () { repTab = "expense"; showReport(); };
byId("repInc").onclick = function () { repTab = "income"; showReport(); };
byId("prevM").onclick = function () { repKey--; showReport(); };
byId("nextM").onclick = function () { if (repKey < thisMonth) { repKey++; showReport(); } };

initialize();