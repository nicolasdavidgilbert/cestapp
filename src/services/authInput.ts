import 'server-only'

type ParsedInput<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

function textField(body: Record<string, unknown>, name: string, trim = false) {
  const value = typeof body[name] === 'string' ? body[name] : ''
  return trim ? value.trim() : value
}

export function parseSignInInput(body: Record<string, unknown>): ParsedInput<{
  email: string
  password: string
}> {
  const email = textField(body, 'email', true)
  const password = textField(body, 'password')
  return !email || email.length > 320 || !password || password.length > 1024
    ? { ok: false, error: 'Correo y contraseña no son válidos.' }
    : { ok: true, value: { email, password } }
}

export function parseSignUpInput(body: Record<string, unknown>): ParsedInput<{
  email: string
  password: string
  name: string
}> {
  const email = textField(body, 'email', true)
  const password = textField(body, 'password')
  const name = textField(body, 'name', true)
  return (
    !email || email.length > 320 ||
    !password || password.length > 1024 ||
    !name || name.length > 120
  )
    ? { ok: false, error: 'Nombre, correo y contraseña no son válidos.' }
    : { ok: true, value: { email, password, name } }
}

export function parseVerifyEmailInput(body: Record<string, unknown>): ParsedInput<{
  email: string
  code: string
}> {
  const email = textField(body, 'email', true)
  const code = textField(body, 'code', true)
  return !email || email.length > 320 || !/^\d{6}$/.test(code)
    ? { ok: false, error: 'Correo y código de seis cifras son obligatorios.' }
    : { ok: true, value: { email, code } }
}

export function parseRefreshInput(body: Record<string, unknown>): ParsedInput<{
  refreshToken: string
}> {
  const refreshToken = textField(body, 'refreshToken')
  return !refreshToken || refreshToken.length > 8192
    ? { ok: false, error: 'No hay una sesión renovable.' }
    : { ok: true, value: { refreshToken } }
}

export function parseOAuthExchangeInput(body: Record<string, unknown>): ParsedInput<{
  code: string
  codeVerifier: string
}> {
  const code = textField(body, 'code', true)
  const codeVerifier = textField(body, 'codeVerifier', true)
  return !code || code.length > 4096 || !codeVerifier || codeVerifier.length > 256
    ? { ok: false, error: 'El código OAuth o el verificador PKCE no son válidos.' }
    : { ok: true, value: { code, codeVerifier } }
}
