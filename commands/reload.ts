import { CommandInteraction, CommandInteractionOptionResolver, SlashCommandBuilder, codeBlock, inlineCode } from "discord.js";
import { CustomClient } from "..";
import fs from "fs/promises"
import path from "path";
import "dotenv/config"
import { createErrorEmbed, createSuccessEmbed } from "../util/embed";

async function rerequireDirectory(dir: string, basePath: string) {
  try {
    const results = await fs.readdir(path.join(basePath, dir), { withFileTypes: true })
    const directories = results.filter(dirent => dirent.isDirectory())
    const files = results.filter(dirent => dirent.isFile() && dirent.name.endsWith('.ts'))

    for (const directory of directories) {
      await rerequireDirectory(path.join(dir, directory.name), basePath)
    }

    for (const file of files) {
      delete require.cache[require.resolve(`${basePath}/${dir}/${file.name}`)];
      require(`${basePath}/${dir}/${file.name}`)
      console.log(`${dir}/${file.name} uncached`)
    }
    console.log(`${dir} directory uncached`)
  } catch (e: any) {
    if (e?.code === "ENOENT")
      console.error(e)
    else throw e;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Reloads a command.')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('The command to reload.')
        .setRequired(true)),
  async execute(interaction: CommandInteraction) {
    if (interaction.member?.user.id !== process.env.OWNER_ID)
      return await interaction.reply("Only the owner of the bot can reload a command!")

    const commandName = (interaction.options as CommandInteractionOptionResolver).getString('command', true).toLowerCase();
    const commands = (interaction.client as CustomClient).commands!;
    const command = commands.get(commandName);

    if (!command) {
      return await interaction.reply({ embeds: [createErrorEmbed(`There is no command with name ${inlineCode(commandName)}!`, interaction)] });
    }

    delete require.cache[require.resolve(`./${command.data.name}.ts`)];
    await rerequireDirectory("util", process.cwd())
    await rerequireDirectory(path.join("commands", command.data.name), process.cwd())

    try {
      const newCommand = require(`./${command.data.name}.ts`);
      if ("data" in newCommand && "execute" in newCommand) {
        commands.delete(command.data.name);
        commands.set(newCommand.data.name, newCommand);
        return await interaction.reply({ embeds: [createSuccessEmbed("Command Reload", null, interaction).setDescription(`Command \`${newCommand.data.name}\` was reloaded!`)] });
      } else {
        return await interaction.reply({ embeds: [createErrorEmbed(`New command \`${command.data.name}\` is not valid - no \`data\`/\`execute\` exports found!`, interaction)] });
      }
    } catch (error) {
      console.error(error);
      return await interaction.reply({ embeds: [createErrorEmbed(`There was an error while reloading a command \`${command.data.name}\`:\n\`${error instanceof Error ? codeBlock(error.message) : ""}\``, interaction)] });
    }
  },
};