import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSSO } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  getAuthErrorDetails,
  getGoogleAuthErrorMessage,
  getGoogleButtonLabel,
  getGoogleCooldownSeconds,
  getGoogleRetryAt,
  isGoogleButtonDisabled,
} from '../lib/googleAuth';

// Required for OAuth redirect handling on web/Android
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRetryAt, setGoogleRetryAt] = useState<number | null>(null);
  const [googleCooldownSeconds, setGoogleCooldownSeconds] = useState(0);

  useEffect(() => {
    if (googleRetryAt === null) {
      setGoogleCooldownSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const seconds = getGoogleCooldownSeconds(googleRetryAt, Date.now());
      setGoogleCooldownSeconds(seconds);
      if (seconds === 0) {
        setGoogleRetryAt(null);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 250);
    return () => clearInterval(interval);
  }, [googleRetryAt]);

  const handleSignIn = async () => {
    if (!isLoaded || !email.trim() || !password) return;

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Verificação necessária', 'Por favor, complete o processo de verificação.');
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        'Não foi possível fazer login. Verifique suas credenciais.';
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleButtonDisabled(googleLoading, googleCooldownSeconds)) return;

    setGoogleLoading(true);
    try {
      // Expo Go cannot receive a custom app scheme. Let AuthSession create its
      // exp:// redirect there, while standalone Android/iOS builds use the
      // scheme declared in app.json.
      const isExpoGo = Constants.appOwnership === 'expo';
      const redirectUrl = Platform.OS === 'web' || isExpoGo
        ? AuthSession.makeRedirectUri()
        : AuthSession.makeRedirectUri({
            scheme: 'gestaoautonomos',
            path: 'oauth-callback',
          });
      const { createdSessionId, setActive: setActiveOAuth, signIn, signUp } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId && setActiveOAuth) {
        await setActiveOAuth({ session: createdSessionId });
        router.replace('/(tabs)');
      } else if (signUp?.status === 'missing_requirements' || signIn?.status === 'needs_second_factor') {
        Alert.alert(
          'Quase lá',
          'O Google pediu uma etapa adicional. Complete a verificação e tente entrar novamente.',
        );
      } else {
        Alert.alert(
          'Login não concluído',
          'O Google voltou sem criar uma sessão. Verifique o navegador e tente novamente.',
        );
      }
    } catch (err: any) {
      const details = getAuthErrorDetails(err);
      const retryAt = getGoogleRetryAt(details, Date.now());
      if (retryAt !== null) {
        console.warn('Google OAuth request was rate limited', {
          status: details.status,
          code: details.code,
        });
        setGoogleRetryAt(retryAt);
        Alert.alert(
          'Muitas tentativas',
          'O login com Google foi temporariamente limitado. Aguarde alguns segundos antes de tentar novamente.',
        );
      } else {
        Alert.alert(
          'Erro ao entrar com Google',
          getGoogleAuthErrorMessage(details),
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleButtonDisabled = isGoogleButtonDisabled(
    googleLoading,
    googleCooldownSeconds,
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Brand header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="briefcase" size={40} color="#ffffff" />
          </View>
          <Text style={styles.appName}>Gestão de Autônomos</Text>
          <Text style={styles.tagline}>Controle clientes, orçamentos e ordens de serviço</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar</Text>

          {/* Google button */}
          <TouchableOpacity
            style={[
              styles.googleBtn,
              googleButtonDisabled && styles.btnDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={googleButtonDisabled}
          >
            {googleLoading ? (
              <ActivityIndicator color="#1e293b" size="small" />
            ) : googleCooldownSeconds > 0 ? (
              <Text style={styles.googleBtnText}>
                {getGoogleButtonLabel(googleCooldownSeconds)}
              </Text>
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.googleBtnText}>Continuar com Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email/password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (loading || !email.trim() || !password) && styles.btnDisabled]}
            onPress={handleSignIn}
            disabled={loading || !email.trim() || !password}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryBtnText}>Entrar com e-mail</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Acesse com a mesma conta do aplicativo web.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={styles.googleIconText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94a3b8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1e293b',
    marginBottom: 20,
  },
  googleBtn: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    marginBottom: 20,
  },
  googleBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1e293b',
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94a3b8',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#1e293b',
    backgroundColor: '#fafafa',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  primaryBtn: {
    height: 50,
    backgroundColor: '#f97316',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#ffffff',
  },
  footer: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#64748b',
    textAlign: 'center',
  },
});
