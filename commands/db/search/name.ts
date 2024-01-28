import { AutocompleteInteraction, BaseInteraction, CommandInteraction, SlashCommandSubcommandBuilder, bold } from "discord.js";
import type { CustomClient } from "../../.."
import { stitchMessages } from "../../../util/stitch-messages";
import { createErrorEmbed } from "../../../util/embed";
import { initializeFuse, searchSongdata } from "../../../util/search";

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Search the database by name.')
  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to search for.")
    .setAutocomplete(true)
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const query = interaction.options.get('name', true).value as string

  const results = await searchSongdata(interaction.client as CustomClient, 'name', query)

  if (results.length === 0) {
    return await interaction.reply({ embeds: [createErrorEmbed("No Matches Found", interaction)] })
  }

  return stitchMessages(
    results.map((result, i) =>
      ({ content: `${bold(`${result.item.difficulties[0].name} (${i + 1}/${results.length})`)}\nScore: ${result.score}` })
    ),
    interaction, 'reply')
}

export async function autocomplete(interaction: AutocompleteInteraction) {

  const query = interaction.options.getFocused();
  const result = await searchSongdata(interaction.client as CustomClient, 'name', query)
  const names = Array.from(new Set(result.flatMap(x => x.item.difficulties.map(x => x.name))))
  if (names.length > 25) names.splice(25)
  interaction.respond(names.map(name => ({ name, value: name })))

}