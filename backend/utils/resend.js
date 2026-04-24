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
