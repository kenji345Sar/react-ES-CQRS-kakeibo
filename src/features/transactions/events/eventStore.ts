import type { DomainEvent } from "./types";

const STORAGE_KEY = "transaction_events";

/** イベントストア: イベントの追記と全件取得を担当 */
export class EventStore {
  private events: DomainEvent[] = [];
  private listeners: Array<(event: DomainEvent) => void> = [];

  constructor() {
    this.events = this.loadFromStorage();
  }

  /** 保存済みの全イベントを取得 */
  getAll(): ReadonlyArray<DomainEvent> {
    return this.events;
  }

  /** イベントを追記する */
  append(event: DomainEvent): void {
    this.events.push(event);
    this.saveToStorage();
    this.listeners.forEach((fn) => fn(event));
  }

  /** イベント発行時のリスナーを登録。解除関数を返す */
  subscribe(fn: (event: DomainEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /** localStorage からイベントを読み込む。破損時は空配列 */
  private loadFromStorage(): DomainEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  /** localStorage にイベントを保存 */
  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
  }
}
