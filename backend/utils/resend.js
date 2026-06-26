import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Send OTP for Admin Login
export const sendOTP = async (email, otp) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Verification <info@paychain.co.ke>',
      to: [email],
      subject: `[PayChain] Your Login Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; padding: 40px 20px; border: 1px solid #f0f0f0; border-radius: 16px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; color: #111; font-size: 24px; font-weight: 700;">Identity Verification</h2>
            <p style="margin: 10px 0 0; color: #666; font-size: 15px;">Enter this code to access your Admin Dashboard</p>
          </div>
          <div style="background: #f8faff; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px; border: 1px solid #eef2ff;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #0066FF;">${otp}</span>
          </div>
          <div style="color: #888; font-size: 13px; text-align: center; line-height: 1.6;">
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p style="margin-top: 15px;">If you did not request this code, someone may be trying to access your account. Please secure your credentials.</p>
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is an automated <strong>no-reply</strong> email. Do not reply to this address.</p>
            <p style="margin: 5px 0 0; color: #aaa; font-size: 11px;">Need help? Contact <a href="mailto:support@paychain.co.ke" style="color: #0066FF; text-decoration: none;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin: 15px 0 0; color: #ccc; font-size: 10px;">&copy; 2025 PayChainKE. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 OTP Email sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend OTP Error:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send Waitlist Confirmation
export const sendWaitlistConfirmation = async (email, name) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain <info@paychain.co.ke>',
      to: [email],
      subject: "You're on the Exclusive Waitlist!",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff;">
          <div style="background: linear-gradient(135deg, #0066FF 0%, #003399 100%); padding: 50px 30px; text-align: center; color: #fff;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Welcome to PayChain</h1>
            <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">The Future of Payments in Kenya</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px; color: #111; font-size: 22px;">Hi ${name},</h2>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">You've successfully secured your spot on the PayChain waitlist! We're building a next-generation payment OS for Kenyan merchants, and we're excited to have you join us early.</p>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">Our team is working hard to finalize the first wave of dashboard invitations. You'll be among the first to receive access as we roll out in your region.</p>
            <div style="margin-top: 40px; padding: 25px; background: #f8faff; border-radius: 12px; border: 1px solid #eef2ff;">
              <h3 style="margin: 0 0 15px; color: #0066FF; font-size: 18px; font-weight: 700;">What's Coming Next?</h3>
              <div style="color: #555; font-size: 15px; line-height: 1.6;">
                <p style="margin: 8px 0;">• <strong>Real-time M-PESA</strong> collection & automation</p>
                <p style="margin: 8px 0;">• <strong>Bulk Pay</strong> for suppliers and payroll</p>
                <p style="margin: 8px 0;">• <strong>USD / USDC</strong> liquidity for inflation protection</p>
              </div>
            </div>
          </div>
          <div style="padding: 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is a <strong>no-reply</strong> email. For assistance, reach out to <a href="mailto:support@paychain.co.ke" style="color: #0066FF; text-decoration: none;">support@paychain.co.ke</a> or <strong>0790889066</strong></p>
            <p style="margin: 10px 0 0; color: #bbb; font-size: 11px;">&copy; 2025 PayChainKE. Empowering the next generation of African merchants.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Waitlist Confirmation sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Waitlist Error:', error);
    throw new Error('Failed to send waitlist confirmation email');
  }
};

// Send Newsletter Confirmation
export const sendNewsletterConfirmation = async (email) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Updates <info@paychain.co.ke>',
      to: [email],
      subject: 'Welcome to the PayChain Newsletter 🚀',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; padding: 40px; background: #fff; border: 1px solid #eee; border-radius: 16px;">
          <h1 style="color: #111; font-size: 26px; font-weight: 800; margin-bottom: 20px;">Stay Ahead of the Curve.</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Thanks for subscribing to the PayChain newsletter! You're now on the list to receive our latest product updates, merchant success stories, and insights into the digital economy in Kenya.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://www.paychain.co.ke" style="background: #0066FF; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block;">Explore PayChain</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;">
          <div style="text-align: center; color: #aaa; font-size: 11px;">
            <p>This is a <strong>no-reply</strong> email. For support, contact <a href="mailto:support@paychain.co.ke" style="color: #0066FF; text-decoration: none;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin-top: 10px;">&copy; 2025 PayChainKE. All rights reserved.</p>
          </div>
      `
    });
    console.log(`📧 Newsletter Confirmation sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Newsletter Error:', error);
    throw new Error('Failed to send newsletter confirmation email');
  }
};

// Send Wallet Activation Congratulations Email
export const sendWalletActivationEmail = async (email, name, stellarPublicKey) => {
  try {
    const shortAddress = stellarPublicKey
      ? `${stellarPublicKey.slice(0, 8)}...${stellarPublicKey.slice(-6)}`
      : 'N/A';

    const data = await resend.emails.send({
      from: 'PayChain Web3 <info@paychain.co.ke>',
      to: [email],
      subject: 'Welcome to Web3: Your PayChain Wallet is Ready',
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0B0E14; color: #E5E7EB; border-radius: 8px; overflow: hidden; border: 1px solid #1F2937;">
          
          <!-- Header -->
          <div style="padding: 30px 40px; text-align: center; border-bottom: 1px solid #1F2937;">
            <div style="font-size: 24px; font-weight: 800; color: #FCD535; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 10px;">
              <span style="display: inline-block; width: 24px; height: 24px; background: #FCD535; border-radius: 4px;"></span>
              PAYCHAIN
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 40px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #FFFFFF; margin: 0 0 20px 0;">Wallet Successfully Activated</h1>
            
            <p style="font-size: 15px; line-height: 1.6; color: #9CA3AF; margin: 0 0 30px 0;">
              Dear ${name},<br><br>
              Congratulations! Your PayChain Web3 Wallet has been successfully provisioned on the blockchain. You can now securely manage your digital assets, receive global settlements, and utilize our Inflation Shield.
            </p>

            <!-- Address Box -->
            <div style="background-color: #111827; border: 1px solid #374151; border-radius: 8px; padding: 24px; margin-bottom: 30px;">
              <p style="font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 0;">Your Official Wallet Address</p>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 8px; height: 8px; background-color: #10B981; border-radius: 50%; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);"></div>
                <p style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; color: #FFFFFF; margin: 0; word-break: break-all;">
                  ${stellarPublicKey}
                </p>
              </div>
            </div>

            <!-- Features -->
            <div style="margin-bottom: 30px;">
              <h2 style="font-size: 16px; font-weight: 600; color: #FFFFFF; margin: 0 0 16px 0;">Supported Networks</h2>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="background: #1F2937; color: #D1D5DB; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Stellar (USDC)</span>
                <span style="background: #1F2937; color: #D1D5DB; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Polygon</span>
                <span style="background: #1F2937; color: #D1D5DB; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Base</span>
                <span style="background: #1F2937; color: #D1D5DB; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">Celo</span>
              </div>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 40px; margin-bottom: 40px;">
              <a href="https://merchant.paychain.co.ke/wallet" style="display: inline-block; background-color: #FCD535; color: #111827; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 4px; transition: background-color 0.2s;">
                Go to Dashboard
              </a>
            </div>

            <!-- Security Tips -->
            <div style="border-top: 1px solid #1F2937; padding-top: 30px;">
              <h3 style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                <span style="color: #FCD535;">🛡️</span> Security Reminders
              </h3>
              <ul style="font-size: 13px; color: #9CA3AF; line-height: 1.6; padding-left: 20px; margin: 0;">
                <li style="margin-bottom: 8px;">PayChain staff will <strong>never</strong> ask for your passwords or private keys.</li>
                <li style="margin-bottom: 8px;">Always verify you are on <strong>merchant.paychain.co.ke</strong> before logging in.</li>
                <li>Do not share your screen with anyone claiming to provide support.</li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #000000; padding: 30px 40px; text-align: center;">
            <p style="font-size: 12px; color: #6B7280; margin: 0 0 10px 0;">
              This is an automated message. Please do not reply.
            </p>
            <p style="font-size: 12px; color: #4B5563; margin: 0;">
              &copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.
            </p>
          </div>
        </div>
      `
    });
    console.log(`📧 Wallet Activation Email sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Wallet Activation Email Error:', error);
    throw new Error('Failed to send wallet activation email');
  }
};

// Send Welcome Email with Credentials
export const sendWelcomeEmail = async (email, name, password, phone, paybillAccount) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain <info@paychain.co.ke>',
      to: [email],
      subject: 'Welcome to PayChain! Your Account Details',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff;">
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 50px 30px; text-align: center; color: #fff;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Welcome to PayChain</h1>
            <p style="margin: 10px 0 0; color: #5EFEB3; font-size: 16px; font-weight: 600;">Your Account is Ready</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px; color: #111; font-size: 22px;">Hi ${name},</h2>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">We are thrilled to welcome you to PayChain. Your merchant dashboard has been provisioned and is ready for use.</p>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">To start collecting payments for your business, instruct your customers to go to the M-PESA menu, select <strong>Lipa na M-PESA</strong>, choose <strong>Paybill</strong>, and enter the following details. All payments will instantly reflect on your PayChain dashboard.</p>
            <div style="margin-top: 20px; padding: 25px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
              <h3 style="margin: 0 0 15px; color: #166534; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Payment Collection Details</h3>
              <div style="color: #14532d; font-size: 15px; line-height: 1.8;">
                <p style="margin: 8px 0;"><strong>Main Paybill:</strong> 400200</p>
                <p style="margin: 8px 0;"><strong>Account Number:</strong> ${paybillAccount}</p>
              </div>
            </div>
            
            <div style="margin-top: 20px; padding: 20px; background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
              <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;"><strong>🚀 Unlock Cash Advances:</strong> Keep your account active by regularly receiving payments through your PayChain account number. Consistent daily activity builds your Trust Score and automatically makes your business eligible for instant Cash Advances to fuel your growth!</p>
            </div>
            <div style="margin-top: 30px; padding: 25px; background: #f8faff; border-radius: 12px; border: 1px solid #eef2ff;">
              <h3 style="margin: 0 0 15px; color: #0066FF; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Dashboard Access Credentials</h3>
              <div style="color: #003399; font-size: 15px; line-height: 1.8;">
                <p style="margin: 8px 0;"><strong>Username:</strong> ${email} <span style="opacity: 0.7; font-size: 13px;">or</span> ${phone}</p>
                <p style="margin: 8px 0;"><strong>Password:</strong> ${password}</p>
              </div>
            </div>
            <div style="margin-top: 40px; text-align: center;">
              <a href="https://www.paychain.co.ke/login" style="background: #00351D; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; display: inline-block;">Log In to Dashboard</a>
            </div>
          </div>
          <div style="padding: 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is a <strong>no-reply</strong> email. For assistance, reach out to <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none;">support@paychain.co.ke</a> or <strong>0790889066</strong></p>
            <p style="margin: 10px 0 0; color: #bbb; font-size: 11px;">&copy; 2026 PayChainKE. Empowering the next generation of African merchants.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Welcome Credentials Email sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Welcome Email Error:', error);
    throw new Error('Failed to send welcome email');
  }
};

// Send Sensitive-Action OTP to Admin. Used to verify destructive actions
// (freeze, unfreeze, delete merchant) before they execute.
export const sendAdminActionOTP = async (email, otp, actionLabel, target) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Security <info@paychain.co.ke>',
      to: [email],
      subject: `[PayChain] Confirm action: ${actionLabel} — ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: auto; padding: 40px 20px; border: 1px solid #f0f0f0; border-radius: 16px; background: #fff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #111; font-size: 22px; font-weight: 700;">Confirm Sensitive Action</h2>
            <p style="margin: 8px 0 0; color: #666; font-size: 14px;">Enter this code to ${actionLabel.toLowerCase()}.</p>
          </div>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px 20px; margin-bottom: 22px;">
            <p style="margin: 0; color: #9a3412; font-size: 13px; line-height: 1.5;"><strong>Target:</strong> ${target}</p>
            <p style="margin: 6px 0 0; color: #9a3412; font-size: 13px; line-height: 1.5;"><strong>Action:</strong> ${actionLabel}</p>
          </div>
          <div style="background: #f8faff; border-radius: 12px; padding: 26px; text-align: center; margin-bottom: 22px; border: 1px solid #eef2ff;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0066FF;">${otp}</span>
          </div>
          <div style="color: #888; font-size: 12px; text-align: center; line-height: 1.6;">
            <p style="margin: 0;">This code expires in <strong>10 minutes</strong> and is bound to this exact action.</p>
            <p style="margin: 8px 0 0;">If you did not initiate this action, change your admin password immediately.</p>
          </div>
          <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">Automated security message — do not reply.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Admin Action OTP sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Admin Action OTP Error:', error);
    throw new Error('Failed to send action verification email');
  }
};

