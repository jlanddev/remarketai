import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Multi-provider email sending
export async function POST(request) {
  try {
    const { campaign, provider = 'auto' } = await request.json();

    // Auto-detect which provider to use based on environment variables
    let result;

    if (provider === 'resend' || (provider === 'auto' && process.env.RESEND_API_KEY)) {
      result = await sendViaResend(campaign);
    } else if (provider === 'smtp' || (provider === 'auto' && process.env.SMTP_HOST)) {
      result = await sendViaSMTP(campaign);
    } else if (provider === 'gmail' || (provider === 'auto' && process.env.GMAIL_USER)) {
      result = await sendViaGmail(campaign);
    } else {
      // Demo mode - just log
      return demoMode(campaign);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Provider 1: Resend (Recommended for SaaS)
async function sendViaResend(campaign) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
    to: campaign.email.to,
    subject: campaign.email.subject,
    text: campaign.email.body,
    html: formatEmailHTML(campaign.email.body)
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log(`✅ [RESEND] Email sent to ${campaign.email.to}`);

  return {
    success: true,
    provider: 'resend',
    email_id: data.id,
    message: 'Email sent via Resend'
  };
}

// Provider 2: Custom SMTP (Best for users with own mail servers)
async function sendViaSMTP(campaign) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: campaign.email.to,
    subject: campaign.email.subject,
    text: campaign.email.body,
    html: formatEmailHTML(campaign.email.body)
  });

  console.log(`✅ [SMTP] Email sent to ${campaign.email.to}`);

  return {
    success: true,
    provider: 'smtp',
    email_id: info.messageId,
    message: 'Email sent via SMTP'
  };
}

// Provider 3: Gmail (Easy setup, 500/day limit)
async function sendViaGmail(campaign) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // Must use App Password, not regular password
    }
  });

  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: campaign.email.to,
    subject: campaign.email.subject,
    text: campaign.email.body,
    html: formatEmailHTML(campaign.email.body)
  });

  console.log(`✅ [GMAIL] Email sent to ${campaign.email.to}`);

  return {
    success: true,
    provider: 'gmail',
    email_id: info.messageId,
    message: 'Email sent via Gmail'
  };
}

// Demo mode - no email provider configured
function demoMode(campaign) {
  console.log('📧 [DEMO MODE] Email would be sent:');
  console.log(`   To: ${campaign.email.to}`);
  console.log(`   From: ${campaign.visitor_email || 'Not specified'}`);
  console.log(`   Subject: ${campaign.email.subject}`);
  console.log(`   Body Preview: ${campaign.email.body.substring(0, 150)}...`);
  console.log('');
  console.log('💡 To send real emails, configure one of these providers in .env.local:');
  console.log('   - Resend: Add RESEND_API_KEY (recommended, 3k emails/month free)');
  console.log('   - Gmail: Add GMAIL_USER and GMAIL_APP_PASSWORD (500/day free)');
  console.log('   - SMTP: Add SMTP_HOST, SMTP_USER, SMTP_PASSWORD (your mail server)');

  return NextResponse.json({
    success: true,
    demo_mode: true,
    message: 'Email logged (add email provider credentials to actually send)',
    available_providers: [
      {
        name: 'Resend',
        recommended: true,
        free_tier: '3,000 emails/month',
        required_env: ['RESEND_API_KEY', 'FROM_EMAIL'],
        signup: 'https://resend.com'
      },
      {
        name: 'Gmail',
        recommended: false,
        free_tier: '500 emails/day',
        required_env: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
        setup_guide: 'https://support.google.com/accounts/answer/185833'
      },
      {
        name: 'Custom SMTP',
        recommended: true,
        free_tier: 'Depends on provider',
        required_env: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'FROM_EMAIL']
      }
    ]
  });
}

// Convert plain text email to HTML
function formatEmailHTML(text) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9fafb;
        }
        .email-container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          border-bottom: 3px solid #667eea;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h2 {
          margin: 0;
          color: #667eea;
          font-size: 24px;
        }
        .content {
          white-space: pre-wrap;
          font-size: 16px;
          line-height: 1.8;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h2>RemarketAI</h2>
        </div>
        <div class="content">${text.replace(/\n/g, '<br>')}</div>
        <div class="footer">
          <p>This email was automatically generated by RemarketAI based on your website activity.</p>
          <p>Powered by <strong><a href="#">RemarketAI</a></strong> • AI-Powered Remarketing</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
