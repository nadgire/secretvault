import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '312663956656-pm4rersj3h29orv1lktmgc7m9s4ntpc1.apps.googleusercontent.com',
  scopes: ['email', 'profile'],
  offlineAccess: false,
});

export class AuthService {
  static async signInWithGoogle() {
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
      console.error('Google Sign-In error:', error);
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