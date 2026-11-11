import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';
import { generatePageMetadata } from '@/lib/seo';

export const metadata: Metadata = generatePageMetadata({
  title: 'Terms & Conditions',
  description: 'The terms of service for Ascentor, the platform of The Elevation Summit: accounts, memberships, payments, community conduct and your rights.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <PublicHeader />
      <main style={{ minHeight: '100vh', background: '#FAFAF8' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
          <h1 style={{
            fontFamily: 'Metropolis',
            fontWeight: 800,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            color: '#0F0F0E',
            margin: '0 0 0.5rem',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            Terms & Conditions
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '3rem' }}>
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <Section title="1. Agreement to Terms">
              <p>By accessing or using Ascentor ("the Platform"), operated by Ascentor Inc. ("we", "us", "our"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the Platform.</p>
              <p>The Platform provides AI-powered leadership coaching, access to expert-led sessions, peer cohort communities, and educational content ("Services").</p>
            </Section>

            <Section title="2. Eligibility">
              <p>You must be at least 18 years of age to use the Platform. By creating an account, you represent that you are at least 18 years old and that the information you provide is accurate and complete.</p>
            </Section>

            <Section title="3. Accounts & Authentication">
              <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access. We use industry-standard authentication (OAuth 2.0 via Google and LinkedIn) and encrypted session management via Supabase Auth.</p>
              <p>We reserve the right to suspend or terminate accounts that violate these Terms, engage in abusive behavior toward other members, or misuse the AI coaching system.</p>
            </Section>

            <Section title="4. Subscription Plans & Payments">
              <p>We offer tiered subscription plans (Starter, Pro, Premium) as described on our <Link href="/checkout" style={{ color: '#C8A96E', textDecoration: 'underline' }}>Pricing page</Link>. All prices are in US Dollars.</p>
              <p><strong>Free Trial:</strong> New users receive a trial period. No payment is required to start the trial. You will not be charged until the trial period ends and you choose to continue.</p>
              <p><strong>Billing:</strong> Subscriptions are billed monthly through our payment processors (Paystack and Selar). By subscribing, you authorize recurring charges.</p>
              <p><strong>Refund Policy:</strong> We offer a full refund within 30 days of your first payment. After 30 days, payments are non-refundable. You may cancel at any time, and your access continues until the end of your current billing period.</p>
              <p><strong>Promo Codes:</strong> Promotional discounts are subject to their specific terms and may be revoked if obtained through unauthorized means.</p>
            </Section>

            <Section title="5. AI Coaching Disclaimer">
              <p>The AI coaching provided on the Platform is for informational and educational purposes only. It does not constitute professional advice (legal, financial, medical, psychological, or otherwise).</p>
              <p>Our AI coach is designed to facilitate self-reflection and provide frameworks for career and leadership development. It is not a substitute for licensed professional counseling, therapy, or expert consultation.</p>
              <p>We do not guarantee specific career outcomes, promotions, salary increases, or business results from using the Platform.</p>
            </Section>

            <Section title="6. Community Guidelines">
              <p>Peer cohort communities are spaces for professional growth. By participating, you agree to:</p>
              <ul>
                <li>Treat all members with respect and professionalism</li>
                <li>Not share confidential business information belonging to your employer</li>
                <li>Not engage in harassment, discrimination, or abusive behavior</li>
                <li>Not solicit members for external products or services</li>
                <li>Not share another member's personal information outside the cohort</li>
              </ul>
              <p>We reserve the right to remove members who violate these guidelines without refund.</p>
            </Section>

            <Section title="7. Privacy & Data Protection">
              <p>We are committed to protecting your personal data in compliance with applicable data protection laws, including the Nigeria Data Protection Regulation (NDPR 2019), the Nigeria Data Protection Act (NDPA 2023), and where applicable, the EU General Data Protection Regulation (GDPR).</p>
              <Subheading text="7.1 Data We Collect" />
              <ul>
                <li><strong>Account data:</strong> Name, email, professional role, industry, career goals (provided during onboarding)</li>
                <li><strong>Coaching data:</strong> Messages sent to the AI coach and AI responses</li>
                <li><strong>Community data:</strong> Posts, replies, and votes in peer cohorts</li>
                <li><strong>Usage data:</strong> Session timestamps, feature usage, course progress</li>
                <li><strong>Payment data:</strong> Processed by Paystack/Selar, we do not store card numbers</li>
              </ul>
              <Subheading text="7.2 How We Use Your Data" />
              <ul>
                <li>To provide personalized AI coaching based on your profile and goals</li>
                <li>To match you with relevant peer cohorts</li>
                <li>To improve our AI coaching models and platform features</li>
                <li>To send service-related communications and (with consent) marketing emails</li>
                <li>To comply with legal obligations</li>
              </ul>
              <Subheading text="7.3 Data Storage & Security" />
              <p>Your data is stored on Supabase infrastructure (hosted on AWS) with the following safeguards:</p>
              <ul>
                <li>Encryption in transit (TLS 1.2+) and at rest (AES-256)</li>
                <li>Row-Level Security (RLS) ensuring users can only access their own data</li>
                <li>Regular security audits and access logging</li>
                <li>Service-role keys are server-side only and never exposed to clients</li>
              </ul>
              <Subheading text="7.4 AI & Your Data" />
              <p>Conversations with our AI coach are processed through Anthropic's Claude API. Your coaching messages are sent to Anthropic for response generation. We do not use your coaching data to train third-party AI models. Anthropic's data retention policies apply to data processed through their API.</p>
              <Subheading text="7.5 Your Rights" />
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access</strong> your personal data at any time through your account</li>
                <li><strong>Correct</strong> inaccurate information via your profile settings</li>
                <li><strong>Delete</strong> your account and associated data by contacting us at contact@joinascentor.com</li>
                <li><strong>Export</strong> your data in a machine-readable format upon request</li>
                <li><strong>Withdraw consent</strong> for marketing communications at any time</li>
                <li><strong>Lodge a complaint</strong> with the Nigeria Data Protection Commission (NDPC) or relevant supervisory authority</li>
              </ul>
              <Subheading text="7.6 Data Retention" />
              <p>We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by law. Anonymized usage statistics may be retained indefinitely.</p>
              <Subheading text="7.7 Third-Party Services" />
              <p>We use the following third-party services that may process your data:</p>
              <ul>
                <li><strong>Supabase</strong> (database & authentication)</li>
                <li><strong>Anthropic/Claude</strong> (AI coaching)</li>
                <li><strong>Paystack & Selar</strong> (payment processing)</li>
                <li><strong>Google Analytics</strong> (anonymized usage analytics)</li>
                <li><strong>Vercel</strong> (hosting)</li>
              </ul>
            </Section>

            <Section title="8. Intellectual Property">
              <p>All content on the Platform, including AI-generated coaching responses, course materials, expert session recordings, and platform design, is owned by Ascentor Inc. or its licensors.</p>
              <p>Content you create (community posts, coaching conversations) remains yours, but you grant us a non-exclusive license to store and display it within the Platform.</p>
            </Section>

            <Section title="9. Chat Review and Safety">
              <p>I understand that the Ascentor team can read chats on the platform, including conversations with Sage, to keep members safe and to improve Ascentor. Other members cannot read my chats.</p>
              <p>This covers Circle chats, group rooms, direct messages and conversations with Sage. Every time a member of our team opens or exports a conversation, we record it. Your answers to the private growth survey are stored separately and are not readable by our team or by other members.</p>
              <p>You agree to this when you create your account. If you do not agree, please do not use the chat features, and contact us to close your account.</p>
            </Section>

            <Section title="10. Limitation of Liability">
              <p>To the maximum extent permitted by law, Ascentor Inc. shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to lost profits, data loss, or career decisions made based on AI coaching outputs.</p>
              <p>Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
            </Section>

            <Section title="11. Changes to Terms">
              <p>We may update these Terms from time to time. Material changes will be communicated via email or in-app notification at least 14 days before they take effect. Continued use after changes constitutes acceptance.</p>
            </Section>

            <Section title="12. Governing Law">
              <p>These Terms are governed by the laws of the jurisdiction in which you reside. Disputes shall first be attempted to be resolved through good-faith negotiation, followed by binding arbitration if necessary.</p>
            </Section>

            <Section title="13. Contact">
              <p>For questions about these Terms, your data, or to exercise your data rights:</p>
              <p><strong>Email:</strong> contact@joinascentor.com</p>
              <p><strong>Data Protection Officer:</strong> contact@joinascentor.com</p>
            </Section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{
        fontFamily: 'Metropolis',
        fontWeight: 700,
        fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
        color: '#0F0F0E',
        marginBottom: '1rem',
        lineHeight: 1.2,
      }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </section>
  );
}

function Subheading({ text }: { text: string }) {
  return (
    <h3 style={{
      fontFamily: 'Metropolis',
      fontWeight: 600,
      fontSize: '1.0625rem',
      color: '#0F0F0E',
      marginTop: '1.5rem',
      marginBottom: '0.5rem',
    }}>
      {text}
    </h3>
  );
}
