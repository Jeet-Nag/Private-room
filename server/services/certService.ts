import fs from "fs";
import path from "path";
import os from "os";
import selfsigned from "selfsigned";

export async function ensureDevelopmentCertificates(): Promise<{ keyPath: string; certPath: string }> {
  const certsDir = path.join(process.cwd(), "certs");
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const keyPath = path.join(certsDir, "server.key");
  const certPath = path.join(certsDir, "server.crt");

  // Collect all local IP addresses & hostnames for SAN
  const altNames: Array<{ type: 2; value: string } | { type: 7; ip: string }> = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    { type: 7, ip: "0.0.0.0" },
  ];

  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    const netList = networkInterfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal) {
          altNames.push({ type: 7, ip: net.address });
        }
      }
    }
  }

  // Also include the known user LAN IP if not already detected
  const knownIps = ["10.224.90.12"];
  for (const ip of knownIps) {
    if (!altNames.some((a) => (a as any).ip === ip)) {
      altNames.push({ type: 7, ip });
    }
  }

  // Generate certificate with full SAN coverage
  const attrs = [{ name: "commonName", value: "Phantom Room Dev Certificate" }];
  const pems = await selfsigned.generate(attrs, {
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "basicConstraints",
        cA: true,
      },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      {
        name: "subjectAltName",
        altNames,
      },
    ],
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log(`[CERT] Generated development TLS certificate covering SANs: ${altNames.map((a) => ("value" in a ? a.value : a.ip)).join(", ")}`);

  return { keyPath, certPath };
}
