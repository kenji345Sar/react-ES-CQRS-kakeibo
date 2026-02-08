/** 取引データの型定義 */
export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  amount: number;
  memo?: string;
};

/** 種別フィルタの型 */
export type FilterType = "all" | "income" | "expense";
