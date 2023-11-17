import { SlashCommandBuilder, CommandInteraction, CommandInteractionOptionResolver, Message, AttachmentBuilder, InteractionReplyOptions } from "discord.js";
import sharp, { Metadata } from "sharp";
import axios from "axios";
import { Stream } from "stream";
import { OEM, PSM, createWorker } from "tesseract.js";
import { SYNC_W, SYNC_H, JACKET_REGION, SCORE_REGION, DIFF_REGION, COMBO_REGION, MULT, ASPECT } from "../util/img-format-constants";

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

  const link = (interaction.options as CommandInteractionOptionResolver).getString('image')?.trim()
  // TODO: find a way to act on an image that the user replies to

  let attachments: string[]
  if ((link === undefined) || (relativeLinkRegex.test(link))) {
    const scrapeDist = link ? parseInt(link.substring(1)) : 1
    const messages = await interaction.channel?.messages.fetch()!

    // i hate myself
    let message: Message | null = null
    let counter = 0
    for (let [, msg] of messages) {
      if (msg.author.id === interaction.user.id) counter++;

      if (counter === scrapeDist) {
        message = msg;
        break;
      }
    }

    if (!message) {
      await interaction.reply("Message not found.")
      return;
    }

    console.log(message.id)
    attachments = [...message.attachments
      .map(attachment => attachment.url), message.content]
      .filter(url => imageLinkRegex.test(url));
    if (attachments.length > 0) message.react('✅');

  } else {
    const matches = link.match(imageLinkRegex)
    if (!matches) {
      await interaction.reply("Invalid image attachment.")
      return;
    }
    attachments = matches
  }

  if (attachments.length == 0) {
    await interaction.reply("No attachments found.")
    return;
  }

  console.log("Attachment found: " + attachments)

  await interaction.deferReply();

  for (const attachment of attachments) {
    const sharpStream = sharp({ failOn: "none" });

    (await axios.get<Stream>(attachment, { responseType: "stream" })).data.pipe(sharpStream);

    const meta = await sharpStream.metadata()

    sharpStream.extract(getSyncRegion(meta)).resize(SYNC_W, SYNC_H)

    let [jacket, scoreImg, diffImg, comboImg] = [JACKET_REGION, SCORE_REGION, DIFF_REGION, COMBO_REGION]
      .map((region) => sharpStream.clone().extract(region).png())

    scoreImg = sharp(await scoreImg.toBuffer()).resize({ height: Math.floor(SCORE_REGION.height * MULT) }).removeAlpha().threshold(128)
    // scoreImg = sharp(await scoreImg/*.blur(1.0)*/.toBuffer())
    scoreImg.negate().threshold(255 - 50)
    const raw = await scoreImg.clone().raw().toBuffer({ resolveWithObject: true })
    // scoreImg.affine([1, -0.11, 0, 1], { "background": "white" }).extend({
    //   background: 'white',
    //   top: 4,
    //   bottom: 4,
    //   left: 4,
    //   right: 4
    // }).png()

    const worker = await createWorker("eng", OEM.TESSERACT_ONLY, {
      // @ts-ignore
      load_system_dawg: '0',
      load_freq_dawg: '0',
    })

    console.log(await worker.setParameters({
      tessedit_char_whitelist: "0123456789'",
      tessedit_pageseg_mode: PSM.SINGLE_WORD,

      //@ts-ignore

      tosp_min_sane_kn_sp: '1'
    }))

    const result = await worker.recognize(await scoreImg.toBuffer())
    worker.terminate();

    const filtered = result.data.symbols.filter(symbol => symbol.bbox.y1 > 25)
    // const borders = filtered.map<Promise<sharp.OverlayOptions>>(async symbol => {
    //   const x = symbol.bbox.x0
    //   const y = symbol.bbox.y0;
    //   const w = symbol.bbox.x1 - symbol.bbox.x0;
    //   const h = symbol.bbox.y1 - symbol.bbox.y0;

    //   const img = await sharp({
    //     create: {
    //       width: w,
    //       height: h,
    //       channels: 4,
    //       background: "#00000000"
    //     }
    //   }).extend({
    //     top: 1,
    //     bottom: 1,
    //     left: 1,
    //     right: 1,
    //     background: "#ff0000ff"
    //   }).png().toBuffer()
    //   return {
    //     top: y - 1,
    //     left: x - 1,
    //     input: img
    //   }
    // })
    // scoreImg.composite(await Promise.all(borders))

    const score = filtered.reduce((prev, symbol) => prev + symbol.text, "")

    const files = [jacket, scoreImg, diffImg, comboImg]

    const replyContent: InteractionReplyOptions = {
      files: await Promise.all(files.map(async x => new AttachmentBuilder(await x.toBuffer(), { name: "cropped.png" }))),
      content: score
    };
    if (!(interaction.replied || interaction.deferred))
      await interaction.reply(replyContent)
    else await interaction.followUp(replyContent)
  }

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
