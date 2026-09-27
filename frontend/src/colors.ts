// Catalogue colors are free text ("heather gray", "navy blue"); map them to swatch colors.
const swatches: [RegExp, string][] = [
  [/navy/, '#1b2a4a'],
  [/charcoal|dark heather|dark gray|dark grey/, '#4a4d52'],
  [/heather|gray|grey|silver/, '#b9bcc1'],
  [/black/, '#111'],
  [/white|cream|ivory/, '#fff'],
  [/royal|yale blue|light blue|sky/, '#286dc0'],
  [/blue/, '#1f4e99'],
  [/maroon|burgundy|crimson/, '#7a1f2b'],
  [/red/, '#c8102e'],
  [/pink/, '#f2a7c3'],
  [/green|forest/, '#2e6b3f'],
  [/gold|yellow/, '#e3b23c'],
  [/orange/, '#e8762b'],
  [/purple/, '#6b3fa0'],
  [/brown|tan|khaki/, '#8a6a4a'],
]

export function swatch(color: string): string {
  const c = color.toLowerCase()
  return swatches.find(([re]) => re.test(c))?.[1] ?? '#ccc'
}
