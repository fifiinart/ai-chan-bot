import { AutocompleteInteraction, ChatInputCommandInteraction, inlineCode, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import { CommandLike } from "..";
import path from "path";
import { createErrorEmbed, interactionMemberToMemberOrUser } from "./embed";

export type SubcommandRegister = Map<string, CommandLike<SlashCommandSubcommandBuilder>>
export type SubcommandGroupRegister = Map<string, CommandLike<SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder>>;

export function objectIsSubcommandOrGroupLike(obj: unknown): obj is CommandLike<SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder> {
  if (typeof obj !== 'object' || !obj) return false;
  if ('data' in obj && 'execute' in obj) {
    if (obj.data instanceof SlashCommandSubcommandBuilder || obj.data instanceof SlashCommandSubcommandGroupBuilder) {
      return true;
    }
  }
  return false;
}

export function objectIsSubcommandLike(obj: unknown): obj is CommandLike<SlashCommandSubcommandBuilder> {
  if (typeof obj !== 'object' || !obj) return false;
  if ('data' in obj && 'execute' in obj) {
    if (obj.data instanceof SlashCommandSubcommandBuilder) {
      return true;
    }
  }
  return false;
}

export function importSubcommands<B extends SlashCommandSubcommandGroupBuilder | SlashCommandSubcommandsOnlyBuilder>(data: B, commandsPath: string, commandFiles: string[]) {
  const subcommands: SubcommandRegister = new Map();

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const subcommand: unknown = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (objectIsSubcommandLike(subcommand)) {
      data = data.addSubcommand(subcommand.data) as B;
      subcommands.set(subcommand.data.name, subcommand)
      console.log(`Subcommand ${subcommand.data.name} registered!`)
    } else {
      console.log(`[WARNING] The subcommand at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }

  return { data, subcommands };
}

export function importSubcommandsWithGroups(data: SlashCommandSubcommandsOnlyBuilder, commandsPath: string, commandFiles: string[]) {
  const subcommands: SubcommandGroupRegister = new Map();

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const subcommand: unknown = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (objectIsSubcommandOrGroupLike(subcommand)) {
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

  return { data, subcommands };
}

export function subcommandExecute(subcommands: SubcommandRegister, data: SlashCommandSubcommandGroupBuilder | SlashCommandSubcommandsOnlyBuilder) {
  return async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const cmd = subcommands.get(subcommand);
    if (cmd) {
      return cmd.execute(interaction);
    }
    await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} not found in command ${inlineCode(data.name)}.`, interactionMemberToMemberOrUser(interaction.member))] })
  }
}

export function subcommandAutocomplete(subcommands: SubcommandRegister, data: SlashCommandSubcommandGroupBuilder | SlashCommandSubcommandsOnlyBuilder) {
  return async (interaction: AutocompleteInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const auto = subcommands.get(subcommand)?.autocomplete;
    if (auto) {
      return auto(interaction);
    }

    console.error(`No autocomplete function found for subcommand ${inlineCode(subcommand)} in command ${inlineCode(data.name)}.`)
  }
}

export function subcommandGroupExecute(subcommands: SubcommandGroupRegister, data: SlashCommandSubcommandsOnlyBuilder) {
  return async (interaction: ChatInputCommandInteraction) => {
    const group = interaction.options.getSubcommandGroup()
    const groupCmd = group && subcommands.get(group);
    if (groupCmd) {
      return groupCmd.execute(interaction);
    }

    const subcommand = interaction.options.getSubcommand()
    const cmd = subcommands.get(subcommand);
    if (cmd) {
      return cmd.execute(interaction)
    }
    await interaction.reply({ embeds: [createErrorEmbed(`Subcommand ${inlineCode(subcommand)} or group ${inlineCode(group ?? 'N/A')} not found in command ${inlineCode(data.name)}.`, interactionMemberToMemberOrUser(interaction.member))] })
  }
}

export function subcommandGroupAutocomplete(subcommands: SubcommandGroupRegister, data: SlashCommandSubcommandsOnlyBuilder) {
  return async (interaction: AutocompleteInteraction) => {
    const group = interaction.options.getSubcommandGroup();
    const groupAuto = group && subcommands.get(group)?.autocomplete;
    if (groupAuto) {
      return groupAuto(interaction);
    }

    const subcommand = interaction.options.getSubcommand()
    const auto = subcommands.get(subcommand)?.autocomplete
    if (auto) {
      return auto(interaction);
    }

    console.error(`No autocomplete function found for subcommand ${inlineCode(subcommand)} or group ${inlineCode(group ?? 'N/A')} in command ${inlineCode(data.name)}.`)
  }
}