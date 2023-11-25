import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions } from "discord.js";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { compareJackets } from "../util/pixelmatch";
import { CustomClient } from "..";
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
    return await interaction.reply({ embeds: [createErrorEmbed(result.error, interaction)] })
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
      ["jacket", data.files.jacket]
    ]


    let songEmbed;
    const startCompareTime = Date.now()
    const song = await compareJackets(difficulty, (interaction.client as CustomClient).db.getCollection("songdata")!, data.files.jacket)
    if (!song.difficulty) {
      songEmbed = createErrorEmbed("Song not found.", interaction)
    }
    else {
      songEmbed = createSongDataEmbed(song.difficulty, Date.now() - startCompareTime, interaction)
    }

    const replyContent: InteractionReplyOptions = {
      files: files.map(([name, file]) => new AttachmentBuilder(file, { name: name + '.png' })),
      embeds: [createProcessEmbed(interval, score, difficulty, combo, interaction), songEmbed]
    };
    await interaction.followUp(replyContent)
  }

}

