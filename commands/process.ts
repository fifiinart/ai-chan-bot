import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions } from "discord.js";
import { getAttachmentsFromInteraction } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { compareJackets } from "../util/pixelmatch";
import { CustomClient } from "..";
import { createErrorEmbed, createProcessEmbed, createSongAnalysisEmbed, createSongDataEmbed } from "../util/embed";
import { analyzeScore } from "../util/analyze-score";
import { stitchMessages } from "../util/stitch-messages";
export const data = new SlashCommandBuilder()
  .setName('process')
  .setDescription('Processes an Arcaea score screenshot.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))

export async function execute(interaction: CommandInteraction) {

  await interaction.deferReply();

  let now = Date.now();

  const result = await getAttachmentsFromInteraction(interaction);
  if (!result.success) {
    return await interaction.followUp({ embeds: [createErrorEmbed(result.error, interaction)] })
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)


  const attachments = result.data;

  const replies: InteractionReplyOptions[] = await Promise.all(attachments.map(async attachment => {
    const processResult = await processScorecard(attachment);

    if (!processResult.success) {
      return { embeds: [createErrorEmbed(processResult.error, interaction)] }
    }

    const { interval } = processResult.time
    const { data } = processResult
    const { score, difficulty, combo } = data.data;

    const files: [string, Buffer][] = [
      ["jacket", data.files.jacket]
    ]


    let songEmbed;
    const startCompareTime = Date.now()
    const song = await compareJackets(difficulty, (interaction.client as CustomClient).db.getCollection("songdata")!, data.files.jacket)
    if (!song.difficulty) {
      songEmbed = [createErrorEmbed("Song not found.", interaction)]
    }
    else {
      songEmbed = [createSongDataEmbed(song.difficulty, song.song.extra, Date.now() - startCompareTime, interaction), createSongAnalysisEmbed(analyzeScore(data.data, song), interaction)]
    }

    return {
      files: files.map(([name, file]) => new AttachmentBuilder(file, { name: name + '.png' })),
      embeds: [createProcessEmbed(interval, score, difficulty, combo, interaction), ...songEmbed]
    };
  }))

  stitchMessages(replies, interaction, 'followUp');

}

