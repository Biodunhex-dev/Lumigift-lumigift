"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GiftCard } from "@/components/gift/GiftCard";
import styles from "./page.module.css";
import type { ApiResponse } from "@/types";
import type { GiftPageOffset } from "@/server/services/gift.service";

const DEFAULT_LIMIT = 10;

async function fetchGifts(page: number, limit: number): Promise<GiftPageOffset> {
  const res = await fetch(`/api/v1/gifts?page=${page}&limit=${limit}`);
  const json: ApiResponse<GiftPageOffset> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function DashboardPage() {
  const [page, setPage] = useState(1);

  const { data, status } = useQuery({
    queryKey: ["gifts", page],
    queryFn: () => fetchGifts(page, DEFAULT_LIMIT),
  });

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

  const { data: gifts, total, totalPages } = data!;

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Your Gifts</h1>

        {gifts.length === 0 ? (
          <div className={styles.empty}>
            <p>You haven&apos;t sent any gifts yet.</p>
            <a href="/send" className="btn btn--primary">
              Send your first gift
            </a>
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
