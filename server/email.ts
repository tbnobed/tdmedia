import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not found in environment variables. Email functionality will not work.');
}

interface EmailOptions {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await sgMail.send(options);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send a welcome email to a new client
 */
export async function sendWelcomeEmail(
  email: string, 
  username: string, 
  password: string, 
  senderEmail = process.env.SENDGRID_FROM_EMAIL || 'alerts@obedtv.com',
  appDomain = process.env.APP_DOMAIN || 'tdev.obdtv.com'
): Promise<boolean> {
  const subject = 'Welcome to Trilogy Digital Media';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0f172a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Trilogy Digital Media</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <h2>Welcome, ${username}!</h2>
        <p>Thank you for joining Trilogy Digital Media. Your account has been created and is ready to use.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <p style="margin: 0;"><strong>Your login credentials:</strong></p>
          <p style="margin: 10px 0;">Email: ${email}</p>
          <p style="margin: 10px 0;">Password: ${password}</p>
        </div>
        
        <p>For your security, please change your password after your first login.</p>
        
        <p>You now have access to the media content that has been assigned to you. To access your content:</p>
        
        <ol>
          <li>Go to our platform at <a href="https://${appDomain}">https://${appDomain}</a></li>
          <li>Log in with the credentials provided above</li>
          <li>Navigate to the "My Media" section to view your assigned content</li>
        </ol>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our team.</p>
        
        <p>Best regards,<br>The Trilogy Digital Media Team</p>
      </div>
      <div style="padding: 15px; background-color: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280;">
        <p>&copy; ${new Date().getFullYear()} Trilogy Digital Media. All rights reserved.</p>
        <p>This email was sent to ${email} because you were registered as a client at Trilogy Digital Media.</p>
      </div>
    </div>
  `;
  
  return sendEmail({
    to: email,
    from: senderEmail,
    subject,
    html,
  });
}