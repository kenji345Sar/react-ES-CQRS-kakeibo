# ES/CQRS 一覧取得フローの詳細

## 概要

画面に取引一覧が表示されるまでに、以下の 7 ステップを経る。
旧実装のように「保存済みの配列をそのまま表示」するのではなく、
**イベントログを毎回再生して現在の状態を構築する** のが Event Sourcing の特徴。

---

## 全体フロー図

```
① TransactionsPage.tsx:8    useTransactionStore() を呼ぶ
        ↓
② eventStore.ts:10-12       new EventStore()
                             → localStorage["transaction_events"] から全イベント読み込み
        ↓
③ TransactionsPage.tsx:11   getTransactions() を呼ぶ
        ↓
④ useTransactionStore.ts:91 store.getAll() でイベント配列を取得
        ↓
⑤ projections.ts:5-37       buildTransactionMap() でイベントを1件ずつ再生
        ↓
⑥ projections.ts:44-51      Map → 配列 → フィルタ → ソート → 返却
        ↓
⑦ TransactionsPage.tsx:76   TransactionTable に props として渡して描画
```

---

## 各ステップの詳細

### ① 画面コンポーネントがフックを呼ぶ

```tsx
// TransactionsPage.tsx:8
const { dispatch, getTransactions, summary } = useTransactionStore();
```

`useTransactionStore()` は CQRS の入口。
Write 側（dispatch）と Read 側（getTransactions / summary）を返す。

---

### ② EventStore が localStorage からイベントを復元

```ts
// eventStore.ts:10-12
constructor() {
  this.events = this.loadFromStorage();
  // → localStorage.getItem("transaction_events") を JSON.parse
}
```

初回レンダリング時に `useRef` で EventStore インスタンスが 1 度だけ生成される。
`loadFromStorage()` で localStorage に保存されたイベントログ全件をメモリに読み込む。

この時点で `this.events` に以下のような配列が入る:

```json
[
  {
    "eventId": "seed-1",
    "timestamp": 1707350400000,
    "type": "TransactionCreated",
    "payload": {
      "id": "1", "date": "2026-02-01",
      "transactionType": "income", "amount": 250000, "memo": "給与"
    }
  },
  {
    "eventId": "seed-2",
    "timestamp": 1707350400000,
    "type": "TransactionCreated",
    "payload": {
      "id": "2", "date": "2026-02-03",
      "transactionType": "expense", "amount": 80000, "memo": "家賃"
    }
  },
  {
    "eventId": "seed-3",
    "timestamp": 1707350400000,
    "type": "TransactionCreated",
    "payload": {
      "id": "3", "date": "2026-02-05",
      "transactionType": "expense", "amount": 3500, "memo": "ランチ"
    }
  }
]
```

---

### ③ 画面がクエリを実行

```tsx
// TransactionsPage.tsx:11
const transactions = getTransactions();
```

引数なしの場合、フィルタは `"all"`（全件）。

---

### ④ フックが EventStore の全イベントを Projection に渡す

```ts
// useTransactionStore.ts:89-92
const getTransactions = useCallback(
  (filter: FilterType = "all"): Transaction[] => {
    return queryTransactions(store.getAll(), filter);
    //                       ^^^^^^^^^^^^^^
    //                       全イベント配列（ReadonlyArray）を渡す
  }, [store]
);
```

`store.getAll()` はイベント配列への参照を返すだけなので、コピーは発生しない。

---

### ⑤ Projection がイベントを先頭から 1 件ずつ再生して Map を構築

```ts
// projections.ts:5-37  buildTransactionMap()
const map = new Map<string, Transaction>();

for (const event of events) {
  switch (event.type) {
    case "TransactionCreated":
      map.set(event.payload.id, { ... });  // 追加
      break;
    case "TransactionUpdated":
      map.set(event.payload.id, { ... });  // 上書き
      break;
    case "TransactionDeleted":
      map.delete(event.payload.id);        // 削除
      break;
  }
}
```

サンプルデータ 3 件の場合、再生過程は以下の通り:

