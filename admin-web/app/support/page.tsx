import Link from 'next/link'

export const metadata = {
  title: 'Support',
  description: 'Support information for Oraya.',
}

export default function SupportPage() {
  return (
    <main className="legal-page support-page">
      <nav className="legal-nav" aria-label="Legal navigation">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
      </nav>

      <article className="legal-card">
        <p className="legal-kicker">Oraya</p>
        <h1>Support</h1>
        <p className="legal-updated">We aim to reply within 2-3 business days.</p>

        <section className="legal-section support-hero">
          <h2>Contact Oraya Support</h2>
          <p>
            For account help, app issues, billing questions, feedback rewards,
            or data requests, email us at:
          </p>
          <p>
            <a className="support-email" href="mailto:support@ai-divination.com">
              support@ai-divination.com
            </a>
          </p>
        </section>

        <section className="legal-section">
          <h2>What to Include</h2>
          <ul className="legal-list">
            <li>The email or sign-in method used with Oraya, if any.</li>
            <li>Your device model and app version, if available.</li>
            <li>The approximate date and time of the issue.</li>
            <li>A short description of what you expected and what happened.</li>
            <li>
              Any reading, feedback, purchase, or coin-balance details that help
              us find the issue.
            </li>
          </ul>
          <p>
            Please do not send payment card numbers, government IDs, passwords,
            or highly sensitive personal information by email.
          </p>
        </section>

        <section className="legal-section">
          <h2>Billing and Purchases</h2>
          <p>
            For App Store purchases, include the purchase date, product name,
            and the Apple account email if it is different from your Oraya
            account. Refund requests may need to be submitted through Apple
            because Apple processes iOS payments.
          </p>
        </section>

        <section className="legal-section">
          <h2>Data and Account Requests</h2>
          <p>
            You can use support to request account deletion, data deletion,
            correction of profile details, or help with saved readings and
            feedback rewards. We may ask for information needed to verify the
            account before making changes.
          </p>
        </section>

        <section className="legal-section">
          <h2>Important Limits</h2>
          <p>
            Oraya cannot provide medical, legal, financial, emergency, or crisis
            services. If you need urgent help, contact local emergency services
            or a qualified professional.
          </p>
        </section>

        <section className="legal-section">
          <h2>Legal Pages</h2>
          <p>
            Read our <Link href="/privacy">Privacy Policy</Link> and{' '}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </section>
      </article>
    </main>
  )
}
