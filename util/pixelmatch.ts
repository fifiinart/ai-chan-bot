import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { SongData, SongDifficultyData } from "./database";
import SimplDB from "simpl.db";
import { Difficulty, JACKET_RESOLUTION, getJacketPath } from "./process-image";

export interface TotalDifficultyData {
  difficulty: SongDifficultyData
  song: SongData
}

export interface NullDifficultyData {
  difficulty: null
  song: null
}

export type CompareJacketsResult = { diffPixels: number } & (TotalDifficultyData | NullDifficultyData)

export async function compareJackets(difficulty: Difficulty, songdata: SimplDB.Collection<SimplDB.Readable<SongData>>, jacket: Buffer): Promise<CompareJacketsResult> {
  const downsized = await sharp(await jacket).resize(JACKET_RESOLUTION).ensureAlpha().raw().toBuffer()
  const time = Date.now();

  const songPaths = new Map<string, [SongData, SongDifficultyData]>(songdata.getAll()
    .flatMap(x => x.difficulties
      .map(d => [x, d] as [SongData, SongDifficultyData])
      .filter(([, d]) => d.difficulty === difficulty)
      .map(([x, d]) => [x.id + (d.subid ? ("-") + d.subid : ""), [x, d] as [SongData, SongDifficultyData]])))

  let minDiff = Infinity;
  let songCandidate: [SongData, SongDifficultyData] | [null, null] = [null, null];
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
  console.log(`Diff: ${minDiff}, Candidate: `, songCandidate)

  if (songCandidate[0] == null)
    return { diffPixels: minDiff, difficulty: songCandidate[1], song: songCandidate[0] };
  else
    return { diffPixels: minDiff, difficulty: songCandidate[1], song: songCandidate[0] };
}