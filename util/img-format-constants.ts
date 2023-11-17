import sharp from "sharp";

export const MULT = 1 / 2;
export const SYNC_W = 1920;
export const SYNC_H = 1080;
export const ASPECT = SYNC_W / SYNC_H;
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
export const DIFF_REGION: sharp.Region = {
  left: 139,
  top: 303,
  width: 191,
  height: 38
};
export const COMBO_REGION: sharp.Region = {
  left: 326,
  top: 347,
  width: 106,
  height: 35
};
