import type { DomainEvent } from "../events/types";
import type { Transaction, FilterType } from "../types";

/** イベントログから取引の Map を構築する（内部ヘルパー） */
export function buildTransactionMap(
  events: ReadonlyArray<DomainEvent>
): Map<string, Transaction> {
  const map = new Map<string, Transaction>();

  for (const event of events) {
    switch (event.type) {
      case "TransactionCreated":
        map.set(event.payload.id, {
          id: event.payload.id,
          date: event.payload.date,
          type: event.payload.transactionType,
          amount: event.payload.amount,
          memo: event.payload.memo,
        });
        break;
      case "TransactionUpdated":
        map.set(event.payload.id, {
          id: event.payload.id,
          date: event.payload.date,
          type: event.payload.transactionType,
          amount: event.payload.amount,
          memo: event.payload.memo,
        });
        break;
      case "TransactionDeleted":
        map.delete(event.payload.id);
        break;
    }
  }

  return map;
}

/** Query: 取引一覧を取得（フィルタ済み・日付降順） */
export function queryTransactions(
  events: ReadonlyArray<DomainEvent>,
  filter: FilterType = "all"
): Transaction[] {
  const map = buildTransactionMap(events);
  let list = Array.from(map.values());

  if (filter !== "all") {
    list = list.filter((tx) => tx.type === filter);
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/** Query: サマリ（入金合計・出金合計・差額）を取得 */
export function querySummary(events: ReadonlyArray<DomainEvent>): {
  income: number;
  expense: number;
  balance: number;
} {
  const map = buildTransactionMap(events);
  let income = 0;
  let expense = 0;

  for (const tx of map.values()) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }

  return { income, expense, balance: income - expense };
}
