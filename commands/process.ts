import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions, GuildMember } from "discord.js";
import { getAttachmentsFromInteraction } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { compareJackets } from "../util/pixelmatch";
import { CustomClient } from "..";
import { createErrorEmbed, createProcessEmbed, createSongAnalysisEmbed, createSongDataEmbed, interactionMemberToMemberOrUser } from "../util/embed";
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

  const user = interactionMemberToMemberOrUser(interaction.member)

  await interaction.deferReply();

  let now = Date.now();

  const result = await getAttachmentsFromInteraction(interaction);
  if (!result.success) {
    return await interaction.followUp({ embeds: [createErrorEmbed(result.error, user)] })
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)


  const attachments = result.data;

  const replies = await Promise.all(attachments.map(async attachment => {
    const processResult = await processScorecard(attachment);

    if (!processResult.success) {
      return { embeds: [createErrorEmbed(processResult.error, user)] }
    }

    const { interval } = processResult.time
    const { data } = processResult
    const { score, difficulty, combo } = data.data;

    const files: [string, Buffer][] = [
      ["jacket", data.files.jacket],
    ]


    let songEmbed;
    const startCompareTime = Date.now()
    const song = await compareJackets(difficulty, (interaction.client as CustomClient).db.getCollection("songdata")!, data.files.jacket)
    if (!song.difficulty) {
      songEmbed = [createErrorEmbed("Song not found.", user)]
    }
    else {
      songEmbed = [createSongDataEmbed(song.difficulty, song.song.extra, Date.now() - startCompareTime, user), createSongAnalysisEmbed(analyzeScore(data.data, song), user)]
    }

    return {
      files: files.map(([name, file]) => new AttachmentBuilder(file, { name: name + '.png' })),
      embeds: [createProcessEmbed(interval, score, difficulty, combo, user), ...songEmbed]
    };
  }))

  if (replies.length > 1) {
    replies.forEach((r, i) => r.embeds[0].setTitle(`(${i + 1}/${replies.length})`))
  }

  stitchMessages(replies, x => interaction.followUp(x), interaction.user);

}

