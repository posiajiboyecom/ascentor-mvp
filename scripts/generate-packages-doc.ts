// scripts/generate-packages-doc.ts
// Writes docs/ascentor-packages.docx: what Seeker, Builder and Leader each include, with prices read from the
// SAME module checkout charges from (lib/plans-config.ts), so the document can never disagree with the app.
//
//   npm run docs:packages
//
// Package contents and wording come from the design prototypes (member app: Plan screen and Leader invite; admin:
// Plans and pricing, Members). Anything the prototypes do not say is listed under "Unclear / needs a decision".
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
});
