import type { Command, CommandResult } from "./types";
import type { DomainEvent } from "../events/types";
import type { EventStore } from "../events/eventStore";
import { buildTransactionMap } from "../queries/projections";

/** コマンドを受け取り、バリデーション → イベント発行 を行う */
export function handleCommand(
  store: EventStore,
  command: Command
): CommandResult {
  switch (command.type) {
    case "CreateTransaction":
      return handleCreate(store, command.payload);
    case "UpdateTransaction":
      return handleUpdate(store, command.payload);
    case "DeleteTransaction":
      return handleDelete(store, command.payload);
  }
}

function handleCreate(
  store: EventStore,
  payload: Command extends { type: "CreateTransaction"; payload: infer P }
    ? P
    : never
): CommandResult {
  // バリデーション
  const err = validateFields(payload);
  if (err) return { ok: false, error: err };

  const event: DomainEvent = {
    eventId: crypto.randomUUID?.() ?? Date.now().toString(),
    timestamp: Date.now(),
    type: "TransactionCreated",
    payload: {
      id: Date.now().toString(),
      ...payload,
    },
  };
  store.append(event);
  return { ok: true };
}

function handleUpdate(
  store: EventStore,
  payload: {
    id: string;
    date: string;
    transactionType: "income" | "expense";
    amount: number;
    memo?: string;
  }
): CommandResult {
  const err = validateFields(payload);
  if (err) return { ok: false, error: err };

  // 存在チェック（現在のプロジェクションから）
  const map = buildTransactionMap(store.getAll());
  if (!map.has(payload.id)) {
    return { ok: false, error: "対象の取引が見つかりません" };
  }

  const event: DomainEvent = {
    eventId: crypto.randomUUID?.() ?? Date.now().toString(),
    timestamp: Date.now(),
    type: "TransactionUpdated",
    payload,
  };
  store.append(event);
  return { ok: true };
}

function handleDelete(
  store: EventStore,
  payload: { id: string }
): CommandResult {
  const map = buildTransactionMap(store.getAll());
  if (!map.has(payload.id)) {
    return { ok: false, error: "対象の取引が見つかりません" };
  }

  const event: DomainEvent = {
    eventId: crypto.randomUUID?.() ?? Date.now().toString(),
    timestamp: Date.now(),
    type: "TransactionDeleted",
    payload,
  };
  store.append(event);
  return { ok: true };
}

/** 共通バリデーション */
function validateFields(p: {
  date: string;
  transactionType: string;
  amount: number;
  memo?: string;
}): string | null {
  if (!p.date) return "日付は必須です";
  if (p.transactionType !== "income" && p.transactionType !== "expense")
    return "種別は income または expense を指定してください";
  if (!Number.isInteger(p.amount) || p.amount <= 0)
    return "金額は1以上の整数を入力してください";
  if (p.memo && p.memo.length > 200)
    return "メモは200文字以内で入力してください";
  return null;
}
