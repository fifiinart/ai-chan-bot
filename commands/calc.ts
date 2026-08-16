import { SlashCommandBuilder, type SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import path from "path";
import fs from "fs"
import { importSubcommands, subcommandAutocomplete, subcommandExecute } from "../util/subcommand-utils";

const baseData: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
  .setName("calc")
  .setDescription("Calculate Play Rating.");

const commandsPath = path.join(__dirname, 'calc');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

const { data, subcommands } = importSubcommands(baseData, commandsPath, commandFiles);

const execute = subcommandExecute(subcommands, data);
const autocomplete = subcommandAutocomplete(subcommands, data);

export { data, execute, autocomplete }