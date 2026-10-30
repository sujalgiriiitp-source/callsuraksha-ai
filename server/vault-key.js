/**
 * CallSuraksha AI — Vault-backed Gnani credential (Phase 4 security fix).
 *
 * The Express server NEVER holds the real Gnani API key. Instead it asks
 * the runtime credential service (authd, over its unix socket) for a
 * surrogate for the registered `custom.gnani` connection, and sends that
 * surrogate as the API header. The runtime egress (Sentinel) swaps the
 * surrogate for the real key on approved requests to the registered host
 * (api.vachana.ai) — exactly the documented mechanism used by the
 * connector helper in /opt/muse/skills/custom-connector-setup/bin/
 * dynamic_credentials.py (POST /v1/credentials/surrogate with
 * {"name": "<connection>"}, entry {name, placement, surrogate}).
 *
 * The surrogate value is kept only in process memory, never written to
 * disk, never logged, and never returned in any response. If Gnani
 * answers 401, the cached surrogate is dropped and a fresh one is
 * fetched once (rotation-safe). If authd is unreachable (e.g. running
 * the project on a MacBook, where there is no Vault), the caller falls
 * back to a local `.env` key — see server/index.js.
 */

import http from 'node:http'

const AUTHD_SOCKET = process.env.JARVIS_AUTHD_SOCK ?? '/run/hatch/auth/authd.sock'
const CREDENTIAL_NAME = 'custom.gnani'
const ALLOWED_HOST = 'api.vachana.ai'

/** Cached surrogate: { headerName, surrogate }. Memory only, never logged. */
let cached = null

function postSurrogate() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name: CREDENTIAL_NAME })
    const req = http.request(
      {
        socketPath: AUTHD_SOCKET,
        path: '/v1/credentials/surrogate',
        method: 'POST',
        headers: {
          Host: 'authd.local',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Connection: 'close',
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8')
          if (res.statusCode !== 200) {
            reject(new Error(`authd surrogate HTTP ${res.statusCode}`))
            return
          }
          try {
            resolve(JSON.parse(text))
          } catch {
            reject(new Error('authd surrogate response was not JSON'))
          }
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(5000, () => req.destroy(new Error('authd timeout')))
    req.end(body)
  })
}

/**
 * Returns { headerName, surrogate } for the Gnani API, or throws when
 * the Vault is unreachable / has no credential. The placement (header
 * name) is read from the authd entry at runtime, not hardcoded.
 */
export async function getVaultCredential() {
  if (cached) return cached
  const payload = await postSurrogate()
  const entries = Array.isArray(payload?.credentials) ? payload.credentials : []
  const entry = entries.find((item) => item?.name === 'access_token')
  const surrogate = typeof entry?.surrogate === 'string' ? entry.surrogate.trim() : ''
  if (!surrogate.startsWith('hsurr:')) {
    throw new Error('authd returned no surrogate for custom.gnani')
  }
  const headerName = entry?.placement?.custom_header
  if (typeof headerName !== 'string' || !headerName) {
    throw new Error('unsupported credential placement for custom.gnani')
  }
  // Safety: the surrogate must only ever go to the registered Gnani host.
  // The caller (server/index.js) sends it to https://api.vachana.ai only.
  void ALLOWED_HOST
  cached = { headerName, surrogate }
  return cached
}

/** Drop the cached surrogate (e.g. after a 401) so the next call refetches. */
export function invalidateVaultCredential() {
  cached = null
}

/** True when the Vault can supply a credential right now. Never throws. */
export async function isVaultAvailable() {
  try {
    await getVaultCredential()
    return true
  } catch {
    return false
  }
}
