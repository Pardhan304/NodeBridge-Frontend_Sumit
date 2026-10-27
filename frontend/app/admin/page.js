"use client";

import { AdminPanel } from "@/components/AdminPanel";
import { useJobCatalog, useVouchers } from "@/lib/useVouchers";

export default function AdminPage() {
  const { vouchers, refresh } = useVouchers();
  const { jobs, refreshJobs } = useJobCatalog();

  return (
    <>
      <div className="page-head">
        <p className="page-head__eyebrow">Verify</p>
        <h1 className="page-head__title">Accept a result</h1>
        <p className="page-head__lede">
          The Rust verifier recomputes the spec hash and the result hash. Funds move only when both checks pass.
        </p>
      </div>

      <AdminPanel
        vouchers={vouchers}
        jobs={jobs}
        onDone={() => {
          refresh();
          refreshJobs();
        }}
      />
    </>
  );
}
