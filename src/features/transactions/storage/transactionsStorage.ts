import type { Transaction } from "../types";

const STORAGE_KEY = "transactions";

/** localStorage から取引一覧を読み込む。破損時は空配列を返す */
export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** localStorage に取引一覧を保存する */
export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/** 初回起動時用のサンプルデータ（localStorage が空の場合のみ使用） */
export function getInitialData(): Transaction[] {
  const existing = loadTransactions();
  if (existing.length > 0) return existing;

  const samples: Transaction[] = [
    {
      id: "1",
      date: "2026-02-01",
      type: "income",
      amount: 250000,
      memo: "給与",
    },
    {
      id: "2",
      date: "2026-02-03",
      type: "expense",
      amount: 80000,
      memo: "家賃",
    },
    {
      id: "3",
      date: "2026-02-05",
      type: "expense",
      amount: 3500,
      memo: "ランチ",
    },
  ];
  saveTransactions(samples);
  return samples;
}
