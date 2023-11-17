import { CommandInteraction, GuildMember } from "discord.js";

const { SlashCommandBuilder } = require('discord.js');

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Provides information about the server.')

export async function execute(interaction: CommandInteraction) {
  // interaction.user is the object representing the User who ran the command
  // interaction.member is the GuildMember object, which represents the user in the specific guild
  await interaction.reply(`This server is ${interaction.guild?.name} and has ${interaction.guild?.memberCount} members.`);
}
