const express = require("express");
const { loadContractConfig } = require("../contract");
const { recordDeliveryAttempt, listJobs, getJob, saveJob } = require("../db");
const { runVerifier } = require("../verifier");

const router = express.Router();

const VALID_STATUSES = ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"];

function clean(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

router.post("/jobs", async (req, res) => {
  const { jobId, title, task, expected } = req.body || {};
  const spec = { title: clean(title), task: clean(task), expected: clean(expected) };

  if (jobId === undefined || jobId === null || jobId === "") {
    return res.status(400).json({ error: "jobId is required" });
  }
  if (!spec.title || !spec.task || !spec.expected) {
    return res.status(400).json({ error: "title, task, and expected are required" });
  }

  const job = { jobId: String(jobId), ...spec };
  await saveJob(job);
  return res.status(201).json({ job });
});

router.get("/jobs", (req, res) => {
  res.json({ jobs: listJobs() });
});

router.post("/verify-delivery", async (req, res) => {
  const { voucherId, status, delivered } = req.body || {};

  if (voucherId === undefined || voucherId === null) {
    return res.status(400).json({ error: "voucherId is required" });
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const baseEntry = {
    voucherId: String(voucherId),
    status,
    delivered: delivered ? clean(delivered) : null,
    receivedAt: new Date().toISOString(),
  };

  if (status !== "DELIVERED") {
    const entry = { ...baseEntry, action: "NO_ACTION", txHash: null };
    await recordDeliveryAttempt(entry);
    return res.status(200).json({ message: "Result recorded. Funds stay locked.", entry });
  }

  if (!clean(delivered)) {
    return res.status(400).json({ error: "delivered result is required" });
  }

  const job = getJob(voucherId);
  if (!job) {
    return res.status(404).json({ error: "Job spec is not registered with the backend" });
  }

  try {
    const verdict = await runVerifier({
      title: job.title,
      task: job.task,
      expected: job.expected,
      delivered: clean(delivered),
    });

    const { contract } = loadContractConfig();
    const voucher = await contract.getVoucher(voucherId);
    const onChainHash = String(voucher.specHash).toLowerCase();

    if (Number(voucher.state) !== 1) {
      const entry = {
        ...baseEntry,
        action: "SKIPPED",
        reason: `Job is not awaiting a result (state=${voucher.state})`,
        specHash: verdict.specHash,
        resultHash: verdict.resultHash,
        txHash: null,
      };
      await recordDeliveryAttempt(entry);
      return res.status(409).json({ error: "Job is not awaiting a result", entry });
    }

    if (!verdict.ok || onChainHash !== String(verdict.specHash).toLowerCase()) {
      const reason = !verdict.ok
        ? verdict.reason || "Result rejected"
        : "Spec hash does not match the on-chain commitment";
      const entry = {
        ...baseEntry,
        action: "RESULT_REJECTED",
        reason,
        specHash: verdict.specHash,
        resultHash: verdict.resultHash,
        txHash: null,
      };
      await recordDeliveryAttempt(entry);
      return res.status(409).json({ error: reason, entry });
    }

    const tx = await contract.releaseFunds(voucherId);
    const receipt = await tx.wait();

    const entry = {
      ...baseEntry,
      action: "FUNDS_RELEASED",
      specHash: verdict.specHash,
      resultHash: verdict.resultHash,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
    await recordDeliveryAttempt(entry);

    return res.status(200).json({ message: "Result accepted, funds released", entry });
  } catch (err) {
    const entry = {
      ...baseEntry,
      action: "ERROR",
      error: err.shortMessage || err.message,
      txHash: null,
    };
    await recordDeliveryAttempt(entry);
    return res.status(500).json({ error: entry.error, entry });
  }
});

router.get("/delivery-history/:voucherId?", async (req, res) => {
  const { getHistory } = require("../db");
  const history = getHistory(req.params.voucherId);
  res.json({ history });
});

module.exports = router;
