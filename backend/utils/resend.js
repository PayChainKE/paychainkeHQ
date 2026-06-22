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
