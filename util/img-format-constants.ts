import sharp from "sharp";

export const MULT = 1 / 2;
export const SYNC_W = 1920;
export const SYNC_H = 1080;
export const ASPECT = SYNC_W / SYNC_H;

export const scoreFormat = /^\d{9}$/

export enum ScorecardFormat {
  LTE_V4,
  GTE_V5
}

export enum Difficulty {
  PAST,
  PRESENT,
  FUTURE,
  BEYOND
}

export const getDifficultyName = (diff: Difficulty): string => ["Past", "Present", "Future", "Beyond"][diff]

export const JACKET_REGION: sharp.Region = {
  left: 46,
  top: 403,
  width: 562,
  height: 562
};
export const SCORE_REGION: sharp.Region = {
  left: 727,
  top: 426,
  width: 475,
  height: 83
};
export const DIFF_REGION_V5: sharp.Region = {
  left: 139,
  top: 303,
  width: 191,
  height: 38
};
export const COMBO_REGION_V5: sharp.Region = {
  left: 326,
  top: 347,
  width: 106,
  height: 35
};
export const DIFF_REGION_V4: sharp.Region = {
  left: 288 - 251,
  top: 398 - 55,
  width: 251,
  height: 55
}
export const COMBO_REGION_V4: sharp.Region = {
  left: 406 - 151,
  top: 346 - 66,
  width: 151,
  height: 66
}