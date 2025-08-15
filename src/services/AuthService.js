import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '312663956656-pm4rersj3h29orv1lktmgc7m9s4ntpc1.apps.googleusercontent.com',
  scopes: ['email', 'profile'],
  offlineAccess: false,
});

export class AuthService {
  static API_BASE_URL = 'https://secretvault-api.onrender.com/api';

  // Test if backend server is running
  static async testConnection() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000 // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  static async saveUserToDB(userInfo) {
    try {
      console.log('🔄 Attempting to save user to DB:', {
        url: `${this.API_BASE_URL}/auth/signup`,
        userInfo: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name
        }
      });

      const response = await fetch(`${this.API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          google_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email
        }),
      });

      console.log('📡 API Response status:', response.status);

      const data = await response.json();
      console.log('📄 API Response data:', data);

      if (!response.ok) {
        console.error('❌ API Error:', data.error);
        return { success: false, error: data.error };
      }

      console.log('✅ User saved successfully to DB');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ Network/API saveUserToDB error:', error);
      
      // Check if it's a network error (server not running)
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on http://localhost:3000');
      }
      
      throw new Error(`Failed to save user to database: ${error.message}`);
    }
  }

  static async checkUserExists(email, googleId) {
    try {
      console.log('🔍 Checking if user exists:', { email, googleId });

      const response = await fetch(`${this.API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          google_id: googleId
        }),
      });

      const data = await response.json();
      console.log('📡 Check user response:', response.status, data);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('👤 User not found in database');
          return null; // User not found
        }
        throw new Error(data.error);
      }

      console.log('✅ User found in database');
      return data.user;
    } catch (error) {
      if (error.message.includes('Account not found')) {
        return null; // User not found
      }
      
      console.error('❌ Network/API checkUserExists error:', error);
      
      // Check if it's a network error (server not running)
      if (error.message.includes('fetch') || error.name === 'TypeError') {
        throw new Error('Cannot connect to server. Please make sure the backend server is running on http://localhost:3000');
      }
      
      throw new Error(`Failed to check user in database: ${error.message}`);
    }
  }

  static async signUpWithGoogle() {
    try {
      // First get Google authentication
      const googleResult = await this.authenticateWithGoogle();
      
      // Save user to our database
      const dbResult = await this.saveUserToDB(googleResult.userInfo);
      
      if (dbResult.success) {
        return {
          tokens: googleResult.tokens,
          userInfo: dbResult.user
        };
      } else {
        // User already exists, sign out from Google
        await GoogleSignin.signOut();
        throw new Error('Account already exists. Please use Sign In instead.');
      }
    } catch (error) {
      throw error;
    }
  }

  static async signInWithGoogle() {
    try {
      // First get Google authentication
      const googleResult = await this.authenticateWithGoogle();
      
      // Check if user exists in our database
      const existingUser = await this.checkUserExists(
        googleResult.userInfo.email, 
        googleResult.userInfo.id
      );
      
      if (existingUser) {
        return {
          tokens: googleResult.tokens,
          userInfo: existingUser
        };
      } else {
        // User doesn't exist in our database, sign out from Google
        await GoogleSignin.signOut();
        throw new Error('Account not found. Please sign up first.');
      }
    } catch (error) {
      throw error;
    }
  }

  static async authenticateWithGoogle() {
    try {
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Sign out first to force account selection
      await GoogleSignin.signOut();
      
      // Sign in
      const response = await GoogleSignin.signIn();
      
      // Handle different response structures
      let user, idToken, serverAuthCode;
      
      if (response.user) {
        // New format
        user = response.user;
        idToken = response.idToken;
        serverAuthCode = response.serverAuthCode;
      } else if (response.data) {
        // Alternative format
        user = response.data.user;
        idToken = response.data.idToken;
        serverAuthCode = response.data.serverAuthCode;
      } else {
        // Direct format
        user = response;
        idToken = response.idToken;
        serverAuthCode = response.serverAuthCode;
      }
      
      if (user && (user.email || user.id)) {
        const userInfo = {
          id: user.id || user.email,
          email: user.email,
          name: user.name || user.givenName + ' ' + user.familyName,
          picture: user.photo,
          verified_email: true
        };

        const tokens = {
          access_token: idToken,
          server_auth_code: serverAuthCode,
          expires_in: 3600,
          token_type: 'Bearer'
        };

        return { 
          tokens, 
          userInfo 
        };
      }
      
      throw new Error('No user data received from Google');
      
    } catch (error) {
      throw error;
    }
  }

  static async signOut() {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  static async isAuthenticated() {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      return false;
    }
  }

  static async getCurrentUser() {
    try {
      const userInfo = await GoogleSignin.getCurrentUser();
      return userInfo;
    } catch (error) {
      return null;
    }
  }
}