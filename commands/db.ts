import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, inlineCode } from "discord.js";
import * as submit from './db/submit'
import { createErrorEmbed } from "../util/embed";

export const data = new SlashCommandBuilder()
  .setName("db")
  .setDescription("Access the database.")
  .addSubcommand(submit.data)

const subcommandExecutes = new Map([submit].map(subcommand => [subcommand.data.name, subcommand.execute]))

export async function execute(interaction: CommandInteraction) {
  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommandExecutes.has(subcommand)) {
    return subcommandExecutes.get(subcommand)!(interaction)
  }
  await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} not found in command ${inlineCode(data.name)}.`, interaction)] })
}