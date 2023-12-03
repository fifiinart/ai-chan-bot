import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandsOnlyBuilder, inlineCode } from "discord.js";
import { createErrorEmbed } from "../../util/embed";
import path from "path";
import { CommandLike } from "../..";
import fs from "fs"

let data = new SlashCommandSubcommandGroupBuilder()
  .setName("search")
  .setDescription("Search the database.")
const subcommandExecutes = new Map<string, CommandLike["execute"]>()

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
    subcommandExecutes.set(subcommand.data.name, subcommand.execute)
    console.log(`Subcommand ${subcommand.data.name} registered!`)
  } else {
    console.log(`[WARNING] The subcommand at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

async function execute(interaction: CommandInteraction) {
  const subcommand = (<CommandInteractionOptionResolver>interaction.options).getSubcommand()
  if (subcommandExecutes.has(subcommand)) {
    return subcommandExecutes.get(subcommand)!(interaction)
  }
  await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} not found in command ${inlineCode(data.name)}.`, interaction)] })
}
export { data, execute };