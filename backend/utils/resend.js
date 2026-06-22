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
      from: 'PayChain Wallet <info@paychain.co.ke>',
      to: [email],
      subject: '🎉 Congratulations! Your PayChain Digital Wallet is Live',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: auto; border-radius: 20px; overflow: hidden; background: #fff; border: 1px solid #eee;">
          <!-- Hero Banner -->
          <div style="background: linear-gradient(135deg, #0F141E 0%, #0a2540 60%, #00351D 100%); padding: 60px 30px; text-align: center; color: #fff; position: relative;">
            <div style="display: inline-block; background: rgba(53,208,127,0.15); border: 1px solid rgba(53,208,127,0.3); border-radius: 50px; padding: 8px 20px; margin-bottom: 20px;">
              <span style="color: #35D07F; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">Blockchain Wallet Activated</span>
            </div>
            <h1 style="margin: 0; font-size: 36px; font-weight: 900; letter-spacing: -1px; line-height: 1.1;">Congratulations, ${name}! 🎉</h1>
            <p style="margin: 14px 0 0; color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6;">Your Web3 Digital Wallet is now live on the PayChain network.</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">Your unique blockchain wallet has been provisioned and is ready for global USDC settlements. Below is your official wallet address — keep it safe and share it to receive payments from anywhere in the world.</p>

            <!-- Wallet Address Card -->
            <div style="background: #0F141E; border-radius: 16px; padding: 28px; margin-bottom: 28px; position: relative; overflow: hidden;">
              <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: rgba(39,117,202,0.15); border-radius: 50%; filter: blur(30px);"></div>
              <p style="color: #8B98A9; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 12px;">Your Wallet Address</p>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #35D07F; box-shadow: 0 0 12px rgba(53,208,127,0.6);"></div>
                <p style="color: #fff; font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; letter-spacing: 1px; margin: 0; word-break: break-all;">${stellarPublicKey}</p>
              </div>
              <p style="color: #8B98A9; font-size: 11px; margin: 12px 0 0;">Short address: <strong style="color: #2775CA;">${shortAddress}</strong></p>
            </div>

            <!-- Supported Networks -->
            <div style="background: #f8faff; border-radius: 14px; padding: 22px; border: 1px solid #eef2ff; margin-bottom: 28px;">
              <p style="color: #0052b4; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 14px;">Supported Networks</p>
              <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #dbeafe; border-radius: 30px; padding: 8px 14px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #35D07F;"></div>
                  <span style="color: #1e40af; font-size: 12px; font-weight: 700;">Celo</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #dbeafe; border-radius: 30px; padding: 8px 14px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #0052FF;"></div>
                  <span style="color: #1e40af; font-size: 12px; font-weight: 700;">Base</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #dbeafe; border-radius: 30px; padding: 8px 14px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #8247E5;"></div>
                  <span style="color: #1e40af; font-size: 12px; font-weight: 700;">Polygon</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #dbeafe; border-radius: 30px; padding: 8px 14px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #2775CA;"></div>
                  <span style="color: #1e40af; font-size: 12px; font-weight: 700;">Stellar / USDC</span>
                </div>
              </div>
            </div>

            <!-- What You Can Do Now -->
            <div style="margin-bottom: 32px;">
              <p style="color: #111; font-size: 16px; font-weight: 700; margin: 0 0 14px;">What you can do now:</p>
              <div style="color: #555; font-size: 14px; line-height: 2;">
                <p style="margin: 4px 0;">🔄 <strong>Swap KES to USDC</strong> — Convert your M-PESA collections instantly</p>
                <p style="margin: 4px 0;">🛡️ <strong>Inflation Shield</strong> — Protect your earnings from currency devaluation</p>
                <p style="margin: 4px 0;">🌍 <strong>Global Settlements</strong> — Send & receive USDC from anywhere in the world</p>
                <p style="margin: 4px 0;">📊 <strong>QR Settlement Tool</strong> — Share your wallet QR for easy payments</p>
              </div>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 36px;">
              <a href="https://merchant.paychain.co.ke/wallet" style="display: inline-block; background: linear-gradient(135deg, #00351D 0%, #005c30 100%); color: #fff; padding: 18px 40px; text-decoration: none; border-radius: 14px; font-weight: 800; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 8px 24px rgba(0,53,29,0.3);">
                Open My Wallet Dashboard →
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 28px 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is a <strong>no-reply</strong> email. For assistance, contact <a href="mailto:support@paychain.co.ke" style="color: #00351D; text-decoration: none;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin: 8px 0 0; color: #bbb; font-size: 10px;">&copy; 2026 PayChainKE. Empowering the next generation of African merchants.</p>
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
