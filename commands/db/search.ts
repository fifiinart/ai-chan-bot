import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, inlineCode, AutocompleteInteraction } from "discord.js";
import { createErrorEmbed } from "../../util/embed";
import path from "path";
import { CommandLike } from "../..";
import fs from "fs"

let data = new SlashCommandSubcommandGroupBuilder()
  .setName("search")
  .setDescription("Search the database.")
const subcommands = new Map<string, CommandLike<SlashCommandSubcommandBuilder>>()

const commandsPath = path.join(__dirname, 'search');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

function objectIsCommandLike(obj: unknown): obj is CommandLike<SlashCommandSubcommandBuilder> {
  if (typeof obj !== 'object' || !obj) return false;
  if ('data' in obj && 'execute' in obj) {
    if (obj.data instanceof SlashCommandSubcommandBuilder) {
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
    data = data.addSubcommand(subcommand.data);
    subcommands.set(subcommand.data.name, subcommand)
    console.log(`Subcommand ${subcommand.data.name} registered!`)
  } else {
    console.log(`[WARNING] The subcommand at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

async function execute(interaction: CommandInteraction) {
  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommands.has(subcommand)) {
    return subcommands.get(subcommand)!.execute(interaction)
  }
  await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} not found in command ${inlineCode(data.name)}.`, interaction)] })
}

async function autocomplete(interaction: AutocompleteInteraction) {
  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommands.has(subcommand)) {
    const subcommandData = subcommands.get(subcommand)!
    if (typeof subcommandData.autocomplete === "function") {
      return subcommandData.autocomplete(interaction)
    }
  }

  console.error(`No autocomplete function found for subcommand ${inlineCode(subcommand)} in command ${inlineCode(data.name)}.`)
}
export { data, execute, autocomplete };