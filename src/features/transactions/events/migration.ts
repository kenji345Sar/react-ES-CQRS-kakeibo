import type { DomainEvent } from "./types";

const OLD_KEY = "transactions";
const NEW_KEY = "transaction_events";

type OldTransaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  memo?: string;
};

/**
 * 旧形式（transactions）のデータを検出し、
 * Event Sourcing 形式（transaction_events）に移行する。
 *
 * - 既にイベントが存在する場合はスキップ
 * - 移行成功後、旧キーは _backup 付きで残す
 *
 * @returns 移行したイベント数（0 = 移行不要 or 旧データなし）
 */
export function migrateFromOldFormat(): number {
  // 既にイベントが存在する場合は移行不要
  const existingEvents = localStorage.getItem(NEW_KEY);
  if (existingEvents) {
    try {
      const parsed = JSON.parse(existingEvents);
      if (Array.isArray(parsed) && parsed.length > 0) return 0;
    } catch {
      // 破損の場合は移行を試みる
    }
  }

  // 旧データを読み込む
  const raw = localStorage.getItem(OLD_KEY);
  if (!raw) return 0;

  let oldData: OldTransaction[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return 0;
    oldData = parsed;
  } catch {
    return 0;
  }

  // 旧データ → TransactionCreated イベントに変換
  const now = Date.now();
  const events: DomainEvent[] = oldData.map((tx, i) => ({
    eventId: `migrated-${tx.id}`,
    timestamp: now + i, // 順序を保証
    type: "TransactionCreated" as const,
    payload: {
      id: tx.id,
      date: tx.date,
      transactionType: tx.type,
      amount: tx.amount,
      memo: tx.memo,
    },
  }));

  // 新形式で保存
  localStorage.setItem(NEW_KEY, JSON.stringify(events));

  // 旧データをバックアップに移動
  localStorage.setItem(`${OLD_KEY}_backup`, raw);
  localStorage.removeItem(OLD_KEY);

  return events.length;
}
