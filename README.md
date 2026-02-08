# 収支管理アプリ (kakeibo)

入金・出金を登録し、一覧・合計を確認できるシンプルな収支管理アプリです。

同じ機能を **2 つのアーキテクチャ** で実装し、ブランチで比較できるようにしています。

## ブランチ構成

| ブランチ | アーキテクチャ | 概要 |
|---------|--------------|------|
| `main` | useState + localStorage | シンプルな直接操作モデル。状態を配列で管理し、変更のたびに丸ごと保存 |
| `feature/event-sourcing-cqrs` | Event Sourcing + CQRS | すべての操作をイベントとして記録し、読み取り時にイベントを再生して状態を構築 |

### main（本ブランチ）

- 状態管理: `useState` で取引配列を直接保持
- 永続化: `localStorage["transactions"]` に JSON 配列を保存
- 書き込み: 配列を操作（push / map / filter）→ そのまま保存
- 読み取り: 保存済み配列をそのまま参照
- **メリット**: シンプル・少コード（54 行）・理解しやすい

### feature/event-sourcing-cqrs

- 状態管理: EventStore がイベントログを保持、React は subscribe で再描画
- 永続化: `localStorage["transaction_events"]` にイベント配列を保存
- 書き込み（Command）: `dispatch(Command)` → バリデーション → `EventStore.append(Event)`
- 読み取り（Query）: イベントを先頭から再生して現在の取引一覧・サマリを構築
- **メリット**: 全操作履歴の保持・監査可能・Undo/Redo 拡張が容易

### 比較ドキュメント

`feature/event-sourcing-cqrs` ブランチの `doc/` に詳細な比較ドキュメントがあります。

| ドキュメント | 内容 |
|-------------|------|
| `doc/architecture-comparison.md` | アーキテクチャ比較・ファイル構成・データフロー・トレードオフ・データ移行 |
| `doc/query-flow-detail.md` | ES/CQRS での一覧取得フロー（7 ステップ）の詳細解説 |

```bash
# ドキュメントを読むにはブランチを切り替え
git checkout feature/event-sourcing-cqrs
```

---

## 実行手順

```bash
cd kakeibo
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開くと画面が表示されます。

どちらのブランチでも同じ手順で起動できます。

## 機能

- 取引（入金・出金）の登録 / 編集 / 削除
- 一覧テーブル（日付降順ソート）
- サマリ表示（入金合計 / 出金合計 / 差額）
- 種別フィルタ（すべて / 入金 / 出金）
- バリデーション（日付・種別・金額は必須、メモは 200 文字以内）
- データは localStorage に永続化

## 技術スタック

- React + TypeScript
- Vite 5
- 状態管理: useState（main） / EventStore + CQRS（feature ブランチ）
- データ保存: localStorage

## ディレクトリ構成

### main ブランチ

```
src/features/transactions/
  types.ts                  # Transaction 型定義
  TransactionsPage.tsx      # メイン画面
  components/
    TransactionForm.tsx     # 登録・編集フォーム
    TransactionTable.tsx    # 一覧テーブル + サマリ + フィルタ
  storage/
    transactionsStorage.ts  # localStorage 読み書き
```

### feature/event-sourcing-cqrs ブランチ

```
src/features/transactions/
  types.ts                    # Transaction 型定義（共通）
  TransactionsPage.tsx        # メイン画面（Command / Query を使い分け）
  useTransactionStore.ts      # CQRS 統合フック
  components/
    TransactionForm.tsx       # 登録・編集フォーム
    TransactionTable.tsx      # 一覧テーブル（サマリは Query から受け取り）
  events/
    types.ts                  # ドメインイベント型
    eventStore.ts             # イベント追記・購読・永続化
    migration.ts              # 旧形式 → 新形式のデータ移行
  commands/
    types.ts                  # コマンド型
    handlers.ts               # コマンドハンドラ（バリデーション + イベント発行）
  queries/
    projections.ts            # プロジェクション（イベント再生 → 読み取りモデル）
doc/
  architecture-comparison.md  # アーキテクチャ比較ドキュメント
  query-flow-detail.md        # 一覧取得フローの詳細ドキュメント
```
