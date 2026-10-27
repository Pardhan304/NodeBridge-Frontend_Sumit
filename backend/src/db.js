const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ deliveries: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let writeChain = Promise.resolve();
function withDb(mutator) {
  writeChain = writeChain.then(async () => {
    const data = readDb();
    const result = await mutator(data);
    writeDb(data);
    return result;
  });
  return writeChain;
}

function recordDeliveryAttempt(entry) {
  return withDb((data) => {
    data.deliveries.push(entry);
    return entry;
  });
}

function getHistory(voucherId) {
  const data = readDb();
  if (voucherId === undefined) return data.deliveries;
  return data.deliveries.filter((d) => String(d.voucherId) === String(voucherId));
}

function readDemoJobs() {
  const demoPath = path.join(__dirname, "..", "data", "demo-jobs.json");
  if (!fs.existsSync(demoPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(demoPath, "utf-8"));
  return Array.isArray(parsed) ? parsed : [];
}

function listJobs() {
  const data = readDb();
  const saved = Array.isArray(data.jobs) ? data.jobs : [];
  const byId = new Map(saved.map((job) => [String(job.jobId), job]));
  for (const job of readDemoJobs()) {
    const id = String(job.jobId);
    if (!byId.has(id)) byId.set(id, job);
  }
  return [...byId.values()];
}

function getJob(jobId) {
  return listJobs().find((job) => String(job.jobId) === String(jobId)) || null;
}

function saveJob(job) {
  return withDb((data) => {
    if (!Array.isArray(data.jobs)) data.jobs = [];
    const index = data.jobs.findIndex((item) => String(item.jobId) === String(job.jobId));
    if (index >= 0) data.jobs[index] = job;
    else data.jobs.push(job);
    return job;
  });
}

module.exports = { recordDeliveryAttempt, getHistory, listJobs, getJob, saveJob };
