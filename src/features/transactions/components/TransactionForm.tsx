import { useState, useEffect } from "react";
import type { Transaction } from "../types";

type Props = {
  /** 編集対象（null なら新規登録モード） */
  editTarget: Transaction | null;
  onSubmit: (tx: Omit<Transaction, "id">) => void;
  onCancelEdit: () => void;
};

/** 今日の日付を YYYY-MM-DD で返す */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type Errors = {
  date?: string;
  type?: string;
  amount?: string;
  memo?: string;
};

export default function TransactionForm({
  editTarget,
  onSubmit,
  onCancelEdit,
}: Props) {
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  // 編集対象が変わったらフォームに値をセット
  useEffect(() => {
    if (editTarget) {
      setDate(editTarget.date);
      setType(editTarget.type);
      setAmount(String(editTarget.amount));
      setMemo(editTarget.memo ?? "");
      setErrors({});
    }
  }, [editTarget]);

  const isEditing = editTarget !== null;

  function validate(): Errors {
    const e: Errors = {};
    if (!date) e.date = "日付は必須です";
    if (!type) e.type = "種別は必須です";

    const num = Number(amount);
    if (!amount) {
      e.amount = "金額は必須です";
    } else if (!Number.isInteger(num) || num <= 0) {
      e.amount = "金額は1以上の整数を入力してください";
    }

    if (memo.length > 200) {
      e.memo = "メモは200文字以内で入力してください";
    }
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({ date, type, amount: Number(amount), memo: memo || undefined });
    resetForm();
  }

  function resetForm() {
    setDate(todayStr());
    setType("expense");
    setAmount("");
    setMemo("");
    setErrors({});
  }

  function handleCancel() {
    resetForm();
    onCancelEdit();
  }

  return (
    <form onSubmit={handleSubmit} className="tx-form">
      <h2>{isEditing ? "取引を編集" : "取引を登録"}</h2>

      <div className="form-row">
        <label>
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {errors.date && <span className="error">{errors.date}</span>}
      </div>

      <div className="form-row">
        <label>
          種別
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as "income" | "expense")
            }
          >
            <option value="income">入金</option>
            <option value="expense">出金</option>
          </select>
        </label>
        {errors.type && <span className="error">{errors.type}</span>}
      </div>

      <div className="form-row">
        <label>
          金額
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="例: 10000"
          />
        </label>
        {errors.amount && <span className="error">{errors.amount}</span>}
      </div>

      <div className="form-row">
        <label>
          メモ
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={200}
            placeholder="任意（200文字以内）"
          />
        </label>
        {errors.memo && <span className="error">{errors.memo}</span>}
      </div>

      <div className="form-actions">
        {isEditing ? (
          <>
            <button type="submit">更新</button>
            <button type="button" onClick={handleCancel}>
              キャンセル
            </button>
          </>
        ) : (
          <button type="submit">登録</button>
        )}
      </div>
    </form>
  );
}
