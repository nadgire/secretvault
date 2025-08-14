import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import { AuthService } from './src/services/AuthService';

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSignInStatus();
  }, []);

  const checkSignInStatus = async () => {
    try {
      const signedIn = await AuthService.isAuthenticated();
      setIsSignedIn(signedIn);
      
      if (signedIn) {
        const user = await AuthService.getCurrentUser();
        setUserInfo(user?.user || null);
      }
    } catch (error) {
      console.error('Check sign in status error:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();
      setUserInfo(result.userInfo);
      setIsSignedIn(true);
      Alert.alert('Success', 'Signed in successfully!');
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await AuthService.signOut();
      setUserInfo(null);
      setIsSignedIn(false);
      Alert.alert('Success', 'Signed out successfully!');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.content}>
        <Text style={styles.title}>SecretVault</Text>
        <Text style={styles.subtitle}>Secure Password Manager</Text>
        
        {isSignedIn && userInfo ? (
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Welcome, {userInfo.name}!</Text>
            <Text style={styles.emailText}>{userInfo.email}</Text>
            
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.signInSection}>
            <Text style={styles.description}>
              Sign in with Google to access your secure vault
            </Text>
            
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Text style={styles.googleButtonText}>
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#718096',
    marginBottom: 40,
  },
  signInSection: {
    width: '100%',
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  googleButton: {
    backgroundColor: '#4285f4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  userInfo: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 30,
  },
  signOutButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
