import SQLite from 'react-native-sqlite-storage';

// Enable debugging for SQLite
SQLite.DEBUG(true);
SQLite.enablePromise(true);

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbName = 'secretvault.db';
    this.dbVersion = '1.0';
    this.dbDisplayName = 'SecretVault Database';
    this.dbSize = 200000;
  }

  // Initialize database connection
  async initDB() {
    try {
      this.db = await SQLite.openDatabase({
        name: this.dbName,
        version: this.dbVersion,
        displayName: this.dbDisplayName,
        size: this.dbSize,
      });
      
      console.log('✅ Database opened successfully');
      await this.createTables();
      return this.db;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  // Create necessary tables
  async createTables() {
    try {
      // Users table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          google_id TEXT UNIQUE,
          email TEXT UNIQUE,
          name TEXT,
          picture TEXT,
          verified_email INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1,
          synced INTEGER DEFAULT 0
        );
      `);

      // Passwords table for offline storage
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS passwords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          title TEXT NOT NULL,
          username TEXT,
          password TEXT,
          website TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          deleted INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `);

      // Sync queue table
      await this.db.executeSql(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          operation TEXT NOT NULL,
          data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          attempts INTEGER DEFAULT 0
        );
      `);

      console.log('✅ Tables created successfully');
    } catch (error) {
      console.error('❌ Table creation failed:', error);
      throw error;
    }
  }

  // User operations
  async saveUserOffline(userInfo) {
    try {
      const result = await this.db.executeSql(
        `INSERT OR REPLACE INTO users 
         (google_id, email, name, picture, verified_email, synced) 
         VALUES (?, ?, ?, ?, ?, 0)`,
        [userInfo.id, userInfo.email, userInfo.name, userInfo.picture, userInfo.verified_email ? 1 : 0]
      );
      
      console.log('✅ User saved offline');
      return result[0].insertId;
    } catch (error) {
      console.error('❌ Failed to save user offline:', error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      const result = await this.db.executeSql(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        [email]
      );
      
      return result[0].rows.length > 0 ? result[0].rows.item(0) : null;
    } catch (error) {
      console.error('❌ Failed to get user:', error);
      return null;
    }
  }

  // Password operations
  async savePassword(userId, passwordData) {
    try {
      const result = await this.db.executeSql(
        `INSERT INTO passwords (user_id, title, username, password, website, notes, synced) 
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [userId, passwordData.title, passwordData.username, passwordData.password, passwordData.website, passwordData.notes]
      );
      
      // Add to sync queue
      await this.addToSyncQueue('passwords', result[0].insertId, 'INSERT', passwordData);
      
      console.log('✅ Password saved offline');
      return result[0].insertId;
    } catch (error) {
      console.error('❌ Failed to save password:', error);
      throw error;
    }
  }

  async getPasswords(userId) {
    try {
      const result = await this.db.executeSql(
        'SELECT * FROM passwords WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC',
        [userId]
      );
      
      const passwords = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        passwords.push(result[0].rows.item(i));
      }
      
      return passwords;
    } catch (error) {
      console.error('❌ Failed to get passwords:', error);
      return [];
    }
  }

  async updatePassword(passwordId, passwordData) {
    try {
      await this.db.executeSql(
        `UPDATE passwords 
         SET title = ?, username = ?, password = ?, website = ?, notes = ?, 
             updated_at = CURRENT_TIMESTAMP, synced = 0 
         WHERE id = ?`,
        [passwordData.title, passwordData.username, passwordData.password, 
         passwordData.website, passwordData.notes, passwordId]
      );
      
      // Add to sync queue
      await this.addToSyncQueue('passwords', passwordId, 'UPDATE', passwordData);
      
      console.log('✅ Password updated offline');
    } catch (error) {
      console.error('❌ Failed to update password:', error);
      throw error;
    }
  }

  async deletePassword(passwordId) {
    try {
      await this.db.executeSql(
        'UPDATE passwords SET deleted = 1, synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordId]
      );
      
      // Add to sync queue
      await this.addToSyncQueue('passwords', passwordId, 'DELETE', null);
      
      console.log('✅ Password deleted offline');
    } catch (error) {
      console.error('❌ Failed to delete password:', error);
      throw error;
    }
  }

  // Sync operations
  async addToSyncQueue(tableName, recordId, operation, data) {
    try {
      await this.db.executeSql(
        'INSERT INTO sync_queue (table_name, record_id, operation, data) VALUES (?, ?, ?, ?)',
        [tableName, recordId, operation, JSON.stringify(data)]
      );
    } catch (error) {
      console.error('❌ Failed to add to sync queue:', error);
    }
  }

  async getSyncQueue() {
    try {
      const result = await this.db.executeSql(
        'SELECT * FROM sync_queue ORDER BY created_at ASC'
      );
      
      const queue = [];
      for (let i = 0; i < result[0].rows.length; i++) {
        const item = result[0].rows.item(i);
        item.data = item.data ? JSON.parse(item.data) : null;
        queue.push(item);
      }
      
      return queue;
    } catch (error) {
      console.error('❌ Failed to get sync queue:', error);
      return [];
    }
  }

  async removeSyncQueueItem(id) {
    try {
      await this.db.executeSql('DELETE FROM sync_queue WHERE id = ?', [id]);
    } catch (error) {
      console.error('❌ Failed to remove sync queue item:', error);
    }
  }

  async markAsSynced(tableName, recordId) {
    try {
      await this.db.executeSql(
        `UPDATE ${tableName} SET synced = 1 WHERE id = ?`,
        [recordId]
      );
    } catch (error) {
      console.error('❌ Failed to mark as synced:', error);
    }
  }

  // Database utilities
  async closeDB() {
    if (this.db) {
      try {
        await this.db.close();
        console.log('✅ Database closed');
      } catch (error) {
        console.error('❌ Database close failed:', error);
      }
    }
  }

  async clearAllData() {
    try {
      await this.db.executeSql('DELETE FROM passwords');
      await this.db.executeSql('DELETE FROM users');
      await this.db.executeSql('DELETE FROM sync_queue');
      console.log('✅ All data cleared');
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
    }
  }
}

// Export singleton instance
export default new DatabaseService();