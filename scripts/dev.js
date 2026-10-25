const { spawn, execSync } = require('child_process');

function killPort(port) {
  try {
    execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    const start = Date.now();
    while (Date.now() - start < 300) {}
  } catch {}
}

console.log('🚀 آماده‌سازی محیط توسعه کندرلب...');
killPort(4000);
killPort(3000);

// اجرای predev
try {
  console.log('📦 بررسی پریزما و ساخت پکیج‌ها...');
  execSync('npm run predev', { stdio: 'inherit' });
} catch (e) {
  console.error('خطا در اجرای predev:', e.message);
}

console.log('✨ شروع هم‌زمان سرور API (پورت ۴۰۰۰) و فرانت‌اند وب (پورت ۳۰۰۰)...');

const api = spawn('npm', ['run', 'dev', '--workspace=@condorlab/api'], {
  stdio: 'inherit',
  shell: true,
});

const web = spawn('npm', ['run', 'dev', '--workspace=@condorlab/web'], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\n🛑 در حال توقف سرویس‌ها...');
  try {
    api.kill('SIGINT');
  } catch {}
  try {
    web.kill('SIGINT');
  } catch {}
  killPort(4000);
  killPort(3000);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  killPort(4000);
  killPort(3000);
});
