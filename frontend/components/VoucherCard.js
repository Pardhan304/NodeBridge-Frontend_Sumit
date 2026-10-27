"use client";

import { useEffect, useRef } from "react";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, ESCROW_ABI } from "@/lib/contract";

const STATUS_META = {
  Listed: { label: "Open", tone: "good" },
  AwaitingDelivery: { label: "In escrow", tone: "warn" },
  Delivered: { label: "Released", tone: "info" },
  Cancelled: { label: "Cancelled", tone: "muted" },
  Refunded: { label: "Refunded", tone: "critical" },
};

function short(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}···${addr.slice(-4)}`;
}

function shortHash(hash) {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}···${hash.slice(-6)}`;
}

export function VoucherCard({ voucher, job, onChanged }) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const notified = useRef(null);

  useEffect(() => {
    if (isSuccess && hash && notified.current !== hash) {
      notified.current = hash;
      onChanged?.();
    }
  }, [isSuccess, hash, onChanged]);

  const isOwnListing = address && voucher.seller?.toLowerCase() === address.toLowerCase();
  const canBuy = voucher.stateLabel === "Listed" && isConnected && !isOwnListing;

  const buy = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "purchaseVoucher",
      args: [voucher.id],
      value: voucher.price,
    });
  };

  const meta = STATUS_META[voucher.stateLabel] || { label: voucher.stateLabel, tone: "muted" };

  return (
    <article className={`voucher-card tone-${meta.tone}`}>
      <div className="voucher-card__stripe" aria-hidden="true" />
      <div className="voucher-card__body">
        <div className="voucher-card__head">
          <span className="voucher-card__id">Job {voucher.id.toString()}</span>
          <span className={`status-pill tone-${meta.tone}`}>{meta.label}</span>
        </div>

        <h2 className="voucher-card__title">{job?.title || "Compute job"}</h2>
        {job?.task && <p className="voucher-card__task">{job.task}</p>}

        <p className="voucher-card__price">
          {formatEther(voucher.price)} <span className="voucher-card__unit">ETH</span>
        </p>

        <p className="hash-chip" title={voucher.specHash}>
          {shortHash(voucher.specHash)}
        </p>

        <dl className="voucher-card__meta">
          <div>
            <dt>Provider</dt>
            <dd>{short(voucher.seller)}</dd>
          </div>
          {voucher.buyer && voucher.buyer !== "0x0000000000000000000000000000000000000000" && (
            <div>
              <dt>Requester</dt>
              <dd>{short(voucher.buyer)}</dd>
            </div>
          )}
        </dl>

        <div className="voucher-card__action">
          {voucher.stateLabel === "Listed" && (
            <button
              onClick={buy}
              disabled={!canBuy || isPending || isConfirming}
              className="btn btn--primary btn--block"
            >
              {isPending || isConfirming ? "Confirming…" : isOwnListing ? "Your job" : "Fund job"}
            </button>
          )}
          {voucher.stateLabel === "AwaitingDelivery" && <p className="voucher-card__note">Waiting for a verified result</p>}
          {voucher.stateLabel === "Delivered" && <p className="voucher-card__note">Released to the provider</p>}
          {error && <p className="form-error">{error.shortMessage || error.message}</p>}
        </div>
      </div>
    </article>
  );
}
