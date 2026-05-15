export const allowedEmails = [
  "0012ab@gmail.com",
  "sbspitz@gmail.com",
];

export function isAllowedEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return allowedEmails.includes(email.toLowerCase());
}
