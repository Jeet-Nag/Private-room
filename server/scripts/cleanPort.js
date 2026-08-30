const { execSync } = require('child_process');

function cleanPort(port = 3000) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }

      if (pids.size === 0) {
        console.log(`[PORT] Port ${port} is already free.`);
        process.exit(0);
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`[PORT] Safely terminated process ${pid} occupying port ${port}.`);
        } catch (e) {
          console.warn(`[PORT] Could not terminate process ${pid}: ${e.message}`);
        }
      }
    } else {
      const output = execSync(`lsof -i :${port} -t`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`[PORT] Safely terminated process ${pid} occupying port ${port}.`);
      }
    }
  } catch (err) {
    console.log(`[PORT] Port ${port} is already free.`);
  }
  process.exit(0);
}

cleanPort(parseInt(process.argv[2] || '3000', 10));
