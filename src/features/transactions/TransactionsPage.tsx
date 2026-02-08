import { useState, useCallback } from "react";
import type { Transaction } from "./types";
import { useTransactionStore } from "./useTransactionStore";
import TransactionForm from "./components/TransactionForm";
import TransactionTable from "./components/TransactionTable";

export default function TransactionsPage() {
  const { dispatch, getTransactions, summary } = useTransactionStore();
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  const transactions = getTransactions();

  /** 新規登録 or 更新（Command を発行） */
  const handleSubmit = useCallback(
    (data: Omit<Transaction, "id">) => {
      if (editTarget) {
        dispatch({
          type: "UpdateTransaction",
          payload: {
            id: editTarget.id,
            date: data.date,
            transactionType: data.type,
            amount: data.amount,
            memo: data.memo,
          },
        });
        setEditTarget(null);
      } else {
        dispatch({
          type: "CreateTransaction",
          payload: {
            date: data.date,
            transactionType: data.type,
            amount: data.amount,
            memo: data.memo,
          },
        });
      }
    },
    [editTarget, dispatch]
  );

  /** 編集開始 */
  const handleEdit = useCallback((tx: Transaction) => {
    setEditTarget(tx);
  }, []);

  /** 編集キャンセル */
  const handleCancelEdit = useCallback(() => {
    setEditTarget(null);
  }, []);

  /** 削除（Command を発行） */
  const handleDelete = useCallback(
    (id: string) => {
      dispatch({
        type: "DeleteTransaction",
        payload: { id },
      });
      if (editTarget?.id === id) {
        setEditTarget(null);
      }
    },
    [dispatch, editTarget]
  );

  return (
    <div className="transactions-page">
      <h1>収支管理 <small>(ES/CQRS)</small></h1>
      <TransactionForm
        editTarget={editTarget}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
      />
      <TransactionTable
        transactions={transactions}
        summary={summary}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
