export const NAV_START_EVENT = "trackr:nav-start";

/** The signed-in app (/app/*) uses the slim top bar; every other page the column wipe. */
export const isAppPath = (pathname: string) =>
  pathname === "/app" || pathname.startsWith("/app/");

/** Shared by the entry intro and the column wipe, so one visit plays only one of them. */
export const introState = { played: false };
