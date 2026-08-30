# Security Policy

## Supported Versions

Only the latest release of PHANTOM is actively supported with security patches and updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Architecture & Threat Model

PHANTOM is engineered around a **privacy-first, zero-persistence** architectural model:

1. **In-Memory Ephemeral Storage**:
   - Rooms, participant records, messages, and active call descriptors are held exclusively in volatile RAM.
   - Rooms expire automatically after their configured TTL or upon host termination. All references, attachment metadata, and associated memory are immediately purged with garbage collection sweeps.

2. **Transport & Real-Time Encryption**:
   - **Signaling & REST Traffic**: Protected with TLS 1.3 / HTTPS and secure WebSocket (`wss://`) transport encryption.
   - **Audio, Video & Screen Media**: Transmitted directly peer-to-peer using WebRTC's standard mandatory **DTLS-SRTP** encryption (AES-GCM-128 / AES-CM-128).
   - **Chat End-to-End Encryption (E2EE)**: Direct peer-to-peer messages can be encrypted client-side using the Web Crypto API before transmission over WebSocket signaling channels.

3. **Media & File Sanitization**:
   - Client-side EXIF, GPS coordinates, and camera device metadata are automatically stripped from image uploads before transmission to prevent inadvertent geolocation leakage.
   - File uploads are validated with strict MIME-type guards and stored ephemerally until the room expires.

4. **Network & Anti-Abuse Controls**:
   - Dual-tier cryptographic room mapping prevents enumeration attacks on 4-digit human room codes.
   - Sliding-window rate limiters block brute-force passcode guessing attempts with progressive IP lockouts.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in PHANTOM, please report it responsibly:

- **Do NOT** open a public GitHub issue.
- Please submit your report securely via **GitHub Private Vulnerability Reporting** on the repository page, or email the maintainers directly.
- Include a detailed description of the vulnerability, steps to reproduce, proof-of-concept payload (if applicable), and your assessment of the impact.

### Disclosure Policy
We acknowledge receipt of all vulnerability reports within 48 hours and work to provide a remediation patch as quickly as possible. We request that you refrain from public disclosure until an official patch has been published.
