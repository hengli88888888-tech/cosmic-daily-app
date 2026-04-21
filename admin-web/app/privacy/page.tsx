import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Oraya.',
}

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <nav className="legal-nav" aria-label="Legal navigation">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
      </nav>

      <article className="legal-card">
        <p className="legal-kicker">Oraya</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: April 21, 2026</p>

        <section className="legal-section">
          <h2>Overview</h2>
          <p>
            Oraya is a self-reflection app that lets users ask personal
            guidance questions, save readings, add optional profile details,
            and provide feedback about outcomes. This policy explains what we
            collect, how we use it, and how to contact us.
          </p>
          <p>
            Oraya is for entertainment and self-reflection only. It is not
            medical, legal, financial, or emergency advice.
          </p>
        </section>

        <section className="legal-section">
          <h2>Information We Collect</h2>
          <ul className="legal-list">
            <li>
              Account and authentication information, such as user identifiers,
              sign-in provider data, and session records.
            </li>
            <li>
              Contact and support information, such as your email address and
              the content of messages you send to support.
            </li>
            <li>
              Questions, follow-ups, generated readings, saved conversations,
              feedback notes, and related timestamps.
            </li>
            <li>
              Optional profile details, such as birth date, birth time, gender,
              and birth city, when you choose to provide them for personalized
              chart-based features.
            </li>
            <li>
              App usage, diagnostics, error reports, device information, and
              approximate technical metadata needed to operate and improve the
              service.
            </li>
            <li>
              Purchase, subscription, coin balance, and entitlement data when
              paid features are enabled.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>How We Use Information</h2>
          <ul className="legal-list">
            <li>Provide readings, follow-ups, saved history, and support.</li>
            <li>
              Process questions, optional profile details, and context with
              AI-assisted systems and knowledge retrieval to generate responses.
            </li>
            <li>Maintain coin balances, feedback rewards, and entitlements.</li>
            <li>Improve answer quality, product reliability, and safety.</li>
            <li>Detect abuse, debug incidents, and protect the service.</li>
            <li>Comply with legal, security, and platform requirements.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Service Providers</h2>
          <p>
            We may use trusted service providers for hosting, authentication,
            database storage, analytics, payments, customer support, AI
            generation, and embeddings. These providers process information only
            as needed to support Oraya.
          </p>
          <p>
            Payments and subscriptions may be processed by Apple, app store
            providers, or payment infrastructure providers. Oraya does not
            collect or store full payment card numbers.
          </p>
          <p>
            We do not sell your personal information. We do not share your
            private readings with other users.
          </p>
        </section>

        <section className="legal-section">
          <h2>AI-Assisted Readings</h2>
          <p>
            Oraya uses automated and AI-assisted systems to prepare readings,
            follow-up responses, retrieval matches, and product quality
            analysis. These outputs are for entertainment and self-reflection
            only and are not used to make legal, employment, credit, medical, or
            similarly significant decisions about you.
          </p>
        </section>

        <section className="legal-section">
          <h2>Retention and Deletion</h2>
          <p>
            We keep information for as long as needed to provide the service,
            maintain your saved readings, support account recovery, improve the
            product, and meet security or legal obligations.
          </p>
          <p>
            You can request deletion of your account or personal data by
            contacting us at{' '}
            <a href="mailto:support@ai-divination.com">
              support@ai-divination.com
            </a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Your Choices</h2>
          <p>
            You can choose not to provide optional profile details, such as birth
            time or birth city, although some personalized features may be
            limited. You may also request access, correction, deletion, or
            export of personal information associated with your account.
          </p>
          <p>
            To make a privacy request or withdraw consent for optional data
            processing, contact{' '}
            <a href="mailto:support@ai-divination.com">
              support@ai-divination.com
            </a>. We may keep limited records when required for security,
            billing, fraud prevention, dispute handling, or legal compliance.
          </p>
        </section>

        <section className="legal-section">
          <h2>Security</h2>
          <p>
            We use reasonable technical and organizational safeguards designed
            to protect personal information. No online service can guarantee
            absolute security, so you should avoid submitting information that
            is not needed for your use of Oraya.
          </p>
        </section>

        <section className="legal-section">
          <h2>Children</h2>
          <p>
            Oraya is not intended for children under 13. If you believe a child
            has provided personal information, contact us so we can review and
            remove it where appropriate.
          </p>
        </section>

        <section className="legal-section">
          <h2>International Processing</h2>
          <p>
            Your information may be processed in countries other than where you
            live. We use reasonable safeguards designed to protect information
            handled by Oraya and its service providers.
          </p>
        </section>

        <section className="legal-section">
          <h2>Changes</h2>
          <p>
            We may update this policy as Oraya changes. If we make material
            changes, we will update the date above and provide notice where
            appropriate.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions or requests can be sent to{' '}
            <a href="mailto:support@ai-divination.com">
              support@ai-divination.com
            </a>.
          </p>
        </section>
      </article>
    </main>
  )
}
