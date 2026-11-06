// The hard limits of one auction. Kept in one place so the server, the app and the Terms of use page
// always say the same thing.

export const LIMITS = {
  teams: 32, // bidders (captains) per auction
  players: 500, // players per auction
  photos: 1000, // uploaded photos per auction
  photoBytes: 1024 * 1024, // 1 MB per photo (the app shrinks photos before uploading)
  logoBytes: 1024 * 1024, // 1 MB per brand logo
} as const;
