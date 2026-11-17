// Pure checks for the email button builder: links built from what people type, and HTML the send-time cleaner keeps.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { BUTTONS, buttonHref, buttonHtml, phoneDigits } from '../../lib/email/buttons';

test('phone numbers become international digits', () => {
  assert.equal(phoneDigits('+234 903 739 2168'), '2349037392168');
  assert.equal(phoneDigits('09037392168'), '2349037392168');
  assert.equal(phoneDigits('0044 20 7946 0958'), '442079460958');
  assert.equal(phoneDigits('hello'), '');
});

test('WhatsApp buttons open a chat, with an optional starting message', () => {
  assert.equal(buttonHref('whatsapp', '+2349037392168'), 'https://wa.me/2349037392168');
  assert.equal(buttonHref('whatsapp', '0903 739 2168', { message: 'Hi Posi' }), 'https://wa.me/2349037392168?text=Hi%20Posi');
  assert.equal(buttonHref('whatsapp', 'https://wa.me/2349037392168'), 'https://wa.me/2349037392168');
  assert.equal(buttonHref('whatsapp', 'https://evil.example/x'), null);
});

test('social handles become profile links', () => {
  assert.equal(buttonHref('instagram', '@theelevationsummit'), 'https://instagram.com/theelevationsummit');
  assert.equal(buttonHref('x', '@elevatnsummit'), 'https://x.com/elevatnsummit');
  assert.equal(buttonHref('facebook', 'joinascentor'), 'https://facebook.com/joinascentor');
  assert.equal(buttonHref('youtube', '@joinascentor'), 'https://youtube.com/@joinascentor');
  assert.equal(buttonHref('linkedin', 'linkedin.com/company/joinascentor'), 'https://linkedin.com/company/joinascentor');
  assert.equal(buttonHref('instagram', 'two words'), null);
  assert.equal(buttonHref('linkedin', 'joinascentor'), null);
});

test('website, email, phone and plain buttons', () => {
  assert.equal(buttonHref('website', 'joinascentor.com/elevation-summit'), 'https://joinascentor.com/elevation-summit');
  assert.equal(buttonHref('website', '{{referral_link}}'), '{{referral_link}}');
  assert.equal(buttonHref('email', 'joinascentor@gmail.com'), 'mailto:joinascentor@gmail.com');
  assert.equal(buttonHref('phone', '0903 739 2168'), 'tel:+2349037392168');
  assert.equal(buttonHref('link', 'javascript:alert(1)'), null);
  assert.equal(buttonHref('link', ''), null);
});

test('every icon file exists', () => {
  for (const b of BUTTONS) if (b.icon) assert.ok(fs.existsSync(path.resolve('public/images/email/btn', b.icon)), b.icon);
});

test('button HTML survives the send-time cleaner with its link, icon and text', () => {
  // The same rules as cleanBody() in lib/email/system.ts, copied so this test needs no database or mailer.
  const SANITIZE: sanitizeHtml.IOptions = {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'div', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'center'],
    allowedAttributes: { a: ['href', 'target', 'rel', 'style', 'title'], img: ['src', 'alt', 'width', 'height', 'style'], td: ['style', 'align', 'width', 'colspan'], th: ['style', 'align', 'width'], table: ['style', 'width', 'cellpadding', 'cellspacing', 'role', 'align'], '*': ['style', 'align'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => frame.tag === 'img' && !/^https:\/\//i.test(frame.attribs.src || ''),
  };
  const html = buttonHtml({ kind: 'whatsapp', href: 'https://wa.me/2349037392168?text=Hi%20Posi', text: 'Message me <now>' }, 'https://joinascentor.com');
  const clean = sanitizeHtml(html, SANITIZE);
  assert.match(clean, /href="https:\/\/wa\.me\/2349037392168\?text=Hi%20Posi"/);
  assert.match(clean, /src="https:\/\/joinascentor\.com\/images\/email\/btn\/whatsapp\.png"/);
  assert.match(clean, /Message me &lt;now&gt;/);
  assert.match(clean, /background:#128C7E/);
  const tel = sanitizeHtml(buttonHtml({ kind: 'phone', href: 'tel:+2349037392168', text: 'Call' }, 'https://joinascentor.com'), SANITIZE);
  assert.match(tel, /href="tel:\+2349037392168"/);
});
