import 'server-only'

type ProviderAuthData = {
  user?: unknown
  requireEmailVerification?: boolean
}

type ProviderResponse = Promise<{ data: ProviderAuthData | null; error: unknown }>

type PasswordAuthProvider = {
  signInWithPassword(input: { email: string; password: string }): ProviderResponse
  signUp(input: { email: string; password: string; name: string; redirectTo: string }): ProviderResponse
  verifyEmail(input: { email: string; otp: string }): ProviderResponse
}

export function runPasswordSignIn(
  auth: PasswordAuthProvider,
  email: string,
  password: string,
) {
  return auth.signInWithPassword({ email, password })
}

export function runPasswordSignUp(
  auth: PasswordAuthProvider,
  input: { email: string; password: string; name: string; redirectTo: string },
) {
  return auth.signUp(input)
}

export function runEmailVerification(
  auth: PasswordAuthProvider,
  email: string,
  code: string,
) {
  return auth.verifyEmail({ email, otp: code })
}
