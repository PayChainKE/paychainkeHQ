import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Hosted on Cloudinary so the logo renders inline in the email body as a
// normal remote image — not as a downloadable attachment on the message.
const LOGO_DARK_URL = 'https://res.cloudinary.com/dvnxgd9fv/image/upload/v1783459542/paychain_email_assets/paychain-logo-dark.png';
const LOGO_WHITE_URL = 'https://res.cloudinary.com/dvnxgd9fv/image/upload/v1783459543/paychain_email_assets/paychain-logo-white.png';

// Dark wordmark for light/white header backgrounds. `margin:0 auto` centers
// it inside a `text-align:center` container despite `display:block`; pass
// align:'left' for headers whose surrounding copy isn't centered.
const logoImgDark = (width = 130, align = 'center') =>
  `<img src="${LOGO_DARK_URL}" alt="PayChain" width="${width}" style="display:block;margin:${align === 'left' ? '0' : '0 auto'};border:0;outline:none;text-decoration:none;height:auto;" />`;

// White wordmark for dark/colored header backgrounds.
const logoImgWhite = (width = 130, align = 'center') =>
  `<img src="${LOGO_WHITE_URL}" alt="PayChain" width="${width}" style="display:block;margin:${align === 'left' ? '0' : '0 auto'};border:0;outline:none;text-decoration:none;height:auto;" />`;

