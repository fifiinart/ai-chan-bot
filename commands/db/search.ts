import { SlashCommandSubcommandGroupBuilder } from "discord.js";
import path from "path";
import fs from "fs"
import { importSubcommands, subcommandAutocomplete, subcommandExecute } from "../../util/subcommand-utils";

const baseData = new SlashCommandSubcommandGroupBuilder()
  .setName("search")
  .setDescription("Search the database.")

const commandsPath = path.join(__dirname, 'search');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

const { data, subcommands } = importSubcommands(baseData, commandsPath, commandFiles);

const execute = subcommandExecute(subcommands, data);
const autocomplete = subcommandAutocomplete(subcommands, data);

export { data, execute, autocomplete };