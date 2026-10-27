"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function AdminPanel({ vouchers, jobs, onDone }) {
  const [voucherId, setVoucherId] = useState("");
  const [delivered, setDelivered] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const awaiting = vouchers.filter((v) => v.stateLabel === "AwaitingDelivery");
  const selected = jobs?.[voucherId];

  const submit = async (status) => {
    if (!voucherId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/verify-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId,
          status,
          delivered: status === "DELIVERED" ? delivered : undefined,
        }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, data });
      if (res.ok && status === "DELIVERED") {
        setDelivered("");
        onDone?.();
      }
    } catch (err) {
      setResult({ ok: false, data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel offer-form">
      <h2 className="panel__title">Result check</h2>
      <p className="panel__lede">
        Admin decides. A matching result releases escrow to the provider. A
        mismatch or a rejection leaves the funds locked.
      </p>

      <label className="field">
        <span className="field__label">Job in escrow</span>
        <select
          value={voucherId}
          onChange={(e) => setVoucherId(e.target.value)}
          className="field__input"
        >
          <option value="">Select a job</option>
          {awaiting.map((v) => (
            <option key={v.id.toString()} value={v.id.toString()}>
              {jobs?.[v.id.toString()]?.title || "Compute job"} · Job{" "}
              {v.id.toString()}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <p className="form-note">
          Committed output for this job is known to the verifier. Paste the
          delivered result below.
        </p>
      )}

      <label className="field">
        <span className="field__label">Delivered result</span>
        <textarea
          placeholder="Paste the provider's output"
          value={delivered}
          onChange={(e) => setDelivered(e.target.value)}
          className="field__input field__input--mono"
        />
      </label>

      <div className="admin-row">
        <button
          onClick={() => submit("DELIVERED")}
          disabled={!voucherId || !delivered.trim() || loading}
          className="btn btn--success"
        >
          {loading ? "Checking…" : "Verify and release"}
        </button>

        <button
          onClick={() => submit("FAILED")}
          disabled={!voucherId || loading}
          className="btn btn--danger"
        >
          Reject result
        </button>
      </div>

      {awaiting.length === 0 && (
        <p className="form-note">No jobs are waiting on a result.</p>
      )}

      {result && (
        <pre
          className={`result-log ${result.ok ? "result-log--ok" : "result-log--error"}`}
        >
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
