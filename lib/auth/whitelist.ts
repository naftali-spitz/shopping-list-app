export const allowedEmails = [
  "your@email.com",
  "wife@email.com",
];

export function isAllowedEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return allowedEmails.includes(email.toLowerCase());
}
