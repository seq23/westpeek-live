# Tier 4 Fallback Ladder Expansion — 2026-06-12

## Runtime order being proven

1. **Primary production source:** StreamYard-compatible Custom RTMP into LiveKit.
   - Automated proof available: controlled ffmpeg RTMP broadcaster into the same LiveKit ingress endpoint StreamYard would use.
   - Actual StreamYard provider API automation is not assumed because StreamYard API access is enterprise-only.

2. **Fallback 1:** LiveKit + Cloudflare Stream Live.
   - Automated proof: Cloudflare Stream Live Input create via API, controlled RTMP media push, credential presence proof, and live input delete cleanup.

3. **Fallback 2:** Daily.
   - Automated proof: room create, meeting token create, and room delete cleanup.
   - Daily API keys are normalized before use so pasted `Bearer ...` values do not become `Bearer Bearer ...`.
   - A Daily `401 authentication-error` after normalization is classified as a real Daily key/domain/provider auth failure.

4. **Fallback 3:** Zoom.
   - Automated proof: unauthenticated API denial and authorized SDK signature issuance.
   - Cleanup is stateless: `not_required_stateless_signature`.

5. **Fallback 4:** Google Meet.
   - Automated proof: valid HTTPS Google/Meet continuity URL check or explicit not-applicable reason.
   - Cleanup is manual/static-link semantics: `not_required_manual_static_link`.

## Tier 4 behavior

Tier 4 must attempt every configured rung and only fail after the full ladder trace has been written. This prevents a Daily or Zoom failure from hiding Cloudflare Stream, Google Meet, or primary LiveKit/RTMP evidence.

## Known operator gates

- `TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER=1` is required for Cloudflare Stream media-push proof.
- Cloudflare Stream proof requires `CLOUDFLARE_STREAM_ACCOUNT_ID`/`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_STREAM_API_TOKEN`/`CLOUDFLARE_API_TOKEN`.
- StreamYard remains primary in the product model, but automated provider API proof is not represented unless enterprise API access is later added and separately validated.
