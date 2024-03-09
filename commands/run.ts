import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions } from "discord.js";
import sharp from "sharp";
import axios from "axios";
import { Stream } from "stream";
import { OEM, PSM, createWorker } from "tesseract.js";
import { SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, MULT, getSyncRegion, DIFF_REGION_V4, COMBO_REGION_V4 } from "../util/process-image";
import { getAttachmentsFromInteraction } from "../util/get-attachments";

export const isGuildOnly = true;

export const data = new SlashCommandBuilder()
  .setName('run')
  .setDescription('Runs image recognition and score calculation on an Arcaea score screenshot.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))

const relativeLinkRegex = /^[mM](\d+)$/
const imageLinkRegex = /(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|svg|PNG|JPG|JPEG|GIF|SVG))/g

export async function execute(interaction: CommandInteraction) {

  const result = await getAttachmentsFromInteraction(interaction);
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

    const files = [JACKET_REGION, SCORE_REGION, DIFF_REGION_V5, COMBO_REGION_V5, DIFF_REGION_V4, COMBO_REGION_V4]
      .map((region) => sharpStream.clone().extract(region).png())

    files[2].threshold(190)

    const replyContent: InteractionReplyOptions = {
      files: await Promise.all(files.map(async x => new AttachmentBuilder(await x.toBuffer(), { name: "cropped.png" })))
    };
    if (!(interaction.replied || interaction.deferred))
      await interaction.reply(replyContent)
    else await interaction.followUp(replyContent)
  }

}

