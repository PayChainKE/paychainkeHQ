const getWelcomeEmailTemplate = (fullName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #000; text-decoration: none; }
    .content { background: #ffffff; border-radius: 8px; }
    h1 { font-size: 24px; font-weight: 800; line-height: 1.2; margin-bottom: 16px; color: #000; }
    p { font-size: 16px; margin-bottom: 24px; color: #4b5563; }
    .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://paychain.co.ke/logo.png" alt="PayChain" style="height: 48px; width: auto;" />
    </div>
    <div class="content">
      <h1>You're on the list, ${fullName}!</h1>
      <p>Thank you for joining the PayChain beta waitlist. We're building the smartest merchant payment OS for Kenyan SMEs, and we're excited to have you with us.</p>
      <p>PayChain will help you collect M-PESA safely, manage bulk payments, and protect your business against inflation with KES→USDC swaps.</p>
      <p>We'll notify you as soon as your spot is ready. In the meantime, feel free to share PayChain with other business owners who are tired of payment fraud and high forex costs.</p>
      <a href="https://paychain.co.ke" class="button">Visit Our Website</a>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} PayChain Kenya. All rights reserved.</p>
      <p>Nairobi, Kenya</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = { getWelcomeEmailTemplate };