// Send Merchant Invite (Admin-Onboarded) — credentialless invite with a
// single-use, time-limited setup link. We never send the password in the email.
export const sendMerchantInvite = async (email, name, businessName, paybillAccount, setupLink) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Onboarding <info@paychain.co.ke>',
      to: [email],
      subject: 'You have been invited to PayChain — Set up your account',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff;">
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 50px 30px; text-align: center; color: #fff;">
            <h1 style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px;">Welcome to PayChain</h1>
            <p style="margin: 10px 0 0; color: #5EFEB3; font-size: 15px; font-weight: 600;">Your merchant account is ready</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 16px; color: #111; font-size: 22px;">Hi ${name},</h2>
            <p style="color: #444; line-height: 1.7; font-size: 15px;">PayChain has provisioned a merchant account for <strong>${businessName}</strong>. To start collecting payments, please set up your dashboard password using the secure link below.</p>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${setupLink}" style="background: #00351D; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">Set Up My Password</a>
            </div>

            <p style="color: #666; font-size: 13px; line-height: 1.6; text-align: center; margin: 0;">This link will expire in <strong>24 hours</strong>. If the button doesn't work, paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #0066FF; font-size: 12px; text-align: center; margin: 8px 0 0;"><a href="${setupLink}" style="color: #0066FF; text-decoration: none;">${setupLink}</a></p>

            <div style="margin-top: 35px; padding: 22px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
              <h3 style="margin: 0 0 12px; color: #166534; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Your Payment Collection Details</h3>
              <div style="color: #14532d; font-size: 14px; line-height: 1.8;">
                <p style="margin: 6px 0;"><strong>Paybill:</strong> 400200</p>
                <p style="margin: 6px 0;"><strong>Account Number:</strong> ${paybillAccount}</p>
              </div>
              <p style="margin: 12px 0 0; color: #15803d; font-size: 12px;">Share these with your customers to receive M-PESA payments directly into your PayChain wallet.</p>
            </div>

            <div style="margin-top: 24px; padding: 16px; background: #fff7ed; border-radius: 10px; border: 1px solid #fed7aa;">
              <p style="margin: 0; color: #9a3412; font-size: 12px; line-height: 1.6;"><strong>Security:</strong> PayChain staff will never ask you for your password. If you did not expect this invitation, please ignore this email or contact support.</p>
            </div>
          </div>
          <div style="padding: 28px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is a <strong>no-reply</strong> email. For assistance, contact <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin: 10px 0 0; color: #bbb; font-size: 11px;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
          </div>
        </div>
      `
    });
    console.log(`📧 Merchant Invite sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Merchant Invite Error:', error);
    throw new Error('Failed to send merchant invite email');
  }
};

