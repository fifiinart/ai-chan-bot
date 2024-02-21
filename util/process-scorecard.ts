import axios from "axios";
import sharp from "sharp";
import { Stream } from "stream";
import { createWorker, createScheduler, OEM, PSM } from "tesseract.js";
import { getSyncRegion, SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4, processScoreImage, Difficulty, ScorecardFormat, scoreFormat, JACKET_RESOLUTION } from "./process-image";
import { codeBlock, inlineCode } from "discord.js";

export interface Score {
  version: ScorecardFormat;
  score: number;
  difficulty: Difficulty;
  combo: number;
}

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
    data: Score
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

export async function extractJacket(imgUrl: string): Promise<sharp.Sharp> {
  const sh_scorecard = sharp({ failOn: "none" });

  (await axios.get<Stream>(imgUrl, { responseType: "stream" })).data.pipe(sh_scorecard);

  return sh_scorecard.extract(JACKET_REGION).png()
}

export async function processScorecard(imgUrl: string): Promise<ScorecardProcessResult> {
  const startTime = new Date()

  const sh_scorecard = sharp({ failOn: "none" });

  (await axios.get<Stream>(imgUrl, { responseType: "stream" })).data.pipe(sh_scorecard);

  let now = Date.now()

  const meta = await sh_scorecard.metadata()

  sh_scorecard.extract(getSyncRegion(meta)).resize(SYNC_W, SYNC_H, { kernel: "nearest" })

  let [jacket, scoreImg, diff5Img, combo5Img, diff4Img, combo4Img] = [JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4]
    .map((region) => sh_scorecard.clone().extract(region).png())

  // jacket = sharp(await jacket.toBuffer()).resize(JACKET_RESOLUTION).ensureAlpha().png()

  let composed: sharp.Sharp, colored;
  try {
    ({ composed, colored, scoreImg } = await processScoreImage(scoreImg));
  } catch (e) {
    return {
      success: false,
      error: (e as Error).message
    }
  } finally {
    console.log("Extract and process image: %ds", -(now - Date.now()) / 1000)
  }
  now = Date.now()

  const normalWorker = await createWorker("eng", OEM.TESSERACT_ONLY, {
    // @ts-ignore
    load_system_dawg: '0',
    load_freq_dawg: '0',
  })

  const uppercaseAlphaWorker = await createWorker("eng", OEM.TESSERACT_ONLY, {
    // @ts-ignore
    load_system_dawg: '0',
    load_freq_dawg: '0',
  })
  await uppercaseAlphaWorker.setParameters({
    tessedit_char_whitelist: "PASTRENFUBYOD",
    tessedit_pageseg_mode: PSM.SINGLE_WORD
  })

  const digitScheduler = createScheduler()
  const workerDigitN = 2;
  await Promise.all(Array(workerDigitN).fill(0).map(async (_, i) => {
    const worker = await createWorker("eng", OEM.TESSERACT_ONLY, {
      // @ts-ignore
      load_system_dawg: '0',
      load_freq_dawg: '0',
    })
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: PSM.SINGLE_WORD
    })
    digitScheduler.addWorker(worker)
  }))

  const sharpToText = async (x: sharp.Sharp, i: number, scheduler: Tesseract.Scheduler): Promise<string> => {
    console.log("Start OCR of image ", i)
    const img = await x.toBuffer();
    const ocr = await scheduler.addJob('recognize', img)
    console.log("End OCR of image ", i)
    return ocr.data.text.trim();
  };

  const diff5 = (await uppercaseAlphaWorker.recognize(await diff5Img.threshold(190).toBuffer())).data.text.trim()
  const diff4 = (await normalWorker.recognize(await diff4Img.threshold(190).affine([1, -0.1, 0, 1], { "background": "white" }).extend({
    background: 'white',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4
  }).toBuffer())).data.text.trim()

  const promises = [combo4Img, combo5Img, composed].map((x, i) => sharpToText(x, i, digitScheduler))

  const [combo4, combo5, score] = await Promise.all(promises)

  digitScheduler.terminate()

  console.log("OCR text: %ds", -(now - Date.now()) / 1000)
  now = Date.now()

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
    else if (diff4.startsWith("Present")) difficulty = Difficulty.PRESENT;
    else if (diff4.startsWith("Future")) difficulty = Difficulty.FUTURE;
    else difficulty = Difficulty.BEYOND;
    combo = +combo4
  } else {
    console.log("Score: %s, Diff: 5 - '%s', 4 - '%s', Combo: 5 - '%d', 4 - '%d'", score, diff5, diff4, +combo5, +combo4)
    // return await interaction.followUp(`Unrecognized score format: recieved score "${score}", difficulties "${diff5}", "${diff4}", combos "${combo5}", "${combo4}"`)
    return {
      success: false,
      error: `Unrecognized score format: recieved score ${inlineCode(score)}, difficulties "${inlineCode(diff5)}", "${inlineCode(diff4)}", combos "${inlineCode(combo5)}", "${inlineCode(combo4)}"`
    }
  }

  const endTime = new Date()
  console.log("Total image processing, %ds", (endTime.getTime() - startTime.getTime()) / 1000)

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