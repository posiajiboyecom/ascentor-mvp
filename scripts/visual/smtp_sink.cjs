// A throwaway local mail server for tests: accepts any message and records who it was for. Nothing leaves this machine.
// Usage: node scripts/visual/smtp_sink.cjs [smtpPort=2525] [controlPort=2526]
//   Point the app at it with SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=sink@example.invalid SMTP_PASS=x
//   Control (HTTP, localhost only):
//     GET /log               -> JSON list of { to, subject, at }
//     GET /reset             -> forget everything
//     GET /mode?auth=fail    -> answer every login with "535 5.7.8 authentication failed" (auth=ok to undo)
//     GET /mode?delay=800    -> wait this many ms before accepting each message
const net = require('net');
const http = require('http');
const SMTP = Number(process.argv[2] || 2525), CTRL = Number(process.argv[3] || 2526);
let log = []; let mode = { auth: 'ok', delay: 0 };

const server = net.createServer((sock) => {
  sock.setEncoding('utf8');
  let buf = '', inData = false, from = '', rcpts = [], data = '', authStep = null;
  const send = (s) => sock.write(s + '\r\n');
  send('220 sink ESMTP');
  const finishMessage = () => {
    const subj = (data.match(/^Subject:\s*(.+)$/im) || [, ''])[1].trim();
    // header lines may be folded or MIME-encoded; the recipient list is what the tests count
    for (const to of rcpts) log.push({ to, subject: subj, at: new Date().toISOString() });
    setTimeout(() => send('250 2.0.0 queued'), mode.delay);
  };
  sock.on('data', (chunk) => {
    buf += chunk;
    for (;;) {
      if (inData) {
        data += buf; buf = '';
        const end = data.indexOf('\r\n.\r\n');
        if (end < 0) return;
        buf = data.slice(end + 5); data = data.slice(0, end); inData = false; finishMessage(); continue;
      }
      const i = buf.indexOf('\r\n'); if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (authStep === 'user') { authStep = 'pass'; send('334 UGFzc3dvcmQ6'); continue; }
      if (authStep === 'pass') { authStep = null; if (mode.auth === 'fail') send('535 5.7.8 authentication failed'); else send('235 2.7.0 ok'); continue; }
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO') { sock.write('250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
      else if (cmd === 'HELO') send('250 sink');
      else if (line.toUpperCase().startsWith('AUTH PLAIN')) { if (mode.auth === 'fail') send('535 5.7.8 authentication failed'); else send('235 2.7.0 ok'); }
      else if (line.toUpperCase().startsWith('AUTH LOGIN')) { authStep = 'user'; send('334 VXNlcm5hbWU6'); }
      else if (line.toUpperCase().startsWith('MAIL FROM')) { from = line; rcpts = []; data = ''; send('250 ok'); }
      else if (line.toUpperCase().startsWith('RCPT TO')) { rcpts.push((line.match(/<([^>]+)>/) || [, ''])[1].toLowerCase()); send('250 ok'); }
      else if (cmd === 'DATA') { inData = true; data = ''; send('354 go'); }
      else if (cmd === 'RSET') send('250 ok');
      else if (cmd === 'NOOP') send('250 ok');
      else if (cmd === 'QUIT') { send('221 bye'); sock.end(); return; }
      else send('250 ok');
    }
  });
  sock.on('error', () => {});
});
server.listen(SMTP, '127.0.0.1', () => console.log('smtp sink on', SMTP));

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/reset') { log = []; res.end('{"ok":true}'); return; }
  if (u.pathname === '/mode') { if (u.searchParams.get('auth')) mode.auth = u.searchParams.get('auth'); if (u.searchParams.get('delay')) mode.delay = Number(u.searchParams.get('delay')); res.end(JSON.stringify(mode)); return; }
  res.end(JSON.stringify(log));
}).listen(CTRL, '127.0.0.1', () => console.log('control on', CTRL));
