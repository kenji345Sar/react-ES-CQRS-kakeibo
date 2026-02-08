/** 取引作成コマンド */
export type CreateTransaction = {
  type: "CreateTransaction";
  payload: {
    date: string;
    transactionType: "income" | "expense";
    amount: number;
    memo?: string;
  };
};

/** 取引更新コマンド */
export type UpdateTransaction = {
  type: "UpdateTransaction";
  payload: {
    id: string;
    date: string;
    transactionType: "income" | "expense";
    amount: number;
    memo?: string;
  };
};

/** 取引削除コマンド */
export type DeleteTransaction = {
  type: "DeleteTransaction";
  payload: {
    id: string;
  };
};

/** 全コマンドの共用体型 */
export type Command =
  | CreateTransaction
  | UpdateTransaction
  | DeleteTransaction;

/** コマンド実行結果 */
export type CommandResult =
  | { ok: true }
  | { ok: false; error: string };
