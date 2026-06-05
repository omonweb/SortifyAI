const nodemailer = require("nodemailer");

function getTransportConfig() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS."
    );
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true" || Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  };
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

function formatSkillList(skills) {
  return skills && skills.length > 0 ? skills.join(", ") : "None";
}

function buildShortlistEmail(candidate, job) {
  return {
    subject: `You've been shortlisted for ${job.title}`,
    text: [
      `Hi ${candidate.name || "Candidate"},`,
      "",
      `Thank you for applying to the ${job.title} role at SortifyAI.`,
      "We reviewed your profile and are pleased to let you know that you have been shortlisted for the next stage.",
      "",
      "Our team will be in touch with the next steps soon.",
      "",
      "Best regards,",
      "SortifyAI Hiring Team",
    ].join("\n"),
    html: `
      <p>Hi ${candidate.name || "Candidate"},</p>
      <p>Thank you for applying to the <strong>${job.title}</strong> role at SortifyAI.</p>
      <p>We reviewed your profile and are pleased to let you know that you have been shortlisted for the next stage.</p>
      <p>Our team will be in touch with the next steps soon.</p>
      <p>Best regards,<br />SortifyAI Hiring Team</p>
    `,
  };
}

function buildRejectionEmail(candidate, job) {
  return {
    subject: `Update on your application for ${job.title}`,
    text: [
      `Hi ${candidate.name || "Candidate"},`,
      "",
      `Thank you for applying to the ${job.title} role at SortifyAI.`,
      "After reviewing your application, we will not be moving forward with this role at the moment.",
      "",
      `Matched skills: ${formatSkillList(candidate.matchedSkills)}`,
      `Missing skills: ${formatSkillList(candidate.missingSkills)}`,
      "",
      "We appreciate the time you invested, and we encourage you to apply again for future roles that align with your experience.",
      "",
      "Best regards,",
      "SortifyAI Hiring Team",
    ].join("\n"),
    html: `
      <p>Hi ${candidate.name || "Candidate"},</p>
      <p>Thank you for applying to the <strong>${job.title}</strong> role at SortifyAI.</p>
      <p>After reviewing your application, we will not be moving forward with this role at the moment.</p>
      <p><strong>Matched skills:</strong> ${formatSkillList(candidate.matchedSkills)}</p>
      <p><strong>Missing skills:</strong> ${formatSkillList(candidate.missingSkills)}</p>
      <p>We appreciate the time you invested, and we encourage you to apply again for future roles that align with your experience.</p>
      <p>Best regards,<br />SortifyAI Hiring Team</p>
    `,
  };
}

function buildEmailPayload(type, candidate, job) {
  if (type === "shortlist") {
    return buildShortlistEmail(candidate, job);
  }

  if (type === "rejection") {
    return buildRejectionEmail(candidate, job);
  }

  throw new Error("Invalid email type. Use shortlist or rejection.");
}

async function sendCandidateEmail({ type, candidate, job }) {
  const transporter = nodemailer.createTransport(getTransportConfig());
  const payload = buildEmailPayload(type, candidate, job);

  return transporter.sendMail({
    from: getFromAddress(),
    to: candidate.email,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

module.exports = { sendCandidateEmail };
