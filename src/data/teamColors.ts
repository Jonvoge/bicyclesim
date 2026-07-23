/**
 * Team jersey colours for the placeholder renderer. Kept in /data (team-specific
 * data, not logic). Values are cosmetic and free to tweak.
 */
export interface TeamColor {
  jersey: number;
  accent: number;
}

export const TEAM_COLORS: Record<string, TeamColor> = {
  't-grenoble': { jersey: 0x18b39a, accent: 0xffffff }, // player — teal
  't-vesma': { jersey: 0xf5c518, accent: 0x1a1a2e }, // yellow
  't-uad': { jersey: 0xe23b3b, accent: 0xffffff }, // red
  't-soudo': { jersey: 0x8b5cf6, accent: 0xffffff }, // purple
  't-movistrella': { jersey: 0x2f6fd0, accent: 0xffffff }, // blue
  't-bora': { jersey: 0x8fd14f, accent: 0x1a1a2e }, // lime
  't-lido': { jersey: 0xe86f2c, accent: 0xffffff }, // orange
  't-astara': { jersey: 0x33c6d6, accent: 0x1a1a2e }, // cyan
};

const FALLBACK: TeamColor = { jersey: 0x8a8ab0, accent: 0xffffff };

export function teamColor(teamId: string | null): TeamColor {
  return (teamId && TEAM_COLORS[teamId]) || FALLBACK;
}
