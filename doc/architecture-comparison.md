# アーキテクチャ比較: 旧実装 vs Event Sourcing / CQRS

## 概要

本ドキュメントでは、収支管理アプリ（kakeibo）の 2 つの実装方式を比較する。

- **旧実装（main ブランチ）**: useState + localStorage による直接操作モデル
- **新実装（feature/event-sourcing-cqrs ブランチ）**: Event Sourcing + CQRS パターン

---

## 1. アーキテクチャの違い

| 項目 | 旧実装 | ES/CQRS |
|------|--------|---------|
| データモデル | 現在の状態（配列）を直接保存 | イベントログ（履歴）を保存し、状態は都度再構築 |
| 書き込み | `setTransactions()` + `saveTransactions()` | `dispatch(Command)` → バリデーション → `EventStore.append(Event)` |
| 読み取り | `transactions` 配列をそのまま参照 | `queryTransactions()` がイベントを再生して構築 |
| 永続化キー | `localStorage["transactions"]` = JSON 配列 | `localStorage["transaction_events"]` = イベント配列 |
| 状態管理 | useState で配列を直接管理 | EventStore + subscribe による再描画トリガー |

---

## 2. ファイル構成の比較

### 旧実装（1 ファイル / 54 行）

```
src/features/transactions/
  storage/
    transactionsStorage.ts   ← 読み込み・保存・初期データ生成
```

### 新実装（6 ファイル / 412 行）

```
src/features/transactions/
  events/
    types.ts                 ← ドメインイベント型（Created / Updated / Deleted）
    eventStore.ts            ← イベント追記・購読・localStorage 永続化
    migration.ts             ← 旧形式 → 新形式のデータ移行
  commands/
    types.ts                 ← コマンド型（Create / Update / Delete）
    handlers.ts              ← コマンドハンドラ（バリデーション → イベント発行）
  queries/
    projections.ts           ← プロジェクション（イベント再生 → 取引一覧・サマリ）
  useTransactionStore.ts     ← React 統合フック（dispatch / query）
```

### ファイル別行数

| ファイル | 行数 | 責務 |
|----------|------|------|
| `events/types.ts` | 44 | ドメインイベントの型定義 |
| `events/eventStore.ts` | 52 | イベントの追記・購読・永続化 |
| `events/migration.ts` | 72 | 旧データからの自動移行 |
| `commands/types.ts` | 42 | コマンドの型定義と実行結果型 |
| `commands/handlers.ts` | 108 | コマンド処理（バリデーション + イベント発行） |
| `queries/projections.ts` | 71 | イベント再生による読み取りモデル構築 |
| `useTransactionStore.ts` | 99 | React へのCQRS統合フック |
| **合計** | **488** | |

---

## 3. データフロー比較

### 旧実装: 直接操作モデル

```
ユーザー操作
  ↓
React コンポーネント
  ↓
配列を直接変更（push / map / filter）
  ↓
setTransactions(新しい配列)  ←  useState
  ↓
saveTransactions()  →  localStorage に丸ごと上書き
```

特徴: シンプル。操作 = 状態変更 = 保存がすべて同期的に 1 ステップで完結。

### 新実装: Event Sourcing + CQRS

```
ユーザー操作
  ↓
dispatch(Command)              ← Write 側（コマンド発行）
  ↓
handleCommand()                ← バリデーション
  ↓
EventStore.append(Event)       ← イベント追記 + localStorage 保存
  ↓
subscribe() で通知             ← React 再描画トリガー
  ↓
queryTransactions() / querySummary()  ← Read 側（プロジェクション）
  ↓
UI に反映
```

特徴: 書き込み（Command）と読み取り（Query）が明確に分離。
すべての変更がイベントとして記録される。

---

## 4. 各層の役割詳細

### Event（イベント）

すべての状態変更を「過去に起きた事実」として記録する。

```typescript
// 取引が作成された
{ type: "TransactionCreated", eventId: "...", timestamp: 1707..., payload: { id, date, transactionType, amount, memo } }

// 取引が更新された
{ type: "TransactionUpdated", eventId: "...", timestamp: 1707..., payload: { id, date, transactionType, amount, memo } }

// 取引が削除された
{ type: "TransactionDeleted", eventId: "...", timestamp: 1707..., payload: { id } }
```

### Command（コマンド）

ユーザーの意図を表現する。イベントとは異なり「まだ起きていない操作の要求」。

