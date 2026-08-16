import { SlashCommandBuilder, type SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import path from "path";
import fs from "fs"
import { importSubcommandsWithGroups, subcommandGroupAutocomplete, subcommandGroupExecute } from "../util/subcommand-utils";

const baseData: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
  .setName("db")
  .setDescription("Access the database.");

const commandsPath = path.join(__dirname, 'db');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

const { data, subcommands } = importSubcommandsWithGroups(baseData, commandsPath, commandFiles);

const execute = subcommandGroupExecute(subcommands, data);
const autocomplete = subcommandGroupAutocomplete(subcommands, data);

export { data, execute, autocomplete }