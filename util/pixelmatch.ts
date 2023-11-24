import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { SongData } from "./database";
import SimplDB from "simpl.db";
import { JACKET_RESOLUTION, getJacketPath } from "./img-format-constants";

export interface CompareJacketsResult {
  diff: number;
  song: SongData | null;
}

export async function compareJackets(songdata: SimplDB.Collection<SimplDB.Readable<SongData>>, jacket: Buffer): Promise<CompareJacketsResult> {
  const downsized = await sharp(await jacket).resize(JACKET_RESOLUTION).ensureAlpha().raw().toBuffer()
  const time = Date.now();

  let minDiff = Infinity;
  let songCandidate: SongData | null = null;
  for (const entry of songdata.getAll()) {
    const filePath = getJacketPath(entry.id);
    const buf = await sharp(filePath).raw().toBuffer();
    const diff = pixelmatch(downsized, buf, null, JACKET_RESOLUTION, JACKET_RESOLUTION)

    if (diff < minDiff) {
      minDiff = diff;
      songCandidate = entry;
    }
  }

  console.log(`Finished pixelmatching ${songdata.entries} images in ${(Date.now() - time) / 1000} seconds`)
  console.log(`Diff: ${minDiff}, Candidate: ${songCandidate?.id}`)
  return { diff: minDiff, song: songCandidate };
}