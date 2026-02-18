// ═══ ASCENTOR EMAIL TEMPLATES ═══
// Branded, responsive HTML email templates

const BRAND = {
  accent: '#F59E0B',
  bg: '#FFFBF5',
  dark: '#1A1A2E',
  muted: '#6B7280',
  border: '#FED7AA',
};

function layout(content: string, preheader: string = '') {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ascentor</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}">
    <tr><td align="center" style="padding:40px 20px">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid ${BRAND.border}">
        <!-- Header -->
        <tr><td style="padding:32px 32px 16px;text-align:center;border-bottom:1px solid #FEF3C7">
          <span style="font-size:24px">⬆</span>
          <span style="font-size:20px;font-weight:700;color:${BRAND.dark};margin-left:8px;font-family:Georgia,serif">Ascentor</span>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;text-align:center;border-top:1px solid #FEF3C7">
          <p style="margin:0;font-size:11px;color:${BRAND.muted}">
            © ${new Date().getFullYear()} Ascentor · Built for Africa's next generation of leaders
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:${BRAND.muted}">
            <a href="https://ascentor.co/terms" style="color:${BRAND.muted}">Terms</a> ·
            <a href="https://ascentor.co/newsletter?unsubscribe=true" style="color:${BRAND.muted}">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ═══ WELCOME EMAIL ═══
export function welcomeEmail(name: string) {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: `Welcome to Ascentor, ${firstName} 🎉`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:24px;color:${BRAND.dark};font-family:Georgia,serif">
        Welcome aboard, ${firstName}!
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.muted};line-height:1.6">
        You just took the first step toward becoming the leader you're meant to be. Ascentor is your personal leadership operating system — AI coaching, live expert workshops, and a community of professionals who push each other forward.
      </p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${BRAND.dark}">Here's how to get started:</p>
      <table cellpadding="0" cellspacing="0" style="margin:16px 0">
        <tr><td style="padding:8px 0;font-size:14px;color:${BRAND.dark}">
          <strong style="color:${BRAND.accent}">1.</strong> Start an AI coaching session — ask about your biggest leadership challenge
        </td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:${BRAND.dark}">
          <strong style="color:${BRAND.accent}">2.</strong> Browse upcoming expert sessions and register for one
        </td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:${BRAND.dark}">
          <strong style="color:${BRAND.accent}">3.</strong> Join your peer cohort and introduce yourself
        </td></tr>
      </table>
      <div style="text-align:center;margin:24px 0 8px">
        <a href="https://ascentor.co/dashboard" style="display:inline-block;padding:14px 32px;background:${BRAND.accent};color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px">
          Go to Dashboard →
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};text-align:center">
        Your 7-day free trial is active. No credit card needed.
      </p>
    `, 'Welcome to Ascentor! Start your leadership journey today.'),
  };
}

// ═══ NEWSLETTER EMAIL ═══
export function newsletterEmail(subject: string, content: string, firstName?: string) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  return {
    subject,
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.muted}">${greeting}</p>
      <div style="font-size:15px;color:${BRAND.dark};line-height:1.7">
        ${content}
      </div>
      <div style="text-align:center;margin:28px 0 8px">
        <a href="https://ascentor.co/blog" style="display:inline-block;padding:12px 28px;background:${BRAND.accent};color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px">
          Read More on the Blog →
        </a>
      </div>
    `, subject),
  };
}

// ═══ COACHING SUMMARY EMAIL ═══
export function coachingSummaryEmail(name: string, summary: string, keyTakeaways: string[], nextSteps: string[]) {
  const firstName = name?.split(' ')[0] || 'there';
  const takeawaysHtml = keyTakeaways.map(t => `<li style="padding:4px 0;font-size:14px;color:${BRAND.dark}">${t}</li>`).join('');
  const stepsHtml = nextSteps.map(s => `<li style="padding:4px 0;font-size:14px;color:${BRAND.dark}">${s}</li>`).join('');

  return {
    subject: `Your Coaching Session Summary ✨`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND.dark};font-family:Georgia,serif">
        Session Recap, ${firstName}
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.6">
        ${summary}
      </p>
      ${keyTakeaways.length > 0 ? `
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND.dark}">🎯 Key Takeaways:</p>
        <ul style="margin:0 0 20px;padding-left:20px">${takeawaysHtml}</ul>
      ` : ''}
      ${nextSteps.length > 0 ? `
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND.dark}">📋 Next Steps:</p>
        <ol style="margin:0 0 20px;padding-left:20px">${stepsHtml}</ol>
      ` : ''}
      <div style="text-align:center;margin:24px 0 8px">
        <a href="https://ascentor.co/coach" style="display:inline-block;padding:12px 28px;background:${BRAND.accent};color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px">
          Continue Coaching →
        </a>
      </div>
    `, `Here's your coaching session summary from Ascentor.`),
  };
}

// ═══ GOAL REMINDER EMAIL ═══
export function goalReminderEmail(name: string, goals: string[], daysSinceActive: number) {
  const firstName = name?.split(' ')[0] || 'there';
  const goalsHtml = goals.map(g => `<li style="padding:4px 0;font-size:14px;color:${BRAND.dark}">${g}</li>`).join('');

  return {
    subject: `${firstName}, your goals are waiting for you 🎯`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:22px;color:${BRAND.dark};font-family:Georgia,serif">
        Hey ${firstName}, checking in 👋
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:${BRAND.muted};line-height:1.6">
        It's been ${daysSinceActive} days since your last coaching session. Your goals don't achieve themselves — but we're here to help you get there.
      </p>
      ${goals.length > 0 ? `
        <div style="background:#FEF3C7;border-radius:12px;padding:20px;margin:16px 0">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND.dark}">Your active goals:</p>
          <ul style="margin:0;padding-left:20px">${goalsHtml}</ul>
        </div>
      ` : ''}
      <p style="margin:16px 0;font-size:15px;color:${BRAND.muted};line-height:1.6">
        A quick 5-minute coaching session can get you back on track. Your AI coach remembers where you left off.
      </p>
      <div style="text-align:center;margin:24px 0 8px">
        <a href="https://ascentor.co/coach" style="display:inline-block;padding:14px 32px;background:${BRAND.accent};color:#000;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px">
          Resume Coaching →
        </a>
      </div>
    `, `${firstName}, your leadership goals need attention.`),
  };
}
