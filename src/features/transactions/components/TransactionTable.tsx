import { useMemo, useState } from "react";
import type { Transaction, FilterType } from "../types";

type Props = {
  transactions: Transaction[];
  /** Query 側（Projection）で計算済みのサマリ */
  summary: { income: number; expense: number; balance: number };
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
};

/** 金額を3桁区切りで表示 */
function formatAmount(n: number): string {
  return n.toLocaleString("ja-JP");
}

export default function TransactionTable({
  transactions,
  summary,
  onEdit,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<FilterType>("all");

  // フィルタ適用 → 日付降順ソート
  const filtered = useMemo(() => {
    const list =
      filter === "all"
        ? transactions
        : transactions.filter((tx) => tx.type === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filter]);

  function handleDelete(id: string) {
    if (window.confirm("この取引を削除しますか？")) {
      onDelete(id);
    }
  }

  return (
    <div className="tx-table-wrapper">
      {/* サマリ（Query Projection から取得） */}
      <div className="summary">
        <span className="summary-item income">
          入金合計: ¥{formatAmount(summary.income)}
        </span>
        <span className="summary-item expense">
          出金合計: ¥{formatAmount(summary.expense)}
        </span>
        <span className="summary-item balance">
          差額: ¥{formatAmount(summary.balance)}
        </span>
      </div>

      {/* フィルタ */}
      <div className="filter-row">
        <label>
          種別フィルタ:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
          >
            <option value="all">すべて</option>
            <option value="income">入金</option>
            <option value="expense">出金</option>
          </select>
        </label>
      </div>

      {/* テーブル */}
      <table className="tx-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>種別</th>
            <th className="text-right">金額</th>
            <th>メモ</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="no-data">
                データがありません
              </td>
            </tr>
          ) : (
            filtered.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>
                  <span
                    className={
                      tx.type === "income" ? "badge-income" : "badge-expense"
                    }
                  >
                    {tx.type === "income" ? "入金" : "出金"}
                  </span>
                </td>
                <td className="text-right">¥{formatAmount(tx.amount)}</td>
                <td>{tx.memo ?? ""}</td>
                <td>
                  <button className="btn-sm" onClick={() => onEdit(tx)}>
                    編集
                  </button>
                  <button
                    className="btn-sm btn-danger"
                    onClick={() => handleDelete(tx.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
