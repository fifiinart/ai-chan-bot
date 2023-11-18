import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions, GuildMember } from "discord.js";
import sharp from "sharp";
import axios from "axios";
import { Stream } from "stream";
import { SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4, Difficulty, ScorecardFormat, getDifficultyName } from "../util/img-format-constants";
import { createWorker, OEM, PSM } from "tesseract.js";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { getSyncRegion, processScoreImage } from "../util/img-format-constants";
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

    const startTime = new Date()

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

    const endTime = new Date()
    const seconds = (endTime.getTime() - startTime.getTime()) / 1000

    const replyContent: InteractionReplyOptions = {
      files: await Promise.all(files.map(async x => new AttachmentBuilder(await x.toBuffer(), { name: "cropped.png" }))),
      embeds: [{
        "title": `Score Processing Result (${seconds}s)`,
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
            "value": `${getDifficultyName(diff)}`,
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
