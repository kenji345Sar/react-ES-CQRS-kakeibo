# dispatch（コマンド発行）解説

## dispatch とは

**「処理を振り分けて実行させる」** 関数。

直訳すると「発送する・派遣する」。
やりたいことを指示書（Command）にまとめて、適切な処理先に送り届ける役割を持つ。

呼ぶ側は **「何をしたいか」だけ伝えればよく、どう処理されるかを知る必要がない**。

---

## 身近な例えで理解する

```
dispatch = 郵便局の仕分け係

あなたが「手紙」を出す → 仕分け係が宛先を見て → 担当の配達員に渡す
あなたが「荷物」を出す → 仕分け係が宛先を見て → 担当の配達員に渡す
```

```
dispatch({ type: "CreateTransaction", ... })  → handleCreate() に振り分け
dispatch({ type: "UpdateTransaction", ... })  → handleUpdate() に振り分け
dispatch({ type: "DeleteTransaction", ... })  → handleDelete() に振り分け
```

---

## React での一般的な dispatch

dispatch は本アプリ固有の概念ではなく、React 標準の `useReducer` でも使われる:

```tsx
// React 標準の useReducer
const [state, dispatch] = useReducer(reducer, initialState);

dispatch({ type: "increment" });  // 何をしたいかだけ伝える
dispatch({ type: "decrement" });
```

```tsx
// reducer が type を見て処理を振り分ける
function reducer(state, action) {
  switch (action.type) {
    case "increment": return { count: state.count + 1 };
    case "decrement": return { count: state.count - 1 };
  }
}
```

---

## kakeibo での dispatch の実装

仕組みは `useReducer` と同じだが、間に **バリデーション** と **EventStore** が入る。

```
React 標準 (useReducer):
  dispatch(action) → reducer → 新しい state

kakeibo ES/CQRS:
  dispatch(command) → handleCommand → バリデーション → EventStore.append(event)
```

### dispatch の定義（useTransactionStore.ts:81-83）

```ts
const dispatch = useCallback(
  (command: Command): CommandResult => {
    return handleCommand(store, command);
  }, [store]
);
```

受け取った Command を `handleCommand` に渡しているだけ。シンプルな中継役。

### handleCommand での振り分け（handlers.ts:7-18）

```ts
switch (command.type) {
  case "CreateTransaction":  return handleCreate(store, command.payload);
  case "UpdateTransaction":  return handleUpdate(store, command.payload);
  case "DeleteTransaction":  return handleDelete(store, command.payload);
}
```

Command の `type` を見て、3 つのハンドラに振り分ける。

---

## dispatch の全体フロー（登録の例）

```
① UI: 登録ボタン押下
        ↓
② TransactionsPage: dispatch({ type: "CreateTransaction", payload: {...} })
        ↓
③ useTransactionStore: handleCommand(store, command)
        ↓
④ handlers.ts: バリデーション（日付/種別/金額/メモ）
        ↓  失敗 → { ok: false, error: "..." } を返して終了
        ↓  成功 ↓
⑤ handlers.ts: Command → Event に変換
        ↓
⑥ eventStore.ts: store.append(event)
        ├→ メモリ上の配列に追加
        ├→ localStorage に保存
        └→ リスナーに通知
        ↓
⑦ useTransactionStore: setVersion(v+1) → React 再描画
```

### ④ バリデーション詳細

```ts
// handlers.ts:92-107 (validateFields)
if (!p.date)                    → "日付は必須です"
if (transactionType が不正)     → "種別は income または expense を..."
if (amount が0以下 or 非整数)   → "金額は1以上の整数を..."
if (memo が200文字超)           → "メモは200文字以内で..."
```

Update / Delete ではさらに **存在チェック** を行う:

```ts
// handlers.ts:57-61 (handleUpdate 内)
const map = buildTransactionMap(store.getAll());  // 現在の状態をイベントから再構築
if (!map.has(payload.id)) {
  return { ok: false, error: "対象の取引が見つかりません" };
}
```

### ⑤ Command → Event 変換

```ts
// handlers.ts:31-39 (handleCreate 内)
const event: DomainEvent = {
  eventId: crypto.randomUUID(),   // イベント固有ID
  timestamp: Date.now(),          // 発生時刻
  type: "TransactionCreated",     // Command → Event に名前が変わる
  payload: {
    id: Date.now().toString(),    // 取引ID（新規生成）
    date: "2026-02-08",
    transactionType: "expense",
    amount: 5000,
    memo: "書籍代",
  },
};
store.append(event);
```

