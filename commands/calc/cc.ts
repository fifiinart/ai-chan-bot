import { CommandInteraction, SlashCommandSubcommandBuilder, inlineCode } from "discord.js";
import { createSuccessEmbed, interactionMemberToMemberOrUser } from "../../util/embed";
import { calculatePlayRating } from "../../util/analyze-score";

export const data = new SlashCommandSubcommandBuilder()
  .setName('cc')
  .setDescription('Calculate Play Rating by searching for a song by CC.')
  .addIntegerOption(opt => opt
    .setName("score")
    .setDescription("The score to calculate Play Rating for.")
    .setMinValue(0)
    .setRequired(true))
  .addNumberOption(opt => opt
    .setName("cc")
    .setDescription("The CC to calculate Play Rating for.")
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const cc = interaction.options.get('cc', true).value as number
  const score = interaction.options.get('score', true).value as number
  const playRating = calculatePlayRating(score, cc);

  const embed = createSuccessEmbed("Calculate Play Rating Success", null, interactionMemberToMemberOrUser(interaction.member))
    .addFields({
      "name": "Calculated Value",
      "value": inlineCode(playRating.toString())
    })

  interaction.reply({ embeds: [embed] })

}