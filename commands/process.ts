import { SlashCommandBuilder, CommandInteraction, CommandInteractionOptionResolver, Message, AttachmentBuilder, InteractionReplyOptions, EmbedType, GuildMember } from "discord.js";
import sharp, { Metadata } from "sharp";
import axios from "axios";
import { Stream } from "stream";
import { analyzeLabels, connectedComponents, labelResultsToImg, processFromLabelData, sharpToMatrix } from "../util/connected-components";
import { SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION, COMBO_REGION, MULT, ASPECT } from "../util/img-format-constants";
import { createWorker, OEM, PSM } from "tesseract.js";
import { getAttachmentsFromMessage } from "../util/get-attachments";
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

    let [jacket, scoreImg, diffImg, comboImg] = [JACKET_REGION, SCORE_REGION, DIFF_REGION, COMBO_REGION]
      .map((region) => sharpStream.clone().extract(region).png())

    let composed;
    let colored;
    ({ composed, colored, scoreImg } = await processScoreImage(scoreImg));

    const worker = await createWorker("eng", OEM.TESSERACT_ONLY, {
      // @ts-ignore
      load_system_dawg: '0',
      load_freq_dawg: '0',
    })

    const diff = await worker.recognize(await diffImg.toBuffer())
    const combo = await worker.recognize(await comboImg.toBuffer())


    console.log(await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: PSM.SINGLE_WORD
    }))

    const score = await worker.recognize(await composed.toBuffer())

    const files = [jacket, scoreImg, colored, composed]

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
            "value": `${score.data.text.trim()}`,
            "inline": true
          },
          {
            "name": `Difficulty`,
            "value": `${diff.data.text.trim()}`,
            "inline": true
          },
          {
            "name": `Combo`,
            "value": `${combo.data.text.trim()}`,
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
