import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
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
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: January 20, 2026</p>
        </div>

        <div className="prose prose-lg max-w-none text-foreground">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing and using PayChainKE services, you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
            <p className="mb-4">
              PayChainKE provides blockchain-anchored payment verification services for merchants in Kenya.
              Our platform offers real-time payment confirmation, fraud detection, and automated tax compliance
              through integration with M-Pesa and KRA e-TIMS systems.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide accurate and complete information during registration</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Use the service in compliance with applicable Kenyan laws and regulations</li>
              <li>Report any suspicious activities or security incidents immediately</li>
              <li>Ensure proper integration and testing before going live with production transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Payment Terms</h2>
            <p className="mb-4">
              Service fees are charged based on transaction volume and selected plan. All fees are
              exclusive of applicable taxes. Payment is due monthly in advance. Late payments may
              result in service suspension.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Privacy and Security</h2>
            <p className="mb-4">
              We implement industry-standard security measures including AES-256 encryption,
              zero-knowledge privacy protocols, and blockchain anchoring. Transaction data is
              processed with strict confidentiality and compliance with Kenyan data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Service Availability</h2>
            <p className="mb-4">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled
              maintenance will be communicated in advance. Service credits may be provided for
              extended outages beyond our control.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="mb-4">
              PayChainKE's liability is limited to the amount paid for services in the preceding
              12 months. We are not liable for indirect damages, lost profits, or consequential losses.
              Our fraud detection systems are provided "as is" and do not constitute financial advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
            <p className="mb-4">
              Either party may terminate this agreement with 30 days written notice. Upon termination,
              all data will be securely deleted within 90 days unless legally required to retain it.
              Outstanding payments remain due upon termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Governing Law</h2>
            <p className="mb-4">
              This agreement is governed by the laws of Kenya. Any disputes will be resolved through
              the Kenyan court system with Nairobi as the jurisdiction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
            <p className="mb-4">
              For questions about these terms, please contact us at:
            </p>
            <ul className="list-none pl-0">
              <li>Email: legal@paychainke.com</li>
              <li>Phone: +254 XXX XXX XXX</li>
              <li>Address: Nairobi, Kenya</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;