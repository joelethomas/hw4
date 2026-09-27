// Mirrors backend/auth.py password_problems(); the server enforces the same rules.
export const requirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
  { label: 'Contains a special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export const meetsRequirements = (password: string) => requirements.every((r) => r.test(password))

export type StrengthLabel = 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: StrengthLabel
}

const labels: StrengthLabel[] = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

// Simple heuristic: rewards length and character variety, penalizes common patterns.
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: labels[0] }
  let points = 0
  if (password.length >= 8) points++
  if (password.length >= 12) points++
  if (password.length >= 16) points++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++
  if (/\d/.test(password)) points++
  if (/[^A-Za-z0-9]/.test(password)) points++
  if (/(.)\1{2,}/.test(password)) points--
  if (/password|1234|qwerty|yale|bulldog/i.test(password)) points--

  let score = Math.max(0, Math.min(4, Math.floor(points * 4 / 6))) as Strength['score']
  // Anything missing a required rule can't rate above Weak.
  if (!meetsRequirements(password)) score = Math.min(score, 1) as Strength['score']
  return { score, label: labels[score] }
}