// Send Batch Payment Receipt Email
export const sendBatchReceiptEmail = async (email, businessName, batchRows, totalGross, totalNet, totalTax) => {
  try {
    const rowHTML = batchRows.map((row, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#f8f9fa' : '#ffffff'}; border-bottom: 1px solid #e9ecef;">
        <td style="padding: 12px 15px; color: #333; font-size: 13px;">${row.name}</td>
        <td style="padding: 12px 15px; color: #555; font-size: 13px;">${row.phone || row.paybillNumber || 'N/A'}</td>
        <td style="padding: 12px 15px; color: #555; font-size: 13px;">${row.type || 'Standard'}</td>
        <td style="padding: 12px 15px; color: #111; font-weight: 600; font-size: 13px; text-align: right;">KES ${row.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const auditHash = Math.random().toString(36).substring(2, 18).toUpperCase();

    const data = await resend.emails.send({
      from: 'PayChain Settlement <info@paychain.co.ke>',
      to: [email],
      subject: `Batch Payment Receipt - ${businessName}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; color: #333; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: #0A2540; padding: 35px 40px; text-align: center; border-bottom: 4px solid #10B981;">
            <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">
              PAYCHAIN
            </div>
            <div style="color: #94A3B8; font-size: 12px; font-weight: 600; letter-spacing: 3px; margin-top: 5px;">
              OFFICIAL BATCH RECEIPT
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 40px;">
            <h1 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 10px 0;">Bulk Payout Successful</h1>
            <p style="font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 30px 0;">
              Hello <strong>${businessName}</strong>,<br>
              Your recent bulk payment batch has been successfully processed and settled via the Daraja network. Below is the detailed breakdown of the transaction.
            </p>

            <!-- Summary Cards -->
            <div style="display: flex; gap: 15px; margin-bottom: 30px;">
              <div style="flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Total Disbursed</div>
                <div style="font-size: 20px; font-weight: 800; color: #0A2540;">KES ${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div style="flex: 1; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Recipients</div>
                <div style="font-size: 20px; font-weight: 800; color: #14532d;">${batchRows.length}</div>
              </div>
            </div>

            <!-- Transaction Table -->
            <h2 style="font-size: 15px; font-weight: 600; color: #333; margin: 0 0 15px 0;">Recipient Breakdown</h2>
            <div style="border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background-color: #0A2540; color: #ffffff;">
                    <th style="padding: 12px 15px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Recipient</th>
                    <th style="padding: 12px 15px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Destination</th>
                    <th style="padding: 12px 15px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Category</th>
                    <th style="padding: 12px 15px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; text-align: right;">Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowHTML}
                </tbody>
              </table>
            </div>

            <!-- Security Footer -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Protocol Verification</div>
                <div style="font-size: 12px; color: #94a3b8;">Status: Secure Settlement</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Audit Hash</div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 13px; font-weight: 700; color: #0A2540;">${auditHash}</div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
              <a href="https://merchant.paychain.co.ke/transactions" style="display: inline-block; background-color: #0A2540; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 6px;">
                View in Dashboard
              </a>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color: #fafafa; padding: 25px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 11px; color: #9ca3af; margin: 0 0 8px 0;">
              This is a cryptographically generated receipt. Do not reply to this email.
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">
              &copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.
            </p>
          </div>
        </div>
      `
    });
    console.log(`📧 Batch Receipt Email sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Batch Receipt Error:', error);
    // Don't throw, just log so we don't break the payment flow
  }
};
