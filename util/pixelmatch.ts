import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { SongData, SongDifficultyData } from "./database";
import SimplDB from "simpl.db";
import { Difficulty, JACKET_RESOLUTION, getJacketPath } from "./img-format-constants";

export interface CompareJacketsResult {
  diffPixels: number;
  song: SongDifficultyData | null
}

export async function compareJackets(difficulty: Difficulty, songdata: SimplDB.Collection<SimplDB.Readable<SongData>>, jacket: Buffer): Promise<CompareJacketsResult> {
  const downsized = await sharp(await jacket).resize(JACKET_RESOLUTION).ensureAlpha().raw().toBuffer()
  const time = Date.now();

  const songPaths = new Map<string, SongDifficultyData>(songdata.getAll()
    .flatMap(x => x.difficulties
      .filter(d => d.difficulty === difficulty)
      .map(d => [x.id + (d.subid ? ("-") + d.subid : ""), d])))

  let minDiff = Infinity;
  let songCandidate: SongDifficultyData | null = null;
  for (const [path, entry] of songPaths) {
    const filePath = getJacketPath(path);
    const buf = await sharp(filePath).raw().toBuffer();
    const diff = pixelmatch(downsized, buf, null, JACKET_RESOLUTION, JACKET_RESOLUTION)

    if (diff < minDiff) {
      minDiff = diff;
      songCandidate = entry;
    }
  }

  console.log(`Finished pixelmatching ${songPaths.size} images in ${(Date.now() - time) / 1000} seconds`)
  console.log(`Diff: ${minDiff}, Candidate: ${songCandidate}`)
  return { diffPixels: minDiff, song: songCandidate };
}