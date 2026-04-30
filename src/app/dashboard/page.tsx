"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { GiftCard } from "@/components/gift/GiftCard";
import styles from "./page.module.css";
import type { ApiResponse } from "@/types";
import type { GiftPage } from "@/server/services/gift.service";

async function fetchGifts({ pageParam }: { pageParam: string | null }): Promise<GiftPage> {
  const url = pageParam
    ? `/api/v1/gifts?cursor=${pageParam}`
    : "/api/v1/gifts";
  const res = await fetch(url);
  const json: ApiResponse<GiftPage> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function DashboardPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ["gifts"],
    queryFn: fetchGifts,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const allGifts = data?.pages.flatMap((p) => p.gifts) ?? [];
  const total = data?.pages[0]?.total ?? 0;

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

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.title}>Your Gifts</h1>

        {allGifts.length === 0 ? (
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
              Showing {allGifts.length} of {total} gifts
            </p>
            <div className={styles.grid}>
              {allGifts.map((gift) => (
                <GiftCard key={gift.id} gift={gift} perspective="sender" />
              ))}
            </div>
            {hasNextPage && (
              <div className={styles.loadMore}>
                <button
                  className="btn btn--secondary"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-busy={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
