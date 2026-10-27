"use client";

import { useState, useMemo } from "react";
import { parseEther } from "viem";
import { VoucherCard } from "@/components/VoucherCard";
import { useJobCatalog, useVouchers } from "@/lib/useVouchers";
import { CONTRACT_ADDRESS } from "@/lib/contract";

const MOCK_JOBS = [
  {
    voucher: {
      id: "1",
      price: parseEther("0.05"),
      seller: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      stateLabel: "Listed",
    },
    job: {
      title: "Image embedding",
      task: "Embed a 224px image and return the first 8 floats.",
    },
    status: "Open",
  },
  {
    voucher: {
      id: "2",
      price: parseEther("0.10"),
      seller: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      stateLabel: "AwaitingDelivery",
    },
    job: {
      title: "Log reduce",
      task: "Count error lines in the node log and return the integer.",
    },
    status: "In Progress",
  },
  {
    voucher: {
      id: "3",
      price: parseEther("0.25"),
      seller: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      stateLabel: "Delivered",
    },
    job: {
      title: "Matrix multiplication",
      task: "Compute 1024x1024 float matrix multiplication.",
    },
    status: "Completed",
  },
  {
    voucher: {
      id: "4",
      price: parseEther("0.15"),
      seller: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      stateLabel: "Listed",
    },
    job: {
      title: "LLM Tokenizer benchmark",
      task: "Tokenize 100k sentences and return throughput tokens/sec.",
    },
    status: "Open",
  },
];

const FILTER_OPTIONS = ["All", "Open", "Completed"];

export default function MarketplacePage() {
  const { vouchers, initialLoading, refreshing, error, refresh } = useVouchers();
  const { jobs, refreshJobs } = useJobCatalog();
  const [selectedFilter, setSelectedFilter] = useState("All");

  const reload = () => {
    refresh();
    refreshJobs();
  };

  const allJobs = useMemo(() => {
    if (vouchers && vouchers.length > 0) {
      return vouchers.map((v) => ({
        voucher: v,
        job: jobs[v.id.toString()] || { title: `Compute Job #${v.id}` },
        status:
          v.stateLabel === "Listed"
            ? "Open"
            : v.stateLabel === "Delivered"
            ? "Completed"
            : "In Progress",
      }));
    }
    return MOCK_JOBS;
  }, [vouchers, jobs]);

  const filteredJobs = useMemo(() => {
    if (selectedFilter === "All") return allJobs;
    return allJobs.filter((item) => item.status === selectedFilter);
  }, [allJobs, selectedFilter]);

  return (
    <>
      <div className="page-head">
        <p className="page-head__eyebrow">NodeBridge</p>
        <h1 className="page-head__title">Open compute jobs</h1>
        <p className="page-head__lede">
          Fund a provider. Escrow holds the ETH until an admin accepts a result that matches the committed spec.
        </p>
      </div>

      <div className="section-head" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {FILTER_OPTIONS.map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`btn ${isActive ? "btn--primary" : ""}`}
                style={
                  !isActive
                    ? {
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--ink-soft)",
                      }
                    : {}
                }
              >
                {filter}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <p className="section-head__count">
            {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"}
            {refreshing ? " · syncing" : ""}
          </p>
          <button onClick={reload} className="link-btn">
            Refresh
          </button>
        </div>
      </div>

      {initialLoading && vouchers.length > 0 && (
        <div className="voucher-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="voucher-card voucher-card--skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {filteredJobs.length === 0 ? (
        <p className="empty-state">No compute jobs found for status "{selectedFilter}".</p>
      ) : (
        <div className="voucher-grid">
          {filteredJobs.map(({ voucher, job }) => (
            <VoucherCard
              key={voucher.id.toString()}
              voucher={voucher}
              job={job}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </>
  );
}
