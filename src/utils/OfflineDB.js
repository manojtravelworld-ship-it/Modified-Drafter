// ─── OfflineDB.js ─────────────────────────────────────────────────────────────
// IndexedDB wrapper for offline data storage
// Stores: clients, chatHistory, draftPages, voiceRecords, syncQueue
// Auto-syncs to backend when online
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'nexus_offline_db';
const DB_VERSION = 2;

const STORES = {
  CLIENTS: 'clients',
  CHAT_HISTORY: 'chat_history',
  DRAFT_PAGES: 'draft_pages',
  VOICE_RECORDS: 'voice_records',
  SYNC_QUEUE: 'sync_queue',
  SETTINGS: 'settings',
  TASKS: 'tasks',           // [F10] task list per client
  FEE_REGISTER: 'fee_register', // [F10-C7] fee advance tracker per client
  REMINDERS: 'reminders',   // [F10-C2] hearing reminders
};

class OfflineDB {
  constructor() {
    this.db = null;
    this._ready = null;
  }

  async open() {
    if (this.db) return this.db;
    if (this._ready) return this._ready;

    this._ready = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Clients store
        if (!db.objectStoreNames.contains(STORES.CLIENTS)) {
          const s = db.createObjectStore(STORES.CLIENTS, { keyPath: 'slNo' });
          s.createIndex('name', 'name', { unique: false });
        }
        // Chat history store
        if (!db.objectStoreNames.contains(STORES.CHAT_HISTORY)) {
          const s = db.createObjectStore(STORES.CHAT_HISTORY, { keyPath: 'id', autoIncrement: true });
          s.createIndex('ts', 'ts', { unique: false });
        }
        // Draft pages
        if (!db.objectStoreNames.contains(STORES.DRAFT_PAGES)) {
          db.createObjectStore(STORES.DRAFT_PAGES, { keyPath: 'pageNum' });
        }
        // Voice records
        if (!db.objectStoreNames.contains(STORES.VOICE_RECORDS)) {
          const s = db.createObjectStore(STORES.VOICE_RECORDS, { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        // Sync queue (pending actions when offline)
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const s = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          s.createIndex('ts', 'ts', { unique: false });
        }
        // Settings
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
        // Tasks per client [F10]
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const s = db.createObjectStore(STORES.TASKS, { keyPath: 'id', autoIncrement: true });
          s.createIndex('clientSlNo', 'clientSlNo', { unique: false });
        }
        // Fee Register [F10-C7]
        if (!db.objectStoreNames.contains(STORES.FEE_REGISTER)) {
          const s = db.createObjectStore(STORES.FEE_REGISTER, { keyPath: 'id', autoIncrement: true });
          s.createIndex('clientSlNo', 'clientSlNo', { unique: false });
        }
        // Reminders [F10-C2]
        if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
          const s = db.createObjectStore(STORES.REMINDERS, { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date', { unique: false });
        }
      };

      req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror = (e) => reject(e.target.error);
    });

