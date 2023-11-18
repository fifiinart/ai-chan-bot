import { SlashCommandBuilder, CommandInteraction, CommandInteractionOptionResolver, Message, AttachmentBuilder, InteractionReplyOptions, EmbedType, GuildMember } from "discord.js";
import sharp, { Metadata } from "sharp";
import axios from "axios";
import { Stream } from "stream";
import { analyzeLabels, connectedComponents, labelResultsToImg, processFromLabelData, sharpToMatrix } from "../util/connected-components";
import { SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4, Difficulty, ScorecardFormat } from "../util/img-format-constants";
import { createWorker, OEM, PSM } from "tesseract.js";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { MULT, ASPECT } from "../util/img-format-constants";
export const data = new SlashCommandBuilder()
  .setName('process')
  .setDescription('Processes an Arcaea score screenshot.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))



export async function execute(interaction: CommandInteraction) {

  const result = await getAttachmentsFromMessage(interaction);
  if (!result.success) {
    interaction.reply(result.error);
    return;
  }

  await interaction.deferReply();

  const attachments = result.data;

  for (const attachment of attachments) {
    const sharpStream = sharp({ failOn: "none" });

    (await axios.get<Stream>(attachment, { responseType: "stream" })).data.pipe(sharpStream);

    const meta = await sharpStream.metadata()

    sharpStream.extract(getSyncRegion(meta)).resize(SYNC_W, SYNC_H)

    let [jacket, scoreImg, diff5Img, combo5Img, diff4Img, combo4Img] = [JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4]
      .map((region) => sharpStream.clone().extract(region).png())

    let composed;
    ({ composed, scoreImg } = await processScoreImage(scoreImg));

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

    let diff: Difficulty, combo: number, version: ScorecardFormat
    if (diff5 in ["PAST", "PRESENT", "FUTURE", "BEYOND"] && !Number.isNaN(+combo5)) {
      version = ScorecardFormat.GTE_V5;
      console.log("5.0 Score detected")
      switch (diff5 as ("PAST" | "PRESENT" | "FUTURE" | "BEYOND")) {
        case "PAST":
          diff = Difficulty.PAST;
          break;
        case "PRESENT":
          diff = Difficulty.PRESENT;
          break;
        case "FUTURE":
          diff = Difficulty.FUTURE;
          break;
        case "BEYOND":
          diff = Difficulty.BEYOND;
      }
      combo = +combo5
    } else if (["Past", "Present", "Future", "Beyond"].some(x => diff4.startsWith(x)) && !Number.isNaN(+combo4)) {
      version = ScorecardFormat.LTE_V4;
      console.log("4.0 Score detected")
      if (diff4.startsWith("Past")) diff = Difficulty.PAST;
      if (diff4.startsWith("Present")) diff = Difficulty.PRESENT;
      if (diff4.startsWith("Future")) diff = Difficulty.FUTURE;
      diff = Difficulty.BEYOND;
      combo = +combo4
    } else {
      return await interaction.followUp(`Unrecognized score format: recieved score "${score}", difficulties "${diff5}", "${diff4}", combos "${combo5}", "${combo4}"`)
    }

    const files = [sharpStream, jacket, scoreImg, composed, version === ScorecardFormat.GTE_V5 ? diff5Img : diff4Img, version === ScorecardFormat.GTE_V5 ? combo5Img : combo4Img]

    console.log(interaction.member instanceof GuildMember ? interaction.member.displayAvatarURL() : undefined)

    const replyContent: InteractionReplyOptions = {
      files: await Promise.all(files.map(async x => new AttachmentBuilder(await x.toBuffer(), { name: "cropped.png" }))),
      embeds: [{
        "title": `Score Processing Result`,
        "description": "",
        "color": 0xe8aeff,
        "fields": [
          {
            "name": `Score`,
            "value": `${score}`,
            "inline": true
          },
          {
            "name": `Difficulty`,
            "value": `${diff}`,
            "inline": true
          },
          {
            "name": `Combo`,
            "value": `${combo}`,
            "inline": true
          }
        ],
        "author": {
          "name": interaction.client.user.username,
          "icon_url": interaction.client.user.displayAvatarURL()
        },
        "footer": {
          "text": `Requested by ${interaction.member?.user.username}`,
          "icon_url": interaction.member instanceof GuildMember ? interaction.member.displayAvatarURL() : undefined
        },
        "timestamp": new Date().toISOString()
      }]
    };
    if (!(interaction.replied || interaction.deferred))
      await interaction.reply(replyContent)
    else await interaction.followUp(replyContent)
  }

}

async function processScoreImage(scoreImg: sharp.Sharp) {
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
  }).blur(1.0);
  composed = sharp(await composed.toBuffer()).threshold(255 - 50).png();
  return { composed, colored, scoreImg };
}

function getSyncRegion(meta: sharp.Metadata) {

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
