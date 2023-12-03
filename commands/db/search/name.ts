import { CommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Search the database by name.')
  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to search for.")
    .setAutocomplete(true)
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  interaction.reply("Search: " + interaction.options.get('name', true).value as string)
}