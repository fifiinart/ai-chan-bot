import axios from "axios";
import sharp from "sharp";
import { Stream } from "stream";
import { createWorker, OEM, PSM } from "tesseract.js";
import { getSyncRegion, SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4, processScoreImage, Difficulty, ScorecardFormat, scoreFormat } from "./img-format-constants";

export interface ScorecardProcessSuccess {
  success: true,
  data: {
    files: {
      scorecard: Buffer,
      jacket: Buffer
      score: {
        raw: Buffer,
        colored: Buffer,
        processed: Buffer
      },
      difficulty: Buffer,
      combo: Buffer
    },
    data: {
      version: ScorecardFormat
      score: number,
      difficulty: Difficulty,
      combo: number
    }
  }
  time: {
    start: Date,
    end: Date,
    interval: number
  }
}
export interface ScorecardProcessFailure {
  success: false,
  error: string
}
export type ScorecardProcessResult = ScorecardProcessSuccess | ScorecardProcessFailure

export async function processScorecard(imgUrl: string): Promise<ScorecardProcessResult> {
  const startTime = new Date()

  const sh_scorecard = sharp({ failOn: "none" });

  (await axios.get<Stream>(imgUrl, { responseType: "stream" })).data.pipe(sh_scorecard);

  const meta = await sh_scorecard.metadata()

  sh_scorecard.extract(getSyncRegion(meta)).resize(SYNC_W, SYNC_H)

  let [jacket, scoreImg, diff5Img, combo5Img, diff4Img, combo4Img] = [JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4]
    .map((region) => sh_scorecard.clone().extract(region).png())

  let composed, colored;
  ({ composed, colored, scoreImg } = await processScoreImage(scoreImg));

  const worker = await createWorker("eng", OEM.TESSERACT_ONLY, {
    // @ts-ignore
    load_system_dawg: '0',
    load_freq_dawg: '0',
  })

  const diff5 = (await worker.recognize(await diff5Img.toBuffer())).data.text.trim()
  const combo5 = (await worker.recognize(await combo5Img.toBuffer())).data.text.trim()
  const diff4 = (await worker.recognize(await diff4Img.toBuffer())).data.text.trim()
  const combo4 = (await worker.recognize(await combo4Img.toBuffer())).data.text.trim()


  console.log(await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
    tessedit_pageseg_mode: PSM.SINGLE_WORD
  }))

  const score = (await worker.recognize(await composed.toBuffer())).data.text.trim()

  let difficulty: Difficulty, combo: number, version: ScorecardFormat
  if ((["PAST", "PRESENT", "FUTURE", "BEYOND"]).includes(diff5) && !Number.isNaN(+combo5) && scoreFormat.test(score)) {
    version = ScorecardFormat.GTE_V5;
    console.log("5.0 Score detected")
    switch (diff5 as ("PAST" | "PRESENT" | "FUTURE" | "BEYOND")) {
      case "PAST":
        difficulty = Difficulty.PAST;
        break;
      case "PRESENT":
        difficulty = Difficulty.PRESENT;
        break;
      case "FUTURE":
        difficulty = Difficulty.FUTURE;
        break;
      case "BEYOND":
        difficulty = Difficulty.BEYOND;
    }
    combo = +combo5
  } else if (["Past", "Present", "Future", "Beyond"].some(x => diff4.startsWith(x)) && !Number.isNaN(+combo4) && scoreFormat.test(score)) {
    version = ScorecardFormat.LTE_V4;
    console.log("4.0 Score detected")
    if (diff4.startsWith("Past")) difficulty = Difficulty.PAST;
    if (diff4.startsWith("Present")) difficulty = Difficulty.PRESENT;
    if (diff4.startsWith("Future")) difficulty = Difficulty.FUTURE;
    difficulty = Difficulty.BEYOND;
    combo = +combo4
  } else {
    console.log("Score: %s, Diff: 5 - '%s', 4 - '%s', Combo: 5 - '%d', 4 - '%d'", score, diff5, diff4, +combo5, +combo4)
    // return await interaction.followUp(`Unrecognized score format: recieved score "${score}", difficulties "${diff5}", "${diff4}", combos "${combo5}", "${combo4}"`)
    return {
      success: false,
      error: `Unrecognized score format: recieved score "${score}", difficulties "${diff5}", "${diff4}", combos "${combo5}", "${combo4}"`
    }
  }

  const endTime = new Date()

  return {
    success: true,
    data: {
      files: {
        combo: await (version === ScorecardFormat.GTE_V5 ? combo5Img : combo4Img).toBuffer(),
        difficulty: await (version === ScorecardFormat.GTE_V5 ? diff5Img : diff4Img).toBuffer(),
        score: {
          raw: await scoreImg.toBuffer(),
          colored: await colored.toBuffer(),
          processed: await composed.toBuffer()
        },
        jacket: await jacket.toBuffer(),
        scorecard: await sh_scorecard.toBuffer()
      },
      data: {
        version,
        score: +score,
        difficulty,
        combo
      }
    },
    time: {
      start: startTime,
      end: endTime,
      interval: endTime.getTime() - startTime.getTime()
    }
  }
}