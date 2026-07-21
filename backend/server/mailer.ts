import nodemailer from 'nodemailer';

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT ?? '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  });
}

export async function sendStandbyAssignedEmail(to: string, displayName: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const from = process.env.EMAIL_FROM ?? `Alert Buddy <${process.env.EMAIL_USER}>`;
    await buildTransport().sendMail({
      from,
      to,
      subject: "You're now on standby — Alert Buddy",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
          <div style="background:#2563eb;border-radius:12px;padding:20px 24px;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">&#128276; You're now on standby</h1>
          </div>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px">Hi <strong>${displayName}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
            You've been assigned as the on-call standby contact for <strong>Alert Buddy</strong>.
            Any alerts that come in will be routed directly to your device until someone else takes over.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
            Make sure the Alert Buddy app is open and your device notifications are turned on.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px">
          <p style="font-size:12px;color:#9ca3af;margin:0">
            This is an automated message from Alert Buddy. Do not reply to this email.
          </p>
        </div>
      `,
      text: `Hi ${displayName},\n\nYou've been assigned as the on-call standby contact for Alert Buddy. Any alerts will be routed to your device until someone else takes over.\n\nMake sure the Alert Buddy app is open and notifications are enabled.\n\n— Alert Buddy`,
    });
    return true;
  } catch (err) {
    console.error('📧 Failed to send standby email:', err);
    return false;
  }
}
