import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not found in environment variables. Email functionality will not work.');
}

// Default configuration for emails - these should be set in environment variables
export const DEFAULT_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@tbn.com';
export const CONTACT_NOTIFICATION_EMAIL = process.env.CONTACT_NOTIFICATION_EMAIL || 'support@tbn.com';
export const APP_DOMAIN = process.env.APP_DOMAIN || 'tdev.tbn.com';

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
 * Send notification email about a new contact form submission
 */
export async function sendContactNotification(
  name: string,
  email: string,
  company: string | undefined,
  message: string,
  notificationEmail = CONTACT_NOTIFICATION_EMAIL,
  senderEmail = DEFAULT_FROM_EMAIL
): Promise<boolean> {
  const subject = `[Trilogy Digital Media] New Contact Inquiry from ${name}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0f172a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">New Contact Form Submission</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <h2>Contact Details</h2>
        
        <div style="background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          ${company ? `<p style="margin: 5px 0;"><strong>Company:</strong> ${company}</p>` : ''}
        </div>
        
        <h3>Message:</h3>
        <div style="background-color: #f9fafb; padding: 15px; margin: 15px 0; border-radius: 5px;">
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        
        <p>
          <a href="mailto:${email}" style="display: inline-block; background-color: #0f172a; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Reply to Inquiry</a>
        </p>
        
      </div>
      <div style="padding: 15px; background-color: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280;">
        <p>&copy; ${new Date().getFullYear()} Trilogy Digital Media. All rights reserved.</p>
        <p>This automated notification was sent from the Trilogy Digital Media platform.</p>
      </div>
    </div>
  `;
  
  return sendEmail({
    to: notificationEmail,
    from: senderEmail,
    subject,
    html,
  });
}

/**
 * Send a welcome email to a new client
 */
export async function sendWelcomeEmail(
  email: string, 
  username: string, 
  password: string, 
  senderEmail = process.env.SENDGRID_FROM_EMAIL || 'alerts@tbn.com',
  appDomain = process.env.APP_DOMAIN || 'tdev.tbn.com'
): Promise<boolean> {
  const subject = 'Welcome to TBN';
  
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