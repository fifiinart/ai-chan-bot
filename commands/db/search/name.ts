import { AutocompleteInteraction, BaseInteraction, CommandInteraction, GuildMember, SlashCommandSubcommandBuilder, bold } from "discord.js";
import type { CustomClient } from "../../.."
import { stitchMessages } from "../../../util/stitch-messages";
import { createDatabaseGetEmbedList, createErrorEmbed, interactionMemberToMemberOrUser } from "../../../util/embed";
import { initializeFuse, searchSongdata } from "../../../util/search";

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Search the database by name.')
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
      { name: "Beyond", value: "3" }).setRequired(false))

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

  return stitchMessages(
    await createDatabaseGetEmbedList(results, user),
    x => interaction.reply(x), interaction.user)
}

export async function autocomplete(interaction: AutocompleteInteraction) {

  const query = interaction.options.getFocused();
  const result = await searchSongdata(interaction.client as CustomClient, 'name', query)
  const names = Array.from(new Set(result.flatMap(x => x.item.difficulties.map(x => x.name))))
  if (names.length > 25) names.splice(25)
  interaction.respond(names.map(name => ({ name, value: name })))

}