"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, ESCROW_ABI } from "@/lib/contract";
import { cleanSpec, hashSpec } from "@/lib/spec";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function ListVoucherForm({ onListed }) {
  const { isConnected } = useAccount();
  const [jobId, setJobId] = useState("");
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [expected, setExpected] = useState("");
  const [price, setPrice] = useState("");
  const [saveError, setSaveError] = useState(null);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const notified = useRef(null);
  const pendingJob = useRef(null);

  const specReady = title.trim() && task.trim() && expected.trim();
  const preview = useMemo(() => {
    if (!specReady) return "";
    return hashSpec({ title, task, expected });
  }, [specReady, title, task, expected]);

  useEffect(() => {
    if (!isSuccess || !hash || notified.current === hash) return;
    notified.current = hash;

    const job = pendingJob.current;
    pendingJob.current = null;

    (async () => {
      if (job) {
        try {
          const res = await fetch(`${API_URL}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(job),
          });
          const data = await res.json();
          if (!res.ok) {
            setSaveError(data.error || "The job was listed on-chain, but the spec was not saved.");
          }
        } catch (err) {
          setSaveError(err.message);
        }
      }
      onListed?.();
      setJobId("");
      setTitle("");
      setTask("");
      setExpected("");
      setPrice("");
    })();
  }, [isSuccess, hash, onListed]);

  const submit = (e) => {
    e.preventDefault();
    if (!jobId || !price || !specReady) return;
    setSaveError(null);
    const spec = cleanSpec({ title, task, expected });
    pendingJob.current = { jobId, ...spec };
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "listVoucher",
      args: [BigInt(jobId), parseEther(price), hashSpec(spec)],
    });
  };

  return (
    <form onSubmit={submit} className="panel offer-form">
      <h2 className="panel__title">Job spec</h2>
      <p className="panel__lede">
        The title, task, and expected output are hashed with keccak256. Only that hash is stored on-chain.
      </p>

      <label className="field">
        <span className="field__label">Title</span>
        <input
          type="text"
          placeholder="Image embedding"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field__input"
        />
      </label>

      <label className="field">
        <span className="field__label">Task</span>
        <textarea
          placeholder="Describe the compute task a provider will run."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="field__input"
        />
      </label>

      <label className="field">
        <span className="field__label">Expected output</span>
        <input
          type="text"
          placeholder="The exact result the verifier must see"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          className="field__input field__input--mono"
        />
      </label>

      <div className="offer-form__split">
        <label className="field">
          <span className="field__label">Job ID</span>
          <input
            type="number"
            min="0"
            placeholder="3"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="field__input"
          />
        </label>

        <label className="field">
          <span className="field__label">Price</span>
          <div className="field__suffix-wrap">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.05"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="field__input"
            />
            <span className="field__suffix">ETH</span>
          </div>
        </label>

        <button type="submit" disabled={!isConnected || !specReady || isPending || isConfirming} className="btn btn--primary">
          {isPending || isConfirming ? "Publishing…" : "Publish job"}
        </button>
      </div>

      {preview && (
        <p className="hash-preview">
          Spec hash <code>{preview}</code>
        </p>
      )}

      {!isConnected && <p className="form-note">Connect a wallet to publish.</p>}
      {error && <p className="form-error">{error.shortMessage || error.message}</p>}
      {saveError && <p className="form-error">{saveError}</p>}
      {isSuccess && !saveError && <p className="form-success">Job published. The spec hash is now on-chain.</p>}
    </form>
  );
}
