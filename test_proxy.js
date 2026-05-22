const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');
const https = require('https');
const http = require('http');

async function testProxy(proxyUrl, label) {
  return new Promise((resolve) => {
    const agent = proxyUrl.startsWith('https')
      ? new HttpsProxyAgent(proxyUrl)
      : new HttpProxyAgent(proxyUrl);

    const url = 'https://hq.sinajs.cn/list=sh000001';
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;

    const timeout = setTimeout(() => {
      resolve({ label, status: '\u274C Timeout' });
    }, 10000);

    const req = mod.request(url, {
      agent,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://finance.sina.com.cn/'
      }
    }, (res) => {
      clearTimeout(timeout);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ok = data.includes('hq_str');
        resolve({ label, status: ok ? '\u2705 OK' : '\u274C Bad', data: data.substring(0, 60) });
      });
    });
    req.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ label, status: '\u274C ' + e.message.substring(0, 40) });
    });
    req.end();
  });
}

async function main() {
  const proxies = [
    { url: 'http://183.247.199.114:3000', label: 'CN1' },
    { url: 'http://114.215.95.138:8080', label: 'CN2' },
    { url: 'http://47.120.50.72:8080', label: 'CN3' },
    { url: 'http://39.105.211.62:3128', label: 'CN4' },
    { url: 'http://120.26.55.100:8080', label: 'CN5' },
    { url: 'http://8.220.204.52:8080', label: 'CN6' },
  ];

  console.log('Testing free proxies for Sina Finance API...\n');
  const results = await Promise.all(proxies.map(p => testProxy(p.url, p.label)));
  results.forEach(r => console.log(r.status, r.label));

  const working = results.filter(r => r.status.includes('OK'));
  console.log(`\nWorking: ${working.length}/${proxies.length}`);

  if (working.length === 0) {
    console.log('\nTrying to fetch proxy list from GitHub...');
    try {
      const resp = await fetch('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt');
      const text = await resp.text();
      const lines = text.trim().split('\n').slice(0, 20);
      console.log(`Found ${lines.length} proxies to test`);
      for (const line of lines) {
        const [ip, port] = line.split(':');
        if (ip && port) {
          const r = await testProxy(`http://${ip}:${port}`, `${ip}:${port}`);
          console.log(r.status, r.label);
        }
      }
    } catch(e) {
      console.log('Failed:', e.message);
    }
  }
}
main();
