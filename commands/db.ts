import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, inlineCode, type SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from "discord.js";
import { createErrorEmbed, interactionMemberToMemberOrUser } from "../util/embed";
import path from "path";
import type { CommandLike } from ".."
import fs from "fs"

let data: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
  .setName("db")
  .setDescription("Access the database.")
const subcommands = new Map<string, CommandLike<SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder>>()

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
    subcommands.set(subcommand.data.name, subcommand)
    console.log(`Subcommand ${subcommand.data.name} registered!`)
  } else {
    console.log(`[WARNING] The subcommand at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

async function execute(interaction: CommandInteraction) {
  const group = (<CommandInteractionOptionResolver>interaction.options).getSubcommandGroup()
  if (group) {
    if (subcommands.has(group)) {
      return subcommands.get(group)!.execute(interaction)
    }
  }

  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommands.has(subcommand)) {
    return subcommands.get(subcommand)!.execute(interaction)
  }
  await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} or group ${inlineCode(group ?? 'N/A')} not found in command ${inlineCode(data.name)}.`, interactionMemberToMemberOrUser(interaction.member))] })
}

async function autocomplete(interaction: AutocompleteInteraction) {
  const group = (<CommandInteractionOptionResolver>interaction.options).getSubcommandGroup()
  if (group) {
    if (subcommands.has(group)) {
      if (subcommands.get(group)!.autocomplete)
        return subcommands.get(group)!.autocomplete!(interaction)
    }
  }

  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommands.has(subcommand)) {
    if (subcommands.get(subcommand)!.autocomplete)
      return subcommands.get(subcommand)!.autocomplete!(interaction)
  }

  console.error(`No autocomplete function found for subcommand ${inlineCode(subcommand)} or group ${inlineCode(group ?? 'N/A')} in command ${inlineCode(data.name)}.`)
}

export { data, execute, autocomplete }