# 収支管理アプリ (kakeibo)

入金・出金を登録し、一覧・合計を確認できるシンプルな収支管理アプリです。

## 実行手順

```bash
cd kakeibo
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開くと画面が表示されます。

## 機能

- 取引（入金・出金）の登録 / 編集 / 削除
- 一覧テーブル（日付降順ソート）
- サマリ表示（入金合計 / 出金合計 / 差額）
- 種別フィルタ（すべて / 入金 / 出金）
- バリデーション（日付・種別・金額は必須、メモは200文字以内）
- データは localStorage に永続化

## 技術スタック

- React + TypeScript
- Vite
- 状態管理: useState
- データ保存: localStorage

## ディレクトリ構成

```
src/
  features/transactions/
    types.ts                  # Transaction 型定義
    TransactionsPage.tsx      # メイン画面
    components/
      TransactionForm.tsx     # 登録・編集フォーム
      TransactionTable.tsx    # 一覧テーブル + サマリ + フィルタ
    storage/
      transactionsStorage.ts  # localStorage 読み書き
```
