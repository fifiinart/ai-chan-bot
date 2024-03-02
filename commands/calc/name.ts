import { AttachmentBuilder, AutocompleteInteraction, BaseInteraction, CommandInteraction, EmbedBuilder, GuildMember, SlashCommandSubcommandBuilder, bold, inlineCode } from "discord.js";
import type { CustomClient } from "../.."
import { ccToLevel, createDatabaseGetEmbedList, createErrorEmbed, createSuccessEmbed, interactionMemberToMemberOrUser } from "../../util/embed";
import { searchSongdata } from "../../util/search";
import { calculatePlayRating } from "../../util/analyze-score";
import { getDifficultyName } from "../../util/process-image";
import path from "path";
import fs from "fs/promises"

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Calculate Play Rating by searching for a song by name.')
  .addIntegerOption(opt => opt
    .setName("score")
    .setDescription("The score to calculate Play Rating for.")
    .setMinValue(0)
    .setRequired(true))
  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to search for.")
    .setAutocomplete(true)
    .setRequired(true))
  .addStringOption(opt => opt
    .setName('difficulty')
    .setDescription('The difficulty of the song to search for.')
    .addChoices(
      { name: "Past", value: "0" },
      { name: "Present", value: "1" },
      { name: "Future", value: "2" },
      { name: "Beyond", value: "3" },
      { name: 'Eternal', value: "4" }).setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const user = interactionMemberToMemberOrUser(interaction.member)

  const nameQuery = interaction.options.get('name', true).value as string
  const difficultyQuery = interaction.options.get('difficulty')

  const results = (await searchSongdata(interaction.client as CustomClient, 'name', nameQuery))
    .map(res => res.item)
    .map(item => ({
      ...item, difficulties: item.difficulties.filter(
        diff => !difficultyQuery || diff.difficulty.toString() === difficultyQuery.value
      )
    }))
    .filter(item => item.difficulties.length > 0)


  if (results.length === 0) {
    return await interaction.reply({ embeds: [createErrorEmbed("No Matches Found", user)] })
  }

  const score = interaction.options.get('score', true).value as number

  const song = results[0];
  const difficulty = song.difficulties[0];
  const playRating = calculatePlayRating(score, difficulty.cc);
  const filename = `${song.id + (difficulty.subid ? '-' + difficulty.subid : '')}.png`
  const { extra } = song

  const embed = createSuccessEmbed("Calculate Play Rating Success", null, user)
    .setThumbnail(`attachment://${filename}`)
    .addFields({
      "name": `Song`,
      "value": `${difficulty.name}
        ${bold('Pack:')} ${extra.pack.base} ${extra.pack.subpack ? "| " + extra.pack.subpack : ""}
        ${bold('Level:')} ${getDifficultyName(difficulty.difficulty)} ${ccToLevel(difficulty)}
        ${bold('CC:')} ${difficulty.cc.toFixed(1)}`
    }, {
      "name": "Calculated Value",
      "value": inlineCode(playRating.toString())
    })


  const file = new AttachmentBuilder(
    await fs.readFile(path.join(process.cwd(), 'jackets', filename)),
    { name: filename }
  )

  interaction.reply({ embeds: [embed], files: [file] })

}

export async function autocomplete(interaction: AutocompleteInteraction) {

  const query = interaction.options.getFocused();
  const result = await searchSongdata(interaction.client as CustomClient, 'name', query)
  const names = Array.from(new Set(result.flatMap(x => x.item.difficulties.map(x => x.name))))
  if (names.length > 25) names.splice(25)
  interaction.respond(names.map(name => ({ name, value: name })))

}