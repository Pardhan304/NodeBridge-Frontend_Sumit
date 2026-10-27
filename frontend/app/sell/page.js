"use client";

import { ListVoucherForm } from "@/components/ListVoucherForm";
import { useJobCatalog, useVouchers } from "@/lib/useVouchers";

export default function SellPage() {
  const { refresh } = useVouchers();
  const { refreshJobs } = useJobCatalog();

  return (
    <>
      <div className="page-head">
        <p className="page-head__eyebrow">Offer</p>
        <h1 className="page-head__title">Publish a compute job</h1>
        <p className="page-head__lede">
          Write the task in plain language. NodeBridge commits a keccak256 hash of the spec, then a requester can fund it.
        </p>
      </div>

      <ListVoucherForm
        onListed={() => {
          refresh();
          refreshJobs();
        }}
      />
    </>
  );
}
