const nodemailer = require('nodemailer');

const getTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE = 'false',
    SMTP_USER,
    SMTP_PASSWORD,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    const error = new Error('SMTP is not configured');
    error.statusCode = 500;
    throw error;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
};

const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: 'Відновлення пароля у Finance App',
    text: [
      'Ви отримали цей лист, бо запросили відновлення пароля.',
      '',
      `Перейдіть за покликанням, щоб встановити новий пароль: ${resetLink}`,
      '',
      'Покликання дійсне 30 хвилин.',
      'Якщо ви не робили цей запит, просто проігноруйте лист.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">Відновлення пароля</h2>
        <p>Ви отримали цей лист, бо запросили відновлення пароля.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">
            Встановити новий пароль
          </a>
        </p>
        <p>Покликання дійсне 30 хвилин.</p>
        <p style="color:#64748b;">Якщо ви не робили цей запит, просто проігноруйте лист.</p>
      </div>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
};
