require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const studentRoutes = require("./routes/students");
const attendanceRoutes = require("./routes/attendance");
const gradeRoutes = require("./routes/grades");
const feeRoutes = require("./routes/fees");
const staffRoutes = require("./routes/staff");
const organizationRoutes = require("./routes/organizations");
const platformRoutes = require("./routes/platform");
const billingRoutes = require("./routes/billing");
const reportCardRoutes = require("./routes/reportcard");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));

app.use("/billing/webhook", express.raw({ type: "application/json" }));
app.use("/billing", billingRoutes);

app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/students", reportCardRoutes);
app.use("/students", studentRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/grades", gradeRoutes);
app.use("/fees", feeRoutes);
app.use("/staff", staffRoutes);
app.use("/organizations", organizationRoutes);
app.use("/platform", platformRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

module.exports = app;
