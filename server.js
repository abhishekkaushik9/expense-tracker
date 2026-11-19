// ================= IMPORTS =================
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/expense_tracker";

// ================= MIDDLEWARE =================
app.use(cors());           // allows your page (Live Server) to call this API
app.use(express.json());   // reads JSON sent from the page

// One transaction
const expenseSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, maxlength: 100 },
    amount:   { type: Number, required: true, min: 1 },
    category: { type: String, required: true, trim: true },
    date:     { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    type:     { type: String, enum: ["expense", "income"], default: "expense" }
  },
  { timestamps: true }
);
const Expense = mongoose.model("Expense", expenseSchema);

// Salary settings (only one document is used)
const settingSchema = new mongoose.Schema({
  income:    { type: Number, default: 50000, min: 1 },
  salaryDay: { type: Number, default: 1, min: 1, max: 30 }
});
const Setting = mongoose.model("Setting", settingSchema);

// ================= HELPERS =================
// wraps async routes so errors go to the error handler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ================= ROUTES =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "income.html")));
app.get("/income.html", (req, res) => res.sendFile(path.join(__dirname, "income.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(__dirname, "script.js")));
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? mongoose.connection.name : "disconnected"
  });
});

// ----- Expenses -----
// GET all (optional ?month=2026-11 to get only that calendar month)
app.get("/api/expenses", wrap(async (req, res) => {
  const filter = {};
  if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
    filter.date = { $regex: "^" + req.query.month };
  }
  res.json(await Expense.find(filter).sort({ date: -1, createdAt: -1 }));
}));

// ADD one
app.post("/api/expenses", wrap(async (req, res) => {
  const { name, amount, category, date, type } = req.body;
  const saved = await Expense.create({ name, amount: Number(amount), category, date, type });
  res.status(201).json(saved);
}));

// DELETE one
app.delete("/api/expenses/:id", wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Bad id" });
  const gone = await Expense.findByIdAndDelete(req.params.id);
  if (!gone) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}));

// DELETE all
app.delete("/api/expenses", wrap(async (req, res) => {
  await Expense.deleteMany({});
  res.json({ ok: true });
}));

// ----- Settings -----
app.get("/api/settings", wrap(async (req, res) => {
  let s = await Setting.findOne();
  if (!s) s = await Setting.create({});
  res.json(s);
}));

app.put("/api/settings", wrap(async (req, res) => {
  let s = (await Setting.findOne()) || new Setting();
  s.income = Number(req.body.income);
  s.salaryDay = Number(req.body.salaryDay);
  await s.save();
  res.json(s);
}));

// ================= ERRORS =================
app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
  res.status(500).json({ error: "Server error" });
});

async function startServer() {
  app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));
  await connectDatabase();
}

async function connectDatabase() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected to database:", mongoose.connection.name);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    setTimeout(connectDatabase, 5000);
  }
}

mongoose.connection.on("disconnected", () => {
  if (!mongoose.connection.readyState) {
    setTimeout(connectDatabase, 5000);
  }
});

startServer();