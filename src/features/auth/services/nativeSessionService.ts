import { Capacitor, registerPlugin } from '@capacitor/core'

import type {
  NativeSessionPlugin,
  NativeSessionResult,
  NativeSignUpResult,
} from '@/src/features/auth/types'

const NativeSession = registerPlugin<NativeSessionPlugin>('NativeSession')

export function canUseSecureNativeSession() {
  return Capacitor.isPluginAvailable('NativeSession')
}

export function migrateLegacyNativeSession() {
  return NativeSession.migrateLegacySession()
}

export function signInNative(email: string, password: string): Promise<NativeSessionResult> {
  return NativeSession.signIn({ email, password })
}

export function signUpNative(email: string, password: string, name: string): Promise<NativeSignUpResult> {
  return NativeSession.signUp({ email, password, name })
}

export function verifyEmailNative(email: string, code: string): Promise<NativeSessionResult> {
  return NativeSession.verifyEmail({ email, code })
}

export function exchangeOAuthCodeNative(code: string, codeVerifier: string): Promise<NativeSessionResult> {
  return NativeSession.exchangeOAuthCode({ code, codeVerifier })
}

export function refreshNativeSessionSecurely(): Promise<NativeSessionResult> {
  return NativeSession.refreshSession()
}

export function signOutNative() {
  return NativeSession.signOut()
}

export function clearNativeSecureSession() {
  return NativeSession.clearSession()
}
