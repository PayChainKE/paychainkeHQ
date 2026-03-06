import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: January 20, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              PayChainKE collects information necessary to provide our payment verification services
              while maintaining strict privacy standards.
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Transaction Data:</strong> Payment amounts, timestamps, and merchant identifiers</li>
              <li><strong>Account Information:</strong> Business registration details and contact information</li>
              <li><strong>Technical Data:</strong> API usage patterns and system performance metrics</li>
              <li><strong>Compliance Data:</strong> Information required for KRA e-TIMS reporting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Process and verify payment transactions in real-time</li>
              <li>Detect and prevent fraudulent activities</li>
              <li>Generate automated tax compliance reports for KRA</li>
              <li>Provide customer support and technical assistance</li>
              <li>Improve service performance and security measures</li>
              <li>Comply with legal and regulatory requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Data Security Measures</h2>
            <p className="mb-4">
              We implement multiple layers of security to protect your data:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Encryption:</strong> AES-256 encryption for data in transit and at rest</li>
              <li><strong>Zero-Knowledge Architecture:</strong> Processing without accessing sensitive details</li>
              <li><strong>Blockchain Anchoring:</strong> Immutable audit trails on Base L2 network</li>
              <li><strong>Access Controls:</strong> Role-based permissions and audit logging</li>
              <li><strong>Regular Security Audits:</strong> Independent third-party security assessments</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Sharing and Third Parties</h2>
            <p className="mb-4">
              We only share data when necessary for service provision and legal compliance:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>KRA e-TIMS:</strong> Automated tax reporting as required by law</li>
              <li><strong>Safaricom/M-Pesa:</strong> Payment verification through official APIs</li>
              <li><strong>Service Providers:</strong> Cloud infrastructure with SOC 2 compliance</li>
              <li><strong>Legal Requirements:</strong> Court orders or regulatory demands</li>
            </ul>
            <p className="mb-4">
              We never sell personal data to third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Transaction Records:</strong> 7 years for tax compliance requirements</li>
              <li><strong>Account Data:</strong> Duration of business relationship plus 3 years</li>
              <li><strong>Security Logs:</strong> 2 years for audit and security purposes</li>
              <li><strong>Backup Data:</strong> 90 days after deletion request</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p className="mb-4">
              Under Kenyan data protection laws, you have the right to:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Access your personal data held by us</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your data (subject to legal requirements)</li>
              <li>Object to processing in certain circumstances</li>
              <li>Data portability for data you provided</li>
              <li>Lodge complaints with the Data Commissioner</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p className="mb-4">
              Our web platform uses essential cookies for authentication and security.
              We do not use tracking cookies or third-party analytics that compromise privacy.
              All cookie usage is disclosed in our Cookie Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="mb-4">
              Data may be processed in secure cloud infrastructure located outside Kenya.
              All transfers comply with Kenyan data protection regulations and include
              appropriate safeguards such as standard contractual clauses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Data Breach Notification</h2>
            <p className="mb-4">
              In the event of a security breach affecting personal data, we will notify
              affected individuals and relevant authorities within 72 hours, as required
              by Kenyan data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this privacy policy to reflect changes in our practices or
              legal requirements. Material changes will be communicated via email and
              require consent where necessary.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p className="mb-4">
              For privacy-related inquiries or to exercise your rights:
            </p>
            <ul className="list-none pl-0">
              <li><strong>Data Protection Officer:</strong> privacy@paychainke.com</li>
              <li><strong>Phone:</strong> +254 XXX XXX XXX</li>
              <li><strong>Address:</strong> Nairobi, Kenya</li>
              <li><strong>Response Time:</strong> Within 30 days of valid request</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;