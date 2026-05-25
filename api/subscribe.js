import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const email = ((req.body && req.body.email_address) || '').trim();
  const valid = email && /.+@.+\..+/.test(email);

  if (valid) {
    const record = { email, ts: new Date().toISOString() };
    // Always log — Vercel retains function logs
    console.log('LEAD:', JSON.stringify(record));

    // Email notification to your inbox if Gmail creds are set
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (gmailUser && gmailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass }
        });
        await transporter.sendMail({
          from: gmailUser,
          to: gmailUser,
          subject: `New lead: ${email}`,
          text: `Email: ${email}\nTime: ${record.ts}\nSource: hiimalex.ai free guide`
        });
      } catch (err) {
        console.error('Email notify failed:', err && err.message);
      }
    }
  } else {
    console.warn('Subscribe: invalid or missing email');
  }

  // Visitor always gets the guide, regardless of save outcome.
  res.writeHead(302, { Location: '/starter-guide.pdf' });
  res.end();
}