    return this._ready;
  }

  async _tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const s = tx.objectStore(store);
      const req = fn(s);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── Clients ──────────────────────────────────────────────────────────────────
  async saveClients(clients) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CLIENTS, 'readwrite');
      const s = tx.objectStore(STORES.CLIENTS);
      clients.forEach(c => s.put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getClients() {
    return this._tx(STORES.CLIENTS, 'readonly', s => s.getAll());
  }

  async saveClient(client) {
    return this._tx(STORES.CLIENTS, 'readwrite', s => s.put(client));
  }

  async deleteClient(slNo) {
    return this._tx(STORES.CLIENTS, 'readwrite', s => s.delete(slNo));
  }

  // ── Chat History ─────────────────────────────────────────────────────────────
  async saveChatMessage(msg) {
    return this._tx(STORES.CHAT_HISTORY, 'readwrite', s => s.add({ ...msg, ts: Date.now() }));
  }

  async getChatHistory(limit = 50) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CHAT_HISTORY, 'readonly');
      const s = tx.objectStore(STORES.CHAT_HISTORY);
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result || []).slice(-limit));
      req.onerror = () => reject(req.error);
    });
  }

  async clearChatHistory() {
    return this._tx(STORES.CHAT_HISTORY, 'readwrite', s => s.clear());
  }

  // ── Draft Pages ───────────────────────────────────────────────────────────────
  async saveDraftPage(pageNum, text) {
    return this._tx(STORES.DRAFT_PAGES, 'readwrite', s => s.put({ pageNum, text, savedAt: Date.now() }));
  }

  async getDraftPages() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.DRAFT_PAGES, 'readonly');
      const s = tx.objectStore(STORES.DRAFT_PAGES);
      const req = s.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => a.pageNum - b.pageNum);
        resolve(sorted.map(p => p.text));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearDraftPages() {
    return this._tx(STORES.DRAFT_PAGES, 'readwrite', s => s.clear());
  }

  // ── Voice Records ─────────────────────────────────────────────────────────────
  async saveVoiceRecord(record) {
    return this._tx(STORES.VOICE_RECORDS, 'readwrite', s => s.put(record));
  }

  async getVoiceRecords() {
    return this._tx(STORES.VOICE_RECORDS, 'readonly', s => s.getAll());
  }

  // ── Sync Queue ────────────────────────────────────────────────────────────────
  async queueAction(type, payload) {
    return this._tx(STORES.SYNC_QUEUE, 'readwrite', s =>
      s.add({ type, payload, ts: Date.now(), status: 'pending' })
    );
  }

  async getPendingActions() {
    return this._tx(STORES.SYNC_QUEUE, 'readonly', s => s.getAll());
  }

  async deleteAction(id) {
    return this._tx(STORES.SYNC_QUEUE, 'readwrite', s => s.delete(id));
  }

  async clearSyncQueue() {
    return this._tx(STORES.SYNC_QUEUE, 'readwrite', s => s.clear());
  }

  // ── Settings ──────────────────────────────────────────────────────────────────
  async setSetting(key, value) {
    return this._tx(STORES.SETTINGS, 'readwrite', s => s.put({ key, value }));
  }

  async getSetting(key) {
    const result = await this._tx(STORES.SETTINGS, 'readonly', s => s.get(key));
    return result?.value;
  }

  // ── Tasks [F10] ───────────────────────────────────────────────────────────────
  async saveTask(task) {
    return this._tx(STORES.TASKS, 'readwrite', s => s.put(task));
  }
  async addTask(task) {
    return this._tx(STORES.TASKS, 'readwrite', s => s.add({ ...task, createdAt: Date.now() }));
  }
  async getTasksForClient(clientSlNo) {
    const all = await this._tx(STORES.TASKS, 'readonly', s => s.getAll());
    return (all || []).filter(t => t.clientSlNo === clientSlNo);
  }
  async getAllTasks() {
    return this._tx(STORES.TASKS, 'readonly', s => s.getAll());
  }
  async deleteTask(id) {
    return this._tx(STORES.TASKS, 'readwrite', s => s.delete(id));
  }

  // ── Fee Register [F10-C7] ─────────────────────────────────────────────────────
  async addFeeEntry(entry) {
    return this._tx(STORES.FEE_REGISTER, 'readwrite', s => s.add({ ...entry, createdAt: Date.now() }));
  }
  async getFeeEntriesForClient(clientSlNo) {
    const all = await this._tx(STORES.FEE_REGISTER, 'readonly', s => s.getAll());
    return (all || []).filter(e => e.clientSlNo === clientSlNo);
  }
  async deleteFeeEntry(id) {
    return this._tx(STORES.FEE_REGISTER, 'readwrite', s => s.delete(id));
  }

  // ── Reminders [F10-C2] ────────────────────────────────────────────────────────
  async addReminder(reminder) {
    return this._tx(STORES.REMINDERS, 'readwrite', s => s.add({ ...reminder, createdAt: Date.now() }));
  }
  async getReminders() {
    return this._tx(STORES.REMINDERS, 'readonly', s => s.getAll());
  }
  async deleteReminder(id) {
    return this._tx(STORES.REMINDERS, 'readwrite', s => s.delete(id));
  }

  // ── Sync: flush pending actions to backend ────────────────────────────────────
  async syncToBackend(apiInstance) {
    const pending = await this.getPendingActions();
    if (!pending.length) return { synced: 0 };
    let synced = 0;
    for (const action of pending) {
      try {
        if (action.type === 'ADD_CLIENT') {
          // No backend endpoint yet — just mark done
          await this.deleteAction(action.id);
          synced++;
        } else if (action.type === 'SAVE_CHAT') {
          // Chat is local-only for now
          await this.deleteAction(action.id);
          synced++;
        }
      } catch (e) {
        console.warn('Sync failed for action:', action.type, e.message);
      }
    }
    return { synced };
  }
}

export const offlineDB = new OfflineDB();
export default offlineDB;