| Command（意図 = 〜してほしい） | Event（事実 = 〜が起きた） |
|---|---|
| `CreateTransaction` | `TransactionCreated` |
| `UpdateTransaction` | `TransactionUpdated` |
| `DeleteTransaction` | `TransactionDeleted` |

### ⑥ EventStore への追記

```ts
// eventStore.ts:20-23
append(event: DomainEvent): void {
  this.events.push(event);                      // 1. メモリ更新
  this.saveToStorage();                         // 2. localStorage 永続化
  this.listeners.forEach((fn) => fn(event));    // 3. 購読者に通知
}
```

### ⑦ React 再描画

```ts
// useTransactionStore.ts:73-78
useEffect(() => {
  const unsub = store.subscribe(() => {
    setVersion((v) => v + 1);    // ← ⑥の通知でここが呼ばれる
  });
  return unsub;
}, [store]);
```

`setVersion` で state が変わる → React が再描画 → `getTransactions()` が再実行される。

---

## 3 つの Command の比較

| | Create | Update | Delete |
|---|---|---|---|
| バリデーション | 日付/種別/金額/メモ | 同左 + 存在チェック | 存在チェックのみ |
| ID の扱い | 新規生成 (`Date.now()`) | payload から受け取る | payload から受け取る |
| 発行イベント | `TransactionCreated` | `TransactionUpdated` | `TransactionDeleted` |
| 戻り値（成功） | `{ ok: true }` | `{ ok: true }` | `{ ok: true }` |
| 戻り値（失敗） | `{ ok: false, error }` | `{ ok: false, error }` | `{ ok: false, error }` |

---

## dispatch と CQRS の関係

dispatch は **CQRS の Write（Command）側** にのみ使われる。
一覧表示（Read / Query 側）では使われない。

```tsx
// TransactionsPage.tsx:8
const { dispatch, getTransactions, summary } = useTransactionStore();
```

| 返却値 | CQRS の側 | 用途 | 使われる場面 |
|---|---|---|---|
| `dispatch` | **Write（Command）** | コマンド発行 | 登録・更新・削除ボタン押下時 |
| `getTransactions` | **Read（Query）** | 一覧取得 | 画面描画時 |
| `summary` | **Read（Query）** | サマリ取得 | 画面描画時 |

両者は **EventStore を介して間接的につながっている** だけで、直接の依存はない。

```
Write 側:  dispatch(Command) → Event追記 → EventStore
                                              ↓
Read 側:   getTransactions() ← イベント再生 ← EventStore
```

---

## main ブランチとの比較

main ブランチでは dispatch を使わず、各操作を個別の関数として直接書いている。

### main: 操作ごとに個別の関数

```tsx
function handleSubmit(data) {
  const newTx = { ...data, id: Date.now().toString() };
  updateTransactions([...transactions, newTx]);  // 直接配列操作
}

function handleDelete(id) {
  const next = transactions.filter(tx => tx.id !== id);
  updateTransactions(next);  // 直接配列操作
}
```

### ES/CQRS: dispatch に指示書を渡すだけ

```tsx
dispatch({ type: "CreateTransaction", payload: data });
dispatch({ type: "DeleteTransaction", payload: { id } });
```

### 比較表

| 観点 | dispatch あり（ES/CQRS） | dispatch なし（main） |
|---|---|---|
| 呼び方 | `dispatch({ type, payload })` | `handleSubmit()` / `handleDelete()` |
| 処理の場所 | `handlers.ts` に集約 | 各コンポーネントに分散 |
| 操作の追加 | Command 型 + handler を追加 | 新しい関数を個別に書く |
| テスト | handler を単体テスト可能 | コンポーネント経由でテスト |
| 読み書き分離 | 明確に分離（CQRS） | 分離なし（同じ配列を読み書き） |

---

## まとめ

- dispatch は **「何をしたいか」と「どう処理するか」を分離する仕組み**
- React 標準の `useReducer` と同じ考え方
- 本アプリでは Command → バリデーション → Event 発行 という流れを担う
- CQRS の **Write 側（Command）専用** であり、Read 側（Query）には関与しない
