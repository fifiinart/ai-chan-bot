import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonStyle, CommandInteraction, ComponentType, InteractionReplyOptions, InteractionResponse, Message } from "discord.js";

const setDisabledAll = (buttons: ButtonBuilder[]) => (disabled: boolean[]) => buttons.forEach((b, i) => b.setDisabled(disabled[i]))

export async function stitchMessages(messages: readonly BaseMessageOptions[], interaction: CommandInteraction, action: 'reply'): Promise<InteractionResponse>
export async function stitchMessages(messages: readonly BaseMessageOptions[], interaction: CommandInteraction, action: 'followUp'): Promise<Message>
export async function stitchMessages(messages: readonly BaseMessageOptions[], interaction: CommandInteraction, action: 'editReply'): Promise<Message>
export async function stitchMessages(messages: readonly BaseMessageOptions[], interaction: CommandInteraction, action: 'reply' | 'followUp' | 'editReply') {

  if (messages.length === 1) {
    return await interaction[action](messages[0])
  }

  let index = 0;

  const firstBtn = new ButtonBuilder()
    .setEmoji("⏪")
    .setCustomId("first")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true)
  const prevBtn = new ButtonBuilder()
    .setEmoji("◀")
    .setCustomId("prev")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true)
  const nextBtn = new ButtonBuilder()
    .setEmoji("▶")
    .setCustomId("next")
    .setStyle(ButtonStyle.Primary)
  const lastBtn = new ButtonBuilder()
    .setEmoji("⏩")
    .setCustomId("last")
    .setStyle(ButtonStyle.Primary)

  const buttons = [firstBtn, prevBtn, nextBtn, lastBtn]
  const disabler = setDisabledAll(buttons)

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(buttons)

  const response = await interaction[action]({ ...messages[index], components: [row] } as InteractionReplyOptions)

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: 5 * 60 * 1000,
    filter: btnInt => btnInt.user.id === interaction.user.id
  })

  collector.on("collect", async collected => {
    switch (collected.customId) {
      case 'first':
        index = 0;
        break;
      case 'prev':
        index--;
        break;
      case 'next':
        index++;
        break;
      case 'last':
        index = messages.length - 1
    }

    disabler(
      index === 0 ?
        [true, true, false, false] // disallow going before first element
        : index === messages.length - 1 ?
          [false, false, true, true] // disallow going after last element
          : [false, false, false, false]
    )

    await collected.update({ ...messages[index], components: [row] })
  }).on("end", async collected => {
    disabler([true, true, true, true])
    await response.edit({ ...messages[index], components: [row] })
  })

  return response
}