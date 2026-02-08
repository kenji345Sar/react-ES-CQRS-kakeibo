import { useState, useCallback } from "react";
import type { Transaction } from "./types";
import {
  getInitialData,
  saveTransactions,
} from "./storage/transactionsStorage";
import TransactionForm from "./components/TransactionForm";
import TransactionTable from "./components/TransactionTable";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(getInitialData);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  /** 状態を更新すると同時に localStorage にも保存する */
  function updateTransactions(next: Transaction[]) {
    setTransactions(next);
    saveTransactions(next);
  }

  /** 新規登録 or 更新 */
  const handleSubmit = useCallback(
    (data: Omit<Transaction, "id">) => {
      if (editTarget) {
        // 更新
        const updated = transactions.map((tx) =>
          tx.id === editTarget.id ? { ...tx, ...data } : tx
        );
        updateTransactions(updated);
        setEditTarget(null);
      } else {
        // 新規登録
        const newTx: Transaction = {
          ...data,
          id: Date.now().toString(),
        };
        updateTransactions([...transactions, newTx]);
      }
    },
    [editTarget, transactions]
  );

  /** 編集開始 */
  const handleEdit = useCallback((tx: Transaction) => {
    setEditTarget(tx);
  }, []);

  /** 編集キャンセル */
  const handleCancelEdit = useCallback(() => {
    setEditTarget(null);
  }, []);

  /** 削除 */
  const handleDelete = useCallback(
    (id: string) => {
      const next = transactions.filter((tx) => tx.id !== id);
      updateTransactions(next);
      // 編集中の項目が削除されたら編集モードを解除
      if (editTarget?.id === id) {
        setEditTarget(null);
      }
    },
    [transactions, editTarget]
  );

  return (
    <div className="transactions-page">
      <h1>収支管理</h1>
      <TransactionForm
        editTarget={editTarget}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
      />
      <TransactionTable
        transactions={transactions}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
