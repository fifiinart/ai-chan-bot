import { CacheType, Events, Interaction } from "discord.js";
import type { CustomClient } from "../index"

export const name = Events.InteractionCreate
export const once = false;
export async function execute(interaction: Interaction<CacheType>) {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as CustomClient).commands?.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
}