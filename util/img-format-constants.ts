import sharp from "sharp";
import {
  analyzeLabels, connectedComponents, labelResultsToImg, processFromLabelData, sharpToMatrix
} from "../util/connected-components";

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
export async function processScoreImage(scoreImg: sharp.Sharp) {
  scoreImg = sharp(await scoreImg.toBuffer()).resize({ height: Math.floor(SCORE_REGION.height * MULT) }).removeAlpha().threshold(); //.negate()//.threshold()
  scoreImg = sharp(await scoreImg.toBuffer()).negate();
  const mat = await sharpToMatrix(scoreImg);
  const labels = connectedComponents(mat);
  const colored = labelResultsToImg(labels).png();
  const dataList = analyzeLabels(labels);

  let composed = processFromLabelData(dataList).png();
  composed.affine([1, -0.11, 0, 1], { "background": "white" }).extend({
    background: 'white',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4
  }).blur(1);
  composed = sharp(await composed.toBuffer()).threshold(255 - 50).png();
  return { composed, colored, scoreImg };
}
export function getSyncRegion(meta: sharp.Metadata) {

  if (meta.width! > meta.height! * ASPECT) {
    const newWidth = meta.height! * ASPECT;
    const diffWidth = meta.width! - newWidth;
    return {
      left: Math.floor(diffWidth / 2),
      width: Math.floor(newWidth),
      top: 0,
      height: meta.height!
    };

  } else {
    const newHeight = meta.width! / ASPECT;
    const diffHeight = meta.height! - newHeight;
    return {
      top: Math.floor(diffHeight / 2),
      height: Math.floor(newHeight),
      left: 0,
      width: meta.width!
    };
  }

}
