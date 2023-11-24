import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions } from "discord.js";
import { getDifficultyName } from "../util/img-format-constants";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { compareJackets } from "../util/pixelmatch";
import { CustomClient } from "..";
import sharp from "sharp";
import { createErrorEmbed, createProcessEmbed, createSongDataEmbed } from "../util/embed";
export const data = new SlashCommandBuilder()
  .setName('process')
  .setDescription('Processes an Arcaea score screenshot.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))

export async function execute(interaction: CommandInteraction) {

  let now = Date.now();

  const result = await getAttachmentsFromMessage(interaction);
  if (!result.success) {
    return await interaction.followUp({ embeds: [createErrorEmbed(result.error, interaction)] })
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)
  await interaction.deferReply();

  const attachments = result.data;

  for (const attachment of attachments) {

    const processResult = await processScorecard(attachment);

    if (!processResult.success) {
      return await interaction.followUp({ embeds: [createErrorEmbed(processResult.error, interaction)] })
    }

    const { interval } = processResult.time
    const { data } = processResult
    const { score, difficulty, combo } = data.data;

    const files: [string, Buffer][] = [
      ["scorecard", data.files.scorecard],
      ["jacket", data.files.jacket],
      ["score-raw", data.files.score.raw],
      ["score-processed", data.files.score.processed],
      ["combo", data.files.combo],
      ["difficulty", data.files.difficulty],
    ]


    let songEmbed;
    const startCompareTime = Date.now()
    const song = await compareJackets((interaction.client as CustomClient).db.getCollection("songdata")!, data.files.jacket)
    if (!song.song) {
      songEmbed = createErrorEmbed("Song not found.", interaction)
    }
    else {
      const diff = song.song[(["past", "present", "future", "beyond"] as const)[data.data.difficulty]]
      if (!diff) {
        songEmbed = createErrorEmbed(`Difficulty ${getDifficultyName(data.data.difficulty)} not found for song \`${song.song.id}\`.`, interaction)
      } else {
        songEmbed = createSongDataEmbed(diff, Date.now() - startCompareTime, interaction)
      }
    }

    const replyContent: InteractionReplyOptions = {
      files: files.map(([name, file]) => new AttachmentBuilder(file, { name: name + '.png' })),
      embeds: [createProcessEmbed(interval, score, difficulty, combo, interaction), songEmbed]
    };
    await interaction.followUp(replyContent)
  }

}

