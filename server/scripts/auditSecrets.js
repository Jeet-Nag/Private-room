const fs = require('fs');
const path = require('path');

const patterns = [
  { name: 'RSA/EC Private Key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'GitHub Personal Token', regex: /gh[pousr]_[0-9A-Za-z]{36,255}/ },
  { name: 'Generic Secret Assignment', regex: /(?:secret|password|passwd|api_key|apikey|private_key)\s*[:=]\s*["'](?![a-z0-9_\-\.\/]+:[0-9]+)[^"']{8,}["']/i },
  { name: 'AWS Access Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
];

const ignoredDirs = new Set(['node_modules', '.next', '.git', 'scratch', 'dist', 'build', 'certs']);

let foundIssues = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg') || entry.name.endsWith('.ico')) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const p of patterns) {
        if (p.regex.test(content)) {
          // Check if it's documentation or test mock
          if (fullPath.includes('.env.example') || fullPath.includes('auditSecrets.js') || fullPath.includes('README.md') || fullPath.includes('SECURITY.md')) {
            continue;
          }
          console.warn(`[WARNING] Potential secret detected in ${fullPath} (${p.name})`);
          foundIssues++;
        }
      }
    }
  }
}

console.log('[SECURITY-AUDIT] Starting full repository secrets scan...');
scanDir('.');
console.log(`[SECURITY-AUDIT] Scan completed. Issues found: ${foundIssues}`);
if (foundIssues > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