```typescript
dispatch({ type: "CreateTransaction", payload: { date, transactionType, amount, memo } })
dispatch({ type: "UpdateTransaction", payload: { id, date, transactionType, amount, memo } })
dispatch({ type: "DeleteTransaction", payload: { id } })
```

### Command Handler（コマンドハンドラ）

コマンドを受け取り、以下を行う:

1. **バリデーション**: 日付・種別・金額・メモの検証
2. **整合性チェック**: 更新・削除時に対象の存在を確認
3. **イベント発行**: 検証に通ったらイベントを EventStore に追記

### Projection（プロジェクション）

イベントログを先頭から再生し、現在の状態を構築する。

```typescript
// イベント再生ロジック
for (const event of events) {
  switch (event.type) {
    case "TransactionCreated": map.set(id, transaction);  break;
    case "TransactionUpdated": map.set(id, transaction);  break;
    case "TransactionDeleted": map.delete(id);            break;
  }
}
```

### EventStore（イベントストア）

イベントの保管庫。以下の責務を持つ:

- `append(event)`: イベントを追記し、localStorage に保存 + リスナーに通知
- `getAll()`: 保存済みの全イベントを返す（イミュータブル）
- `subscribe(fn)`: イベント追記時のコールバック登録（React の再描画に使用）

---

## 5. トレードオフ

| 観点 | 旧実装 | ES/CQRS |
|------|--------|---------|
| コード量 | 少ない（54 行） | 多い（488 行、約 9 倍） |
| 理解しやすさ | 直感的、初学者にもわかりやすい | 学習コストあり、パターンの理解が前提 |
| 操作履歴 | なし（上書きで消える） | 全履歴が残る（追記のみ） |
| 監査・Undo | 不可能 | イベント遡りで実装可能 |
| テスタビリティ | コンポーネントと密結合 | 各層を独立して単体テスト可能 |
| 拡張性 | API 化時に大幅書き換え | EventStore の差し替えで対応可能 |
| パフォーマンス | 配列直接参照で高速 | イベント再生のコストあり（データ量に比例） |
| デバッグ | 現在の状態のみ確認可能 | イベントログで「何が起きたか」を追跡可能 |

### 旧実装が適するケース

- プロトタイプ・MVP
- 小規模アプリ（データ量が少ない）
- チームに CQRS/ES の経験がない場合

### ES/CQRS が適するケース

- 操作履歴・監査ログが必要
- Undo/Redo を実装したい
- 複数の読み取りモデル（ビュー）が必要
- 将来的にバックエンド API やイベントバスと連携する予定

---

## 6. データ移行

旧実装で登録したデータは、新実装への切り替え時に自動移行される。

### 移行の流れ

```
1. アプリ起動時に migration.ts が実行される
2. localStorage["transactions"]（旧キー）の存在を確認
3. 存在すれば、各取引を TransactionCreated イベントに変換
4. localStorage["transaction_events"]（新キー）に保存
5. 旧データは localStorage["transactions_backup"] にバックアップ
6. 旧キーを削除
```

### 移行の条件

| 条件 | 動作 |
|------|------|
| 旧データあり + 新データなし | 移行実行 |
| 旧データあり + 新データあり | スキップ（新データを優先） |
| 旧データなし | スキップ |
| 旧データ破損 | スキップ（空の状態で起動） |

### 移行されるデータ

```
旧形式（1レコード）:
{
  "id": "1",
  "date": "2026-02-01",
  "type": "income",
  "amount": 250000,
  "memo": "給与"
}

↓ 変換

新形式（1イベント）:
{
  "eventId": "migrated-1",
  "timestamp": 1707350400000,
  "type": "TransactionCreated",
  "payload": {
    "id": "1",
    "date": "2026-02-01",
    "transactionType": "income",
    "amount": 250000,
    "memo": "給与"
  }
}
```

### 確認方法

ブラウザの DevTools コンソールに以下のメッセージが表示されれば移行成功:

```
[migration] 旧データ N 件をイベント形式に移行しました
```

---

## 7. 今後の拡張例

ES/CQRS を採用したことで、以下の拡張が容易になる:

- **Undo/Redo**: イベントの巻き戻し・再適用
- **イベントリプレイ**: 任意の時点の状態を再構築
- **複数プロジェクション**: 月別集計、カテゴリ別集計などを追加
- **API 化**: EventStore を REST API / WebSocket に差し替え
- **イベント駆動連携**: 他のマイクロサービスへのイベント配信
