import NetInfo from '@react-native-community/netinfo';
import DatabaseService from './DatabaseService';
import { AuthService } from './AuthService';

class SyncService {
  constructor() {
    this.isOnline = false;
    this.syncInProgress = false;
    this.listeners = [];
    
    // Listen for network changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      console.log('📶 Network status:', this.isOnline ? 'Online' : 'Offline');
      
      // Auto-sync when coming back online
      if (wasOffline && this.isOnline) {
        console.log('🔄 Connection restored, starting auto-sync...');
        setTimeout(() => this.performSync(), 1000); // Wait 1 second before syncing
      }
      
      // Notify listeners about network status change
      this.notifyListeners({ isOnline: this.isOnline });
    });
  }

  // Subscribe to sync events
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners
  notifyListeners(data) {
    this.listeners.forEach(callback => callback(data));
  }

  // Check if device is online
  async checkOnlineStatus() {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected;
      return this.isOnline;
    } catch (error) {
      console.error('❌ Failed to check network status:', error);
      return false;
    }
  }

  // Manual sync trigger
  async performSync(force = false) {
    if (this.syncInProgress && !force) {
      console.log('⏳ Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    if (!this.isOnline) {
      console.log('📵 Cannot sync - device is offline');
      return { success: false, message: 'Device is offline' };
    }

    this.syncInProgress = true;
    this.notifyListeners({ syncInProgress: true });

    try {
      console.log('🔄 Starting sync...');
      
      // Get pending sync items
      const syncQueue = await DatabaseService.getSyncQueue();
      console.log(`📋 Found ${syncQueue.length} items to sync`);

      let syncedCount = 0;
      let failedCount = 0;

      // Process each sync item
      for (const item of syncQueue) {
        try {
          await this.processSyncItem(item);
          await DatabaseService.removeSyncQueueItem(item.id);
          syncedCount++;
        } catch (error) {
          console.error(`❌ Failed to sync item ${item.id}:`, error);
          failedCount++;
          
          // Increment attempt count
          await DatabaseService.db.executeSql(
            'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
            [item.id]
          );
        }
      }

      console.log(`✅ Sync completed: ${syncedCount} synced, ${failedCount} failed`);
      
      this.notifyListeners({ 
        syncCompleted: true, 
        syncedCount, 
        failedCount 
      });

      return { 
        success: true, 
        message: `Synced ${syncedCount} items`, 
        syncedCount, 
        failedCount 
      };

    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.notifyListeners({ syncFailed: true, error: error.message });
      return { success: false, message: error.message };
    } finally {
      this.syncInProgress = false;
      this.notifyListeners({ syncInProgress: false });
    }
  }

  // Process individual sync item
  async processSyncItem(item) {
    const { table_name, record_id, operation, data } = item;

    switch (table_name) {
      case 'users':
        await this.syncUser(record_id, operation, data);
        break;
      case 'passwords':
        await this.syncPassword(record_id, operation, data);
        break;
      default:
        console.warn(`⚠️ Unknown table for sync: ${table_name}`);
    }
  }

  // Sync user data
  async syncUser(recordId, operation, data) {
    try {
      if (operation === 'INSERT') {
        // Save user to cloud database
        const result = await AuthService.saveUserToDB(data);
        if (result.success) {
          await DatabaseService.markAsSynced('users', recordId);
        }
      }
      // Add UPDATE/DELETE operations as needed
    } catch (error) {
      throw new Error(`User sync failed: ${error.message}`);
    }
  }

  // Sync password data
  async syncPassword(recordId, operation, data) {
    try {
      // Get the current user (needed for API calls)
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      switch (operation) {
        case 'INSERT':
          // Call your password API endpoint (you'll need to create this)
          await this.createPasswordOnServer(data);
          await DatabaseService.markAsSynced('passwords', recordId);
          break;
          
        case 'UPDATE':
          await this.updatePasswordOnServer(recordId, data);
          await DatabaseService.markAsSynced('passwords', recordId);
          break;
          
        case 'DELETE':
          await this.deletePasswordOnServer(recordId);
          // For deletes, we can remove the local record after successful sync
          break;
      }
    } catch (error) {
      throw new Error(`Password sync failed: ${error.message}`);
    }
  }

  // API calls for password operations (you'll need to implement these endpoints)
  async createPasswordOnServer(passwordData) {
    const response = await fetch(`${AuthService.API_BASE_URL}/passwords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwordData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create password on server');
    }

    return response.json();
  }

  async updatePasswordOnServer(passwordId, passwordData) {
    const response = await fetch(`${AuthService.API_BASE_URL}/passwords/${passwordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwordData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update password on server');
    }

    return response.json();
  }

  async deletePasswordOnServer(passwordId) {
    const response = await fetch(`${AuthService.API_BASE_URL}/passwords/${passwordId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete password on server');
    }

    return response.json();
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
    };
  }

  // Cleanup
  destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    this.listeners = [];
  }
}

// Export singleton instance
export default new SyncService();