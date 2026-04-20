import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Oraya.',
}

export default function TermsPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav" aria-label="Legal navigation">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
      </nav>

      <article className="legal-card">
        <p className="legal-kicker">Oraya</p>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: April 20, 2026</p>

        <section className="legal-section">
          <h2>Using Oraya</h2>
          <p>
            Oraya provides self-reflection readings, saved conversations,
            optional profile-based insights, and related features. By using
            Oraya, you agree to these terms.
          </p>
          <p>
            Oraya is for entertainment and self-reflection only. It does not
            provide medical, legal, financial, emergency, or other professional
            advice.
          </p>
        </section>

        <section className="legal-section">
          <h2>No Professional or Emergency Advice</h2>
          <p>
            Do not use Oraya as a substitute for qualified professional advice
            or emergency services. If you may be in danger, experiencing a
            crisis, or facing an urgent medical, legal, or financial issue, use
            local emergency or professional resources.
          </p>
        </section>

        <section className="legal-section">
          <h2>Your Responsibility</h2>
          <p>
            You are responsible for the questions you submit, the decisions you
            make, and how you use any reading or suggestion. Oraya does not
            guarantee outcomes, accuracy, compatibility, relationship results,
            financial results, admissions results, or timing predictions.
          </p>
        </section>

        <section className="legal-section">
          <h2>Accounts and Profile Details</h2>
          <p>
            Some features may require an account, anonymous session, or optional
            profile details. You agree to provide information that is accurate
            enough for the features you choose to use and to avoid submitting
            information you are not allowed to share.
          </p>
        </section>

        <section className="legal-section">
          <h2>Acceptable Use</h2>
          <ul className="legal-list">
            <li>Do not use Oraya to harass, threaten, or harm others.</li>
            <li>Do not attempt to reverse engineer, scrape, or overload Oraya.</li>
            <li>Do not submit unlawful content or content that violates rights.</li>
            <li>Do not abuse free credits, coin rewards, referrals, or feedback.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Coins, Feedback Rewards, and Paid Features</h2>
          <p>
            Oraya may offer coins, free credits, subscriptions, or paid
            features. Coins have no cash value and cannot be redeemed for money.
            We may adjust pricing, eligibility, reward rules, and free-credit
            policies as the product changes.
          </p>
          <p>
            Feedback rewards are granted only for eligible readings and
            meaningful outcome feedback. Abuse, spam, duplicate submissions, or
            fraudulent activity may result in withheld rewards or account
            restrictions.
          </p>
        </section>

        <section className="legal-section">
          <h2>Purchases and Refunds</h2>
          <p>
            If paid iOS features are enabled, purchases are processed through
            Apple or the applicable app store provider. Refunds are handled
            under the store provider&apos;s policies unless required otherwise by
            law.
          </p>
        </section>

        <section className="legal-section">
          <h2>Content and Service Changes</h2>
          <p>
            We may update, suspend, or remove features, content, pricing,
            eligibility, or availability. We may also limit or terminate access
            if use of Oraya creates risk, violates these terms, or abuses the
            service.
          </p>
        </section>

        <section className="legal-section">
          <h2>Privacy</h2>
          <p>
            Our handling of personal information is described in the{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions about these terms can be sent to{' '}
            <a href="mailto:support@oraya.app">support@oraya.app</a>.
          </p>
        </section>
      </article>
    </main>
  )
}
