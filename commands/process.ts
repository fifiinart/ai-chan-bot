import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions, GuildMember } from "discord.js";
import { getDifficultyName } from "../util/img-format-constants";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
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
    return await interaction.reply(result.error);
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)
  await interaction.deferReply();

  const attachments = result.data;

  for (const attachment of attachments) {

    const processResult = await processScorecard(attachment);

    if (!processResult.success) {
      return await interaction.followUp(processResult.error);
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

    const replyContent: InteractionReplyOptions = {
      files: files.map(([name, file]) => new AttachmentBuilder(file, { name: name + '.png' })),
      embeds: [{
        "title": `Score Processing Result (${interval / 1000}s)`,
        "description": "",
        "color": 0xe8aeff,
        "fields": [
          {
            "name": `Score`,
            "value": `${score.toString().padStart(8, '0')}`,
            "inline": true
          },
          {
            "name": `Difficulty`,
            "value": `${getDifficultyName(difficulty)}`,
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
    await interaction.followUp(replyContent)
  }

}
