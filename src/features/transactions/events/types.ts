/** ドメインイベントの基底型 */
type BaseEvent = {
  eventId: string;
  timestamp: number;
};

/** 取引が作成された */
export type TransactionCreated = BaseEvent & {
  type: "TransactionCreated";
  payload: {
    id: string;
    date: string;
    transactionType: "income" | "expense";
    amount: number;
    memo?: string;
  };
};

/** 取引が更新された */
export type TransactionUpdated = BaseEvent & {
  type: "TransactionUpdated";
  payload: {
    id: string;
    date: string;
    transactionType: "income" | "expense";
    amount: number;
    memo?: string;
  };
};

/** 取引が削除された */
export type TransactionDeleted = BaseEvent & {
  type: "TransactionDeleted";
  payload: {
    id: string;
  };
};

/** 全ドメインイベントの共用体型 */
export type DomainEvent =
  | TransactionCreated
  | TransactionUpdated
  | TransactionDeleted;
