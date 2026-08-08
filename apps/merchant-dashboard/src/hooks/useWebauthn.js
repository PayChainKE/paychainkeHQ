import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

// Shared WebAuthn client logic — previously duplicated near-identically
// across BiometricButton.jsx and BiometricOnboardingModal.jsx (a third
// copy, BiometricSetupModal.jsx, existed too but was never actually
// rendered anywhere and has been removed). One canonical implementation
// here means one place to fix a bug or improve error copy, instead of
// three that drift apart.

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export async function checkPlatformAuthenticatorSupport() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Thrown when the user simply dismissed/cancelled the native OS prompt —
// callers should treat `.silent` as "go back to idle, don't show an error".
export class WebauthnCancelledError extends Error {
  constructor() {
    super('Biometric prompt was cancelled.')
    this.name = 'WebauthnCancelledError'
    this.silent = true
  }
}

// A regular Error with a stable `.code` so callers can branch on the
// specific failure (e.g. auto-dismiss a modal on ALREADY_REGISTERED)
// without parsing message text.
function codedError(message, code) {
  const err = new Error(message)
  err.code = code
  return err
}

/**
 * Registers a new passkey for the currently authenticated merchant.
 * Resolves with the server's { success, message } on completion.
 * `onPhase('prompt')` fires right before the native OS prompt appears, so
 * callers can show "Touch the sensor now…" for exactly that window rather
 * than for the whole (mostly instant) network round-trip either side of it.
 */
export async function registerPasskey(token, onPhase) {
  const optRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/register-options`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const optData = await optRes.json()
  if (!optRes.ok) throw new Error(optData.error || 'Failed to start passkey registration.')

  let regResponse
  try {
    onPhase?.('prompt')
    regResponse = await startRegistration({ optionsJSON: optData.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') throw new WebauthnCancelledError()
    if (err?.name === 'InvalidStateError') throw codedError('This device is already registered as a passkey.', 'ALREADY_REGISTERED')
    throw new Error('Passkey registration failed. Try again.')
  }

  const verifyRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/verify-registration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(regResponse),
  })
  const result = await verifyRes.json()
  if (!verifyRes.ok || !result.success) throw new Error(result.error || 'Passkey registration failed.')
  return result
}

/**
 * Authenticates via passkey for the given email/phone identifier.
 * Resolves with the server's { success, token, merchant } on completion.
 * See registerPasskey's onPhase doc — same purpose here.
 */
export async function loginWithPasskey(email, onPhase) {
  const optRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/login-options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const optData = await optRes.json()
  if (!optRes.ok) throw new Error(optData.error || 'Failed to start biometric login.')

  let authResponse
  try {
    onPhase?.('prompt')
    authResponse = await startAuthentication({ optionsJSON: optData.options })
  } catch (err) {
    if (err?.name === 'NotAllowedError') throw new WebauthnCancelledError()
    if (err?.name === 'InvalidStateError') throw codedError('No passkey found for this device. Sign in with your password first.', 'NO_CREDENTIAL')
    throw new Error('Biometric authentication failed. Try your password.')
  }

  const verifyRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/verify-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, response: authResponse }),
  })
  const result = await verifyRes.json()
  if (!verifyRes.ok || !result.success) throw new Error(result.error || 'Biometric sign-in failed.')
  return result
}
