import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandsOnlyBuilder, inlineCode } from "discord.js";
import { createErrorEmbed } from "../util/embed";
import path from "path";
import { CommandLike } from "..";
import fs from "fs"

let data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
  .setName("db")
  .setDescription("Access the database.")
const subcommandExecutes = new Map<string, CommandLike["execute"]>()

const commandsPath = path.join(__dirname, 'db');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

function objectIsCommandLike(obj: unknown): obj is CommandLike<SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder> {
  if (typeof obj !== 'object' || !obj) return false;
  if ('data' in obj && 'execute' in obj) {
    if (obj.data instanceof SlashCommandSubcommandBuilder || obj.data instanceof SlashCommandSubcommandGroupBuilder) {
      return true;
    }
  }
  return false;
}

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const subcommand: unknown = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if (objectIsCommandLike(subcommand)) {
    if (subcommand.data instanceof SlashCommandSubcommandBuilder) {
      data = data.addSubcommand(subcommand.data)
    } else {
      data = data.addSubcommandGroup(subcommand.data);
    }
    subcommandExecutes.set(subcommand.data.name, subcommand.execute)
    console.log(`Subcommand ${subcommand.data.name} registered!`)
  } else {
    console.log(`[WARNING] The subcommand at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

async function execute(interaction: CommandInteraction) {
  const group = (<CommandInteractionOptionResolver>interaction.options).getSubcommandGroup()
  if (group) {
    if (subcommandExecutes.has(group)) {
      return subcommandExecutes.get(group)!(interaction)
    }
  }

  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommandExecutes.has(subcommand)) {
    return subcommandExecutes.get(subcommand)!(interaction)
  }
  await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} or group ${inlineCode(group ?? 'N/A')} not found in command ${inlineCode(data.name)}.`, interaction)] })
}
export { data, execute }