```
イベント[0]: TransactionCreated (id:"1")
  → map = { "1": { type:"income", amount:250000, memo:"給与" } }

イベント[1]: TransactionCreated (id:"2")
  → map = { "1": ..., "2": { type:"expense", amount:80000, memo:"家賃" } }

イベント[2]: TransactionCreated (id:"3")
  → map = { "1": ..., "2": ..., "3": { type:"expense", amount:3500, memo:"ランチ" } }
```

#### 更新・削除イベントがある場合の例

仮に家賃を 90,000 に修正し、ランチを削除した場合:

```
イベント[3]: TransactionUpdated (id:"2", amount:90000)
  → map["2"] を上書き → { type:"expense", amount:90000, memo:"家賃" }

イベント[4]: TransactionDeleted (id:"3")
  → map.delete("3") → ランチが消える

最終 map = { "1": 給与, "2": 家賃(90000) }
```

**イベントは消えない。Map 上で「現在の最新状態」だけが残る。**

---

### ⑥ Map → 配列化 → フィルタ → ソート

```ts
// projections.ts:44-51
let list = Array.from(map.values());
// → [{ id:"1", ... }, { id:"2", ... }, { id:"3", ... }]

// フィルタ（"all" の場合はスキップ）
if (filter !== "all") {
  list = list.filter((tx) => tx.type === filter);
}

// 日付降順ソート
return list.sort((a, b) => b.date.localeCompare(a.date));
// → [2026-02-05 ランチ, 2026-02-03 家賃, 2026-02-01 給与]
```

---

### ⑦ 結果が props として TransactionTable へ

```tsx
// TransactionsPage.tsx:75-80
<TransactionTable
  transactions={transactions}   ← ⑥の結果（Transaction[]）
  summary={summary}             ← 同様にイベント再生で算出したサマリ
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

サマリも同じ `buildTransactionMap()` で Map を構築し、
入金・出金を合算して `{ income, expense, balance }` を返す。

---

## 新規登録後に一覧が更新される仕組み

一覧表示後、ユーザーが新しい取引を登録した場合の再描画フロー:

```
登録ボタン押下
  ↓
dispatch({ type: "CreateTransaction", payload: { ... } })
  ↓                              ← Write 側
handleCommand()
  → バリデーション通過
  ↓
store.append(event)              ← イベント配列に追記 + localStorage 保存
  ↓
listeners.forEach(fn => fn(event))
  ↓                              ← EventStore → React への通知
setVersion(v => v + 1)           ← useState の state が変わる
  ↓
TransactionsPage が再レンダリングされる
  ↓                              ← Read 側
getTransactions() が再実行
  → イベントが 1 件増えた状態で再度 Projection
  ↓
新しい取引を含む一覧が表示される
```

### 再描画トリガーの仕組み

```ts
// useTransactionStore.ts:71-78
const [, setVersion] = useState(0);

useEffect(() => {
  const unsub = store.subscribe(() => {
    setVersion((v) => v + 1);   // ← state が変わるので React が再描画
  });
  return unsub;
}, [store]);
```

- `version` 自体は画面に表示しない（捨て変数）
- 目的は「EventStore にイベントが追加されたら React に再描画させる」こと
- `subscribe()` で EventStore の `append()` 時に通知を受け取る

---

## パフォーマンスに関する注意点

### 現在の実装の特性

- **毎回全イベントを再生する**: レンダリングのたびに `buildTransactionMap()` が走る
- イベント数が少ない（数百件程度）なら問題ない
- Map の構築は O(n) なので、イベント数に比例して遅くなる

### データ量が増えた場合の対策

| 対策 | 概要 |
|------|------|
| スナップショット | 一定イベント数ごとに Map の状態を保存し、そこから再生を開始 |
| メモ化（useMemo） | イベント数が変わらなければ前回の結果を再利用 |
| インメモリキャッシュ | EventStore 内に最新の Map を保持し、差分だけ適用 |

これらは現在の構造を大きく変えずに導入可能。
