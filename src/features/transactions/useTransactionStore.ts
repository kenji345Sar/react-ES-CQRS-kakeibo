import { useState, useCallback, useEffect, useRef } from "react";
import { EventStore } from "./events/eventStore";
import { migrateFromOldFormat } from "./events/migration";
import type { Command, CommandResult } from "./commands/types";
import { handleCommand } from "./commands/handlers";
import {
  queryTransactions,
  querySummary,
} from "./queries/projections";
import type { Transaction, FilterType } from "./types";

/** 初回のみサンプルイベントを投入する */
function seedIfEmpty(store: EventStore): void {
  if (store.getAll().length > 0) return;

  const now = Date.now();
  const samples = [
    {
      id: "1",
      date: "2026-02-01",
      transactionType: "income" as const,
      amount: 250000,
      memo: "給与",
    },
    {
      id: "2",
      date: "2026-02-03",
      transactionType: "expense" as const,
      amount: 80000,
      memo: "家賃",
    },
    {
      id: "3",
      date: "2026-02-05",
      transactionType: "expense" as const,
      amount: 3500,
      memo: "ランチ",
    },
  ];

  for (const s of samples) {
    store.append({
      eventId: `seed-${s.id}`,
      timestamp: now,
      type: "TransactionCreated",
      payload: s,
    });
  }
}

/**
 * Event Sourcing + CQRS のフック
 *
 * - dispatch(): コマンドを発行（Write 側）
 * - transactions / summary: プロジェクションによる読み取りモデル（Read 側）
 */
export function useTransactionStore() {
  const storeRef = useRef<EventStore | null>(null);
  if (!storeRef.current) {
    // 旧形式データがあれば自動移行（transactions → transaction_events）
    const migrated = migrateFromOldFormat();
    if (migrated > 0) {
      console.log(`[migration] 旧データ ${migrated} 件をイベント形式に移行しました`);
    }
    storeRef.current = new EventStore();
    seedIfEmpty(storeRef.current);
  }
  const store = storeRef.current;

  // イベントが変わるたびにインクリメントし、再描画を起こすカウンタ
  const [, setVersion] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsub;
  }, [store]);

  /** コマンドを発行する（Write 側） */
  const dispatch = useCallback(
    (command: Command): CommandResult => {
      return handleCommand(store, command);
    },
    [store]
  );

  /** Query: フィルタ付き取引一覧 */
  const getTransactions = useCallback(
    (filter: FilterType = "all"): Transaction[] => {
      return queryTransactions(store.getAll(), filter);
    },
    [store]
  );

  /** Query: サマリ */
  const summary = querySummary(store.getAll());

  return { dispatch, getTransactions, summary };
}
