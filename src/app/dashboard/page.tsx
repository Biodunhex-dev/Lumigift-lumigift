"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { GiftCard } from "@/components/gift/GiftCard";
import styles from "./page.module.css";
import type { ApiResponse } from "@/types";
import type { GiftPageOffset } from "@/server/services/gift.service";

const DEFAULT_LIMIT = 10;

async function fetchGifts(page: number, limit: number, status?: string): Promise<GiftPageOffset> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status && status !== "all") {
    query.set("status", status);
  }
  const res = await fetch(`/api/v1/gifts?${query.toString()}`);
  const json: ApiResponse<GiftPageOffset> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentStatus = searchParams.get("status") || "all";
  const [page, setPage] = useState(1);

  // Reset page when status changes
  useEffect(() => {
    setPage(1);
  }, [currentStatus]);

  const { data, status } = useQuery({
    queryKey: ["gifts", page, currentStatus],
    queryFn: () => fetchGifts(page, DEFAULT_LIMIT, currentStatus),
  });

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newStatus === "all") {
      params.delete("status");
    } else {
      params.set("status", newStatus);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  if (status === "pending") {
    return (
      <div className={styles.page}>
        <div className="container">
          <p>Loading gifts…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.page}>
        <div className="container">
          <p>Failed to load gifts. Please try again.</p>
        </div>
      </div>
    );
  }

  const { data: gifts, total, totalPages, counts } = data!;

  const tabs = [
    { id: "all", label: "All", count: counts.all },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "claimed", label: "Claimed", count: counts.claimed },
    { id: "expired", label: "Expired", count: counts.expired },
  ];

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Your Gifts</h1>
          <Link href="/send" className="btn btn--primary btn--sm">
            Send Gift
          </Link>
        </div>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${currentStatus === tab.id ? styles.tabActive : ""}`}
              onClick={() => handleStatusChange(tab.id)}
            >
              {tab.label}
              <span className={styles.badge}>{tab.count}</span>
            </button>
          ))}
        </div>

        {gifts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIconWrapper}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="8" width="18" height="4" rx="1" />
                <path d="M12 8v13" />
                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No gifts yet</h2>
            <p className={styles.emptyDescription}>
              Brighten someone&apos;s day by sending a surprise cash gift!
            </p>
            <Link href="/send" className="btn btn--primary">
              Send your first gift!
            </Link>
          </div>
        ) : (
          <>
            <p className={styles.count}>
              Showing {(page - 1) * DEFAULT_LIMIT + 1}–{Math.min(page * DEFAULT_LIMIT, total)} of {total} gifts
            </p>
            <div className={styles.grid}>
              {gifts.map((gift) => (
                <GiftCard key={gift.id} gift={gift} perspective="sender" />
              ))}
            </div>
            <div className={styles.loadMore}>
              <button
                className="btn btn--secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                className="btn btn--secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
