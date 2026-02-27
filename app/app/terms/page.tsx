import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Ascentor',
  description: 'Terms of Service and Privacy Policy for Ascentor leadership coaching platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', fontFamily: "'Syne', system-ui, sans-serif" }}>

      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-on-light.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
          <Link href="/" className="text-sm" style={{ color: '#6B7280' }}>← Home</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold mb-2"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
          Terms & Conditions
        </h1>
        <p className="text-sm mb-8" style={{ color: '#9CA3AF' }}>
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="prose-sm" style={{ color: '#374151', lineHeight: 1.8 }}>

          <Section title="1. Agreement to Terms">
            <p>By accessing or using Ascentor ("the Platform"), operated by Ascentor Inc. ("we", "us", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the Platform.</p>
            <p className="mt-2">The Platform provides AI-powered leadership coaching, access to expert-led sessions, peer cohort communities, and educational content ("Services").</p>
          </Section>

          <Section title="2. Eligibility">
            <p>You must be at least 18 years of age to use the Platform. By creating an account, you represent that you are at least 18 years old and that the information you provide is accurate and complete.</p>
          </Section>

          <Section title="3. Accounts & Authentication">
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access. We use industry-standard authentication (OAuth 2.0 via Google and LinkedIn) and encrypted session management via Supabase Auth.</p>
            <p className="mt-2">We reserve the right to suspend or terminate accounts that violate these Terms, engage in abusive behavior toward other members, or misuse the AI coaching system.</p>
          </Section>

          <Section title="4. Subscription Plans & Payments">
            <p>We offer tiered subscription plans (Starter, Pro, Premium) as described on our <Link href="/pricing" style={{ color: '#E8A020', textDecoration: 'underline' }}>Pricing page</Link>. All prices are in US Dollars.</p>
            <p className="mt-2"><strong>Free Trial:</strong> New users receive a 7-day free trial. No payment is required to start the trial. You will not be charged until the trial period ends and you choose to continue.</p>
            <p className="mt-2"><strong>Billing:</strong> Subscriptions are billed monthly through our payment processors (Paystack and Selar). By subscribing, you authorize recurring charges.</p>
            <p className="mt-2"><strong>Refund Policy:</strong> We offer a full refund within 30 days of your first payment. After 30 days, payments are non-refundable. You may cancel at any time, and your access continues until the end of your current billing period.</p>
            <p className="mt-2"><strong>Promo Codes:</strong> Promotional discounts are subject to their specific terms and may be revoked if obtained through unauthorized means.</p>
          </Section>

          <Section title="5. AI Coaching Disclaimer">
            <p>The AI coaching provided on the Platform is for informational and educational purposes only. It does not constitute professional advice (legal, financial, medical, psychological, or otherwise).</p>
            <p className="mt-2">Our AI coach is designed to facilitate self-reflection and provide frameworks for career and leadership development. It is not a substitute for licensed professional counseling, therapy, or expert consultation.</p>
            <p className="mt-2">We do not guarantee specific career outcomes, promotions, salary increases, or business results from using the Platform.</p>
          </Section>

          <Section title="6. Community Guidelines">
            <p>Peer cohort communities are spaces for professional growth. By participating, you agree to:</p>
            <ul className="mt-2 flex flex-col gap-1.5 ml-4">
              <li>• Treat all members with respect and professionalism</li>
              <li>• Not share confidential business information belonging to your employer</li>
              <li>• Not engage in harassment, discrimination, or abusive behavior</li>
              <li>• Not solicit members for external products or services</li>
              <li>• Not share another member's personal information outside the cohort</li>
            </ul>
            <p className="mt-2">We reserve the right to remove members who violate these guidelines without refund.</p>
          </Section>

          <Section title="7. Privacy & Data Protection">
            <p>We are committed to protecting your personal data in compliance with applicable data protection laws, including the <strong>Nigeria Data Protection Regulation (NDPR 2019)</strong>, the <strong>Nigeria Data Protection Act (NDPA 2023)</strong>, and where applicable, the <strong>EU General Data Protection Regulation (GDPR)</strong>.</p>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.1 Data We Collect</h4>
            <ul className="flex flex-col gap-1.5 ml-4">
              <li>• <strong>Account data:</strong> Name, email, professional role, industry, career goals (provided during onboarding)</li>
              <li>• <strong>Coaching data:</strong> Messages sent to the AI coach and AI responses</li>
              <li>• <strong>Community data:</strong> Posts, replies, and votes in peer cohorts</li>
              <li>• <strong>Usage data:</strong> Session timestamps, feature usage, course progress</li>
              <li>• <strong>Payment data:</strong> Processed by Paystack/Selar — we do not store card numbers</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.2 How We Use Your Data</h4>
            <ul className="flex flex-col gap-1.5 ml-4">
              <li>• To provide personalized AI coaching based on your profile and goals</li>
              <li>• To match you with relevant peer cohorts</li>
              <li>• To improve our AI coaching models and platform features</li>
              <li>• To send service-related communications and (with consent) marketing emails</li>
              <li>• To comply with legal obligations</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.3 Data Storage & Security</h4>
            <p>Your data is stored on Supabase infrastructure (hosted on AWS) with the following safeguards:</p>
            <ul className="flex flex-col gap-1.5 ml-4 mt-1.5">
              <li>• Encryption in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>• Row-Level Security (RLS) ensuring users can only access their own data</li>
              <li>• Regular security audits and access logging</li>
              <li>• Service-role keys are server-side only and never exposed to clients</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.4 AI & Your Data</h4>
            <p>Conversations with our AI coach are processed through Anthropic's Claude API. Your coaching messages are sent to Anthropic for response generation. We do not use your coaching data to train third-party AI models. Anthropic's data retention policies apply to data processed through their API.</p>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.5 Your Rights</h4>
            <p>You have the right to:</p>
            <ul className="flex flex-col gap-1.5 ml-4 mt-1.5">
              <li>• <strong>Access</strong> your personal data at any time through your account</li>
              <li>• <strong>Correct</strong> inaccurate information via your profile settings</li>
              <li>• <strong>Delete</strong> your account and associated data by contacting us at hello@ascentor.co</li>
              <li>• <strong>Export</strong> your data in a machine-readable format upon request</li>
              <li>• <strong>Withdraw consent</strong> for marketing communications at any time</li>
              <li>• <strong>Lodge a complaint</strong> with the Nigeria Data Protection Commission (NDPC) or relevant supervisory authority</li>
            </ul>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.6 Data Retention</h4>
            <p>We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law. Anonymized usage statistics may be retained indefinitely.</p>

            <h4 className="font-semibold mt-4 mb-1" style={{ color: '#0C0B08' }}>7.7 Third-Party Services</h4>
            <p>We use the following third-party services that may process your data:</p>
            <ul className="flex flex-col gap-1.5 ml-4 mt-1.5">
              <li>• <strong>Supabase</strong> (database & authentication)</li>
              <li>• <strong>Anthropic/Claude</strong> (AI coaching)</li>
              <li>• <strong>Paystack & Selar</strong> (payment processing)</li>
              <li>• <strong>Google Analytics</strong> (anonymized usage analytics)</li>
              <li>• <strong>Vercel</strong> (hosting)</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>All content on the Platform — including AI-generated coaching responses, course materials, expert session recordings, and platform design — is owned by Ascentor Inc. or its licensors.</p>
            <p className="mt-2">Content you create (community posts, coaching conversations) remains yours, but you grant us a non-exclusive license to store and display it within the Platform.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>To the maximum extent permitted by law, Ascentor Inc. shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to lost profits, data loss, or career decisions made based on AI coaching outputs.</p>
            <p className="mt-2">Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </Section>

          <Section title="10. Changes to Terms">
            <p>We may update these Terms from time to time. Material changes will be communicated via email or in-app notification at least 14 days before they take effect. Continued use after changes constitutes acceptance.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes shall be resolved through arbitration in Lagos, Nigeria, under the Arbitration and Mediation Act 2023.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these Terms, your data, or to exercise your data rights:</p>
            <p className="mt-2"><strong>Email:</strong> hello@ascentor.co</p>
            <p><strong>Data Protection Officer:</strong> dpo@ascentor.co</p>
          </Section>

        </div>
      </div>

      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>© {new Date().getFullYear()} Ascentor Inc.</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
        {title}
      </h2>
      <div className="text-sm" style={{ color: '#374151', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  );
}