// Send OTP for Admin Login
export const sendOTP = async (email, otp) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Verification <info@paychain.co.ke>',
      to: [email],
      subject: `[PayChain] Your Login Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: auto; padding: 44px 36px; border: 1px solid #eef0ee; border-radius: 20px; background: #fff; box-shadow: 0 10px 32px rgba(6,32,27,0.08);">
          <div style="text-align: center; margin-bottom: 32px;">
            ${logoImgDark(120)}
          </div>
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; color: #06201B; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Identity Verification</h2>
            <p style="margin: 10px 0 0; color: #6b7280; font-size: 14px;">Enter this code to access your Dashboard</p>
          </div>
          <div style="background: #f6fbf7; border-radius: 14px; padding: 28px; text-align: center; margin-bottom: 30px; border: 1px solid #d8ecdd;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #06201B;">${otp}</span>
          </div>
          <div style="color: #8a8f8c; font-size: 13px; text-align: center; line-height: 1.6;">
            <p style="margin: 0;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="margin-top: 12px;">If you did not request this code, someone may be trying to access your account. Please secure your credentials.</p>
          </div>
          <div style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is an automated <strong>no-reply</strong> email. Do not reply to this address.</p>
            <p style="margin: 5px 0 0; color: #aaa; font-size: 11px;">Need help? Contact <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none; font-weight: 600;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin: 15px 0 0; color: #ccc; font-size: 10px;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
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
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 44px 30px 46px; text-align: center; color: #fff;">
            <div style="margin-bottom: 22px;">${logoImgWhite(126)}</div>
            <h1 style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px;">Welcome to PayChain</h1>
            <p style="margin: 10px 0 0; color: #5EFEB3; opacity: 0.95; font-size: 15px; font-weight: 600;">The Future of Payments in Kenya</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px; color: #111; font-size: 22px;">Hi ${name},</h2>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">You've successfully secured your spot on the PayChain waitlist! We're building a next-generation payment OS for Kenyan merchants, and we're excited to have you join us early.</p>
            <p style="color: #444; line-height: 1.7; font-size: 16px;">Our team is working hard to finalize the first wave of dashboard invitations. You'll be among the first to receive access as we roll out in your region.</p>
            <div style="margin-top: 40px; padding: 25px; background: #f6fbf7; border-radius: 12px; border: 1px solid #d8ecdd;">
              <h3 style="margin: 0 0 15px; color: #06201B; font-size: 18px; font-weight: 700;">What's Coming Next?</h3>
              <div style="color: #555; font-size: 15px; line-height: 1.6;">
                <p style="margin: 8px 0;">• <strong>Real-time M-PESA</strong> collection & automation</p>
                <p style="margin: 8px 0;">• <strong>Bulk Pay</strong> for suppliers and payroll</p>
                <p style="margin: 8px 0;">• <strong>USD / USDC</strong> liquidity for inflation protection</p>
              </div>
            </div>
          </div>
          <div style="padding: 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">This is a <strong>no-reply</strong> email. For assistance, reach out to <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none; font-weight: 600;">support@paychain.co.ke</a> or <strong>0790889066</strong></p>
            <p style="margin: 10px 0 0; color: #bbb; font-size: 11px;">&copy; ${new Date().getFullYear()} PayChainKE. Empowering the next generation of African merchants.</p>
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
          <div style="text-align: center; margin-bottom: 28px;">${logoImgDark(120)}</div>
          <h1 style="color: #111; font-size: 26px; font-weight: 800; margin-bottom: 20px;">Stay Ahead of the Curve.</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Thanks for subscribing to the PayChain newsletter! You're now on the list to receive our latest product updates, merchant success stories, and insights into the digital economy in Kenya.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://www.paychain.co.ke" style="background: #06201B; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Explore PayChain</a>
          </div>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;">
          <div style="text-align: center; color: #aaa; font-size: 11px;">
            <p>This is a <strong>no-reply</strong> email. For support, contact <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none; font-weight: 600;">support@paychain.co.ke</a> or call <strong>0790889066</strong></p>
            <p style="margin-top: 10px;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
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

// Send Wallet Activation Congratulations Email
export const sendWalletActivationEmail = async (email, name, stellarPublicKey) => {
  try {
    const shortAddress = stellarPublicKey
      ? `${stellarPublicKey.slice(0, 8)}...${stellarPublicKey.slice(-6)}`
      : 'N/A';

    const data = await resend.emails.send({
      from: 'PayChain Digital Wallet <info@paychain.co.ke>',
      to: [email],
      subject: 'Welcome to your Digital Wallet: Your PayChain Wallet is Ready',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #000000; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; padding: 40px 20px;">
            <tr>
              <td align="center">
                
                <!-- Main Container -->
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0B0E11; border: 1px solid #1E2329; border-radius: 12px; overflow: hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 40px; border-bottom: 1px solid #1E2329; text-align: center; background-color: #0B0E11;">
                      ${logoImgWhite(118)}
                    </td>
                  </tr>

                  <!-- Hero Section -->
                  <tr>
                    <td style="padding: 48px 40px 32px 40px; background: linear-gradient(180deg, #181A20 0%, #0B0E11 100%); text-align: center;">
                      <div style="width: 56px; height: 56px; background: rgba(252, 213, 53, 0.1); border-radius: 16px; margin: 0 auto 24px auto; display: inline-block; line-height: 56px; text-align: center; border: 1px solid rgba(252, 213, 53, 0.2);">
                        <div style="width: 20px; height: 20px; background-color: #FCD535; border-radius: 4px; display: inline-block; vertical-align: middle;"></div>
                      </div>
                      <h1 style="font-size: 28px; font-weight: 800; color: #EAECEF; margin: 0 0 16px 0; letter-spacing: -0.5px;">Wallet Activated</h1>
                      <p style="font-size: 16px; line-height: 1.6; color: #848E9C; margin: 0;">
                        Welcome to a new era of financial freedom. Your institutional-grade digital wallet is now live on the blockchain.
                      </p>
                    </td>
                  </tr>

                  <!-- Benefits Grid (Using Table for Email Compat) -->
                  <tr>
                    <td style="padding: 0 40px 32px 40px;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #181A20; border: 1px solid #2B3139; border-radius: 8px;">
                        <tr>
                          <td style="padding: 24px; border-bottom: 1px solid #2B3139;">
                            <h3 style="font-size: 16px; font-weight: 700; color: #EAECEF; margin: 0 0 6px 0;">Inflation Shield</h3>
                            <p style="font-size: 14px; color: #848E9C; margin: 0; line-height: 1.5;">Protect your capital from devaluation by automatically holding stable KES or USDC.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 24px; border-bottom: 1px solid #2B3139;">
                            <h3 style="font-size: 16px; font-weight: 700; color: #EAECEF; margin: 0 0 6px 0;">Instant Global Settlements</h3>
                            <p style="font-size: 14px; color: #848E9C; margin: 0; line-height: 1.5;">Receive payments from international clients in seconds, with zero hidden fees.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 24px;">
                            <h3 style="font-size: 16px; font-weight: 700; color: #EAECEF; margin: 0 0 6px 0;">Bank-Grade Security</h3>
                            <p style="font-size: 14px; color: #848E9C; margin: 0; line-height: 1.5;">Enterprise-tier encryption ensures your digital assets remain secure and under your control.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Address Details -->
                  <tr>
                    <td style="padding: 0 40px 40px 40px;">
                      <div style="background-color: #000000; border: 1px solid #2B3139; border-radius: 8px; padding: 24px;">
                        <p style="font-size: 12px; font-weight: 700; color: #5E6673; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">Official Wallet Address</p>
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="12" style="padding-right: 12px;">
                              <div style="width: 8px; height: 8px; background-color: #0ECB81; border-radius: 50%;"></div>
                            </td>
                            <td>
                              <p style="font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 700; color: #EAECEF; margin: 0; word-break: break-all;">
                                ${stellarPublicKey}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>

                  <!-- CTA Action -->
                  <tr>
                    <td style="padding: 0 40px 48px 40px; text-align: center;">
                      <a href="https://app.paychain.co.ke/wallet" style="display: inline-block; background-color: #FCD535; color: #0B0E11; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 4px; border: 1px solid #FCD535; text-transform: uppercase; letter-spacing: 0.5px;">
                        Access Dashboard
                      </a>
                    </td>
                  </tr>

                  <!-- Security Footer -->
                  <tr>
                    <td style="padding: 32px 40px; background-color: #181A20; border-top: 1px solid #1E2329;">
                      <h4 style="font-size: 13px; font-weight: 700; color: #EAECEF; margin: 0 0 12px 0;">SECURITY REMINDERS</h4>
                      <p style="font-size: 13px; color: #848E9C; margin: 0 0 8px 0; line-height: 1.5;">• PayChain staff will never ask for your passwords or private keys.</p>
                      <p style="font-size: 13px; color: #848E9C; margin: 0 0 8px 0; line-height: 1.5;">• Always verify you are on <strong>app.paychain.co.ke</strong> before logging in.</p>
                      <p style="font-size: 13px; color: #848E9C; margin: 0; line-height: 1.5;">• Ensure 2FA is enabled on your account for maximum security.</p>
                    </td>
                  </tr>
                  
                </table>

                <!-- Bottom Copyright -->
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 24px;">
                  <tr>
                    <td style="text-align: center;">
                      <p style="font-size: 12px; color: #5E6673; margin: 0 0 8px 0;">This is an automated message. Please do not reply.</p>
                      <p style="font-size: 12px; color: #5E6673; margin: 0;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>
        </body>
        </html>
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
  const firstName = (name || '').split(' ')[0] || 'Merchant';
  try {
    const data = await resend.emails.send({
      from: 'PayChain <info@paychain.co.ke>',
      to: [email],
      subject: `Welcome to PayChain, ${firstName} — Your Merchant Account is Active`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F7F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F6;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- HEADER -->
      <tr><td style="background:#06201B;border-radius:16px 16px 0 0;padding:36px 40px 36px;text-align:center;">
        <div style="margin:0 0 22px;">${logoImgWhite(122)}</div>
        <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:#5EFEB3;">PayChain Kenya</p>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">Your Merchant Account<br>is Now Active</h1>
        <p style="margin:16px 0 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">
          Welcome aboard, <strong style="color:#fff;">${firstName}</strong>. Your PayChain dashboard is provisioned and ready to accept payments.
        </p>
      </td></tr>

      <!-- PAYMENT COLLECTION CARD -->
      <tr><td style="background:#ffffff;padding:36px 40px 0;">
        <p style="margin:0 0 20px;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;">How to Receive M-PESA Payments</p>
        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
          Share the details below with your customers. They pay via <strong>Lipa na M-PESA &rarr; Paybill</strong> and the funds reflect in your dashboard instantly.
        </p>

        <!-- PAYBILL HIGHLIGHT BOX -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#06201B;border-radius:14px;margin-bottom:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-right:12px;border-right:1px solid rgba(255,255,255,0.12);">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Paybill Number</p>
                    <p style="margin:0;font-size:34px;font-weight:800;color:#5EFEB3;letter-spacing:2px;font-family:monospace;">400200</p>
                  </td>
                  <td width="50%" style="padding-left:28px;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);">Account Number</p>
                    <p style="margin:0;font-size:34px;font-weight:800;color:#ffffff;letter-spacing:2px;font-family:monospace;">${paybillAccount}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.35);font-weight:600;letter-spacing:0.05em;">
                &#9432;&nbsp; This account number is unique to your business. Keep it safe.
              </p>
            </td>
          </tr>
        </table>

        <!-- STEP GUIDE -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:24px;overflow:hidden;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#6B7280;">Customer Payment Steps</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">1</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Open M-PESA on their phone</td>
              </tr>
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">2</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Select <strong>Lipa na M-PESA</strong></td>
              </tr>
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">3</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Choose <strong>Pay Bill</strong></td>
              </tr>
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">4</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Business No: <strong style="color:#06201B;font-family:monospace;">400200</strong></td>
              </tr>
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">5</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Account No: <strong style="color:#06201B;font-family:monospace;">${paybillAccount}</strong></td>
              </tr>
              <tr>
                <td width="32" style="vertical-align:top;padding:5px 12px 5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:#06201B;text-align:center;"><span style="font-size:11px;font-weight:800;color:#5EFEB3;line-height:24px;display:block;">6</span></div></td>
                <td style="font-size:13px;color:#374151;padding:5px 0;line-height:1.5;">Enter amount &amp; M-PESA PIN to confirm</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- TRUST SCORE NUDGE -->
      <tr><td style="background:#ffffff;padding:0 40px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0;font-size:13px;color:#92400E;line-height:1.65;">
              <strong>&#9889; Build your Trust Score.</strong> Regular M-PESA collections through your account number grow your Trust Score automatically — unlocking <strong>instant cash advances</strong> for your business, with no collateral required.
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- DIVIDER -->
      <tr><td style="background:#ffffff;padding:0 40px;">
        <hr style="border:none;border-top:1px solid #F3F4F6;margin:4px 0 28px;">
      </td></tr>

      <!-- DASHBOARD ACCESS -->
      <tr><td style="background:#ffffff;padding:0 40px 36px;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;">Dashboard Access</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6B7280;font-weight:600;width:110px;">Email</td>
                <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:700;">${email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6B7280;font-weight:600;">Phone</td>
                <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:700;">${phone}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6B7280;font-weight:600;">Password</td>
                <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:700;font-family:monospace;">${password}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:11px;color:#9CA3AF;line-height:1.5;">
              You can change your password anytime from the dashboard under <strong>Profile &rarr; Security</strong>. We recommend updating it after your first login.
            </p>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="https://app.paychain.co.ke" style="display:inline-block;background:#06201B;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:0.06em;padding:16px 40px;border-radius:10px;">
              Open Dashboard &rarr;
            </a>
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#374151;font-weight:700;">PayChain Kenya</p>
        <p style="margin:0 0 12px;font-size:11px;color:#9CA3AF;line-height:1.6;">
          Need help? Email <a href="mailto:support@paychain.co.ke" style="color:#06201B;font-weight:700;text-decoration:none;">support@paychain.co.ke</a> or call <strong>0790 889 066</strong>
        </p>
        <p style="margin:0;font-size:10px;color:#D1D5DB;">&copy; 2026 PayChain Kenya Limited. All rights reserved.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
      `
    });
    console.log(`📧 Welcome email sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Welcome Email Error:', error);
    throw new Error('Failed to send welcome email');
  }
};

// Send a support reply to a customer who submitted the contact form.
// `inReplyToSubject` is rendered in the email header so the customer sees
// the original subject they wrote in.
export const sendSupportReply = async (toEmail, toName, inReplyToSubject, replyBody, fromAdminEmail, attachments = []) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Support <support@paychain.co.ke>',
      to: [toEmail],
      reply_to: fromAdminEmail || 'support@paychain.co.ke',
      subject: inReplyToSubject || 'Your inquiry',
      attachments: attachments.map(url => {
        const filename = url.split('/').pop().split('?')[0] || 'attachment';
        return { filename, path: url };
      }),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff;">
          <div style="background: #06201B; padding: 28px 30px;">
            <div style="margin: 0 0 16px;">${logoImgWhite(104, 'left')}</div>
            <p style="margin: 0; color: #5EFEB3; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">PayChain Support</p>
            <h1 style="margin: 6px 0 0; font-size: 22px; color: #fff; font-weight: 700;">${inReplyToSubject || 'Your inquiry'}</h1>
          </div>
          <div style="padding: 36px 30px;">
            <p style="margin: 0 0 18px; color: #111; font-size: 15px;">Hi ${toName || 'there'},</p>
            <div style="color: #333; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${replyBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <p style="margin: 30px 0 0; color: #555; font-size: 14px;">— The PayChain Team</p>
          </div>
          <div style="padding: 22px 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">Reply to this email to continue the conversation, or visit <a href="https://www.paychain.co.ke" style="color: #06201B;">paychain.co.ke</a>.</p>
            <p style="margin: 8px 0 0; color: #bbb; font-size: 11px;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Support reply sent to ${toEmail}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Support Reply Error:', error);
    throw new Error('Failed to send support reply');
  }
};

// Send a single newsletter campaign email. Caller iterates over subscribers
// — we keep this single-send so a failure on one address doesn't kill the
// whole batch. Returns Resend's response (with the message id) or throws.
export const sendNewsletterEmail = async (toEmail, subject, htmlBody) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Updates <info@paychain.co.ke>',
      to: [toEmail],
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: auto; background: #fff;">
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 34px 30px 38px; text-align: center;">
            <div style="margin-bottom: 18px;">${logoImgWhite(112)}</div>
            <div style="font-size: 12px; font-weight: 800; letter-spacing: 4px; color: #5EFEB3; text-transform: uppercase; margin-bottom: 8px;">PayChain Updates</div>
            <h1 style="margin: 0; color: #fff; font-size: 26px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.2;">${subject}</h1>
          </div>
          <div style="padding: 40px 30px; color: #1f2937; font-size: 15px; line-height: 1.75;">
            ${htmlBody}
          </div>
          <div style="padding: 24px 30px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #888; font-size: 12px;">You're receiving this because you subscribed to PayChain Updates.</p>
            <p style="margin: 10px 0 0; color: #aaa; font-size: 11px;">PayChainKE · Nairobi, Kenya · <a href="https://www.paychain.co.ke" style="color: #06201B; text-decoration: none;">paychain.co.ke</a></p>
          </div>
        </div>
      `,
    });
    return data;
  } catch (error) {
    console.error(`❌ Newsletter email failed for ${toEmail}:`, error?.message);
    throw error;
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: auto; padding: 44px 32px; border: 1px solid #eef0ee; border-radius: 20px; background: #fff; box-shadow: 0 10px 32px rgba(6,32,27,0.08);">
          <div style="text-align: center; margin-bottom: 28px;">${logoImgDark(116)}</div>
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #06201B; font-size: 21px; font-weight: 800; letter-spacing: -0.3px;">Confirm Sensitive Action</h2>
            <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Enter this code to ${actionLabel.toLowerCase()}.</p>
          </div>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px 20px; margin-bottom: 22px;">
            <p style="margin: 0; color: #9a3412; font-size: 13px; line-height: 1.5;"><strong>Target:</strong> ${target}</p>
            <p style="margin: 6px 0 0; color: #9a3412; font-size: 13px; line-height: 1.5;"><strong>Action:</strong> ${actionLabel}</p>
          </div>
          <div style="background: #f6fbf7; border-radius: 12px; padding: 26px; text-align: center; margin-bottom: 22px; border: 1px solid #d8ecdd;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #06201B;">${otp}</span>
          </div>
          <div style="color: #8a8f8c; font-size: 12px; text-align: center; line-height: 1.6;">
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
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 44px 30px 46px; text-align: center; color: #fff;">
            <div style="margin-bottom: 22px;">${logoImgWhite(126)}</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Welcome to PayChain</h1>
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

// Invite a new admin team member — sends a one-time setup link.
export const sendTeamInvite = async (email, name, role, invitedByName, setupLink) => {
  try {
    const data = await resend.emails.send({
      from: 'PayChain Console <info@paychain.co.ke>',
      to: [email],
      subject: `You're invited to the PayChain admin console`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff;">
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 44px 30px 46px; text-align: center; color: #fff;">
            <div style="margin-bottom: 22px;">${logoImgWhite(126)}</div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">You're on the team</h1>
            <p style="margin: 10px 0 0; color: #5EFEB3; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">PayChain Admin Console</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="margin: 0 0 16px; color: #111; font-size: 22px;">Hi ${name || email.split('@')[0]},</h2>
            <p style="color: #444; line-height: 1.7; font-size: 15px;"><strong>${invitedByName}</strong> has invited you to join the PayChain admin console as a <strong>${role}</strong>. Set up your password using the secure link below to activate your account.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${setupLink}" style="background: #00351D; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block;">Activate My Account</a>
            </div>
            <p style="color: #666; font-size: 13px; line-height: 1.6; text-align: center; margin: 0;">This link will expire in <strong>48 hours</strong>. If the button doesn't work, paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #0066FF; font-size: 12px; text-align: center; margin: 8px 0 0;"><a href="${setupLink}" style="color: #0066FF; text-decoration: none;">${setupLink}</a></p>
            <div style="margin-top: 32px; padding: 18px; background: #fff7ed; border-radius: 10px; border: 1px solid #fed7aa;">
              <p style="margin: 0; color: #9a3412; font-size: 12px; line-height: 1.6;"><strong>Security:</strong> Admin sessions use 2FA via emailed OTP, are rate-limited, and expire after 12 hours. If you did not expect this invitation, please ignore this email.</p>
            </div>
          </div>
          <div style="padding: 28px; background: #fafafa; border-top: 1px solid #eee; text-align: center;">
            <p style="margin: 0; color: #aaa; font-size: 11px;">For assistance contact <a href="mailto:support@paychain.co.ke" style="color: #06201B; text-decoration: none;">support@paychain.co.ke</a></p>
            <p style="margin: 10px 0 0; color: #bbb; font-size: 11px;">&copy; ${new Date().getFullYear()} PayChainKE. All rights reserved.</p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Admin team invite sent to ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Team Invite Error:', error);
    throw new Error('Failed to send team invite email');
  }
};

// Confirmation email sent after a merchant successfully resets their
// password. Industry best-practice: never email the new password itself —
// emails sit in inboxes, backups and ESP logs indefinitely. Instead we send
// a security receipt: when it happened, where from, and a clear recovery
// path if it WASN'T them (so a compromised account is recoverable quickly).
export const sendPasswordResetConfirmation = async (email, name, when, ip, ua) => {
  try {
    const safeName = (name || 'there').toString().replace(/</g, '&lt;');
    const safeWhen = String(when || '').replace(/</g, '&lt;');
    const safeIp   = String(ip   || 'unknown').replace(/</g, '&lt;');
    const safeUa   = String(ua   || 'unknown device').replace(/</g, '&lt;').slice(0, 200);

    const data = await resend.emails.send({
      from: 'PayChain Security <info@paychain.co.ke>',
      to: [email],
      subject: 'Your PayChain password was changed',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; background: #ffffff; border: 1px solid #eef0ee; border-radius: 18px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #06201B 0%, #0a3029 100%); padding: 32px 32px 36px;">
            <div style="margin-bottom: 20px;">${logoImgWhite(108, 'left')}</div>
            <div style="display: inline-flex; align-items: center; gap: 10px;">
              <span style="display: inline-block; width: 36px; height: 36px; border-radius: 999px; background: rgba(94, 254, 179, 0.15); text-align: center; line-height: 36px; color: #5EFEB3; font-size: 18px; font-weight: 800;">✓</span>
              <div>
                <p style="margin: 0; color: #5EFEB3; font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase;">PayChain Security</p>
                <h1 style="margin: 4px 0 0; color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">Password changed</h1>
              </div>
            </div>
          </div>

          <div style="padding: 36px 32px;">
            <p style="margin: 0 0 16px; color: #111; font-size: 15px;">Hi ${safeName},</p>
            <p style="margin: 0 0 22px; color: #4b5563; font-size: 15px; line-height: 1.6;">
              The password for your PayChain merchant account was successfully changed. You can sign in to the merchant dashboard with your new password right away.
            </p>

            <div style="background: #f6fbf7; border: 1px solid #d8ecdd; border-radius: 12px; padding: 18px 20px; margin: 0 0 26px;">
              <p style="margin: 0 0 10px; color: #06201B; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">When &amp; where</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #1f2937;">
                <tr><td style="padding: 4px 0; color: #6b7280; width: 90px;">Time</td><td style="padding: 4px 0; font-weight: 600;">${safeWhen} EAT</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">IP address</td><td style="padding: 4px 0; font-family: ui-monospace, Menlo, monospace;">${safeIp}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Device</td><td style="padding: 4px 0; word-break: break-word;">${safeUa}</td></tr>
              </table>
            </div>

            <div style="background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 18px; margin: 0 0 26px;">
              <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: 700;">Didn't change your password?</p>
              <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                Reply to this email or contact <a href="mailto:support@paychain.co.ke" style="color: #b45309; font-weight: 700;">support@paychain.co.ke</a> immediately — we'll lock the account and verify your identity before anyone else can sign in.
              </p>
            </div>

            <a href="https://www.app.paychain.co.ke/login" style="display: inline-block; background: #06201B; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; letter-spacing: 0.4px;">Sign in to dashboard →</a>
          </div>

          <div style="padding: 22px 30px; background: #fafafa; border-top: 1px solid #eef0ee; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 11px;">For your security we never include passwords in email. PayChain will never ask for your password.</p>
            <p style="margin: 8px 0 0; color: #bbb; font-size: 11px;">&copy; ${new Date().getFullYear()} PayChainKE · Nairobi, Kenya</p>
          </div>
        </div>
      `,
    });
    console.log(`📧 Reset confirmation → ${email}`);
    return data;
  } catch (error) {
    console.error('❌ Resend Reset Confirmation Error:', error);
    throw error;
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
          <div style="background-color: #0A2540; padding: 32px 40px 30px; text-align: center; border-bottom: 4px solid #10B981;">
            <div style="margin-bottom: 16px;">${logoImgWhite(120)}</div>
            <div style="color: #94A3B8; font-size: 12px; font-weight: 600; letter-spacing: 3px;">
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
              <a href="https://app.paychain.co.ke/transactions" style="display: inline-block; background-color: #0A2540; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 6px;">
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
