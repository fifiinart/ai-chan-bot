import { CommandInteraction, CommandInteractionOptionResolver, Message } from "discord.js"

export interface RetrieveAttachmentSuccess {
  success: true,
  data: string[]
}

export interface RetrieveAttachmentFailure {
  success: false,
  error: string
}

export type RetrieveAttachmentResponse = RetrieveAttachmentSuccess | RetrieveAttachmentFailure

const relativeLinkRegex = /^[mM](\d+)$/
const imageLinkRegex = /(http)?s?:?(\/\/[^"'\s]*\S(?:png|jpg|jpeg|gif|svg))/gi

export async function getAttachmentsFromInteraction(interaction: CommandInteraction): Promise<RetrieveAttachmentResponse> {
  const link = (interaction.options as CommandInteractionOptionResolver).getString('image')?.trim()
  // TODO: find a way to act on an image that the user replies to

  let attachments: string[]
  if ((link === undefined) || (relativeLinkRegex.test(link))) {
    const scrapeDist = link ? parseInt(link.substring(1)) : 1
    const messages = await interaction.channel?.messages.fetch()!

    // i hate myself
    let message: Message | null = null
    let counter = 0
    for (let msg of messages.values()) {
      if (msg.author.id === interaction.user.id) counter++;

      if (counter === scrapeDist) {
        message = msg;
        break;
      }
    }

    if (!message) {
      return { success: false, error: "Message not found." }
    }

    attachments = [...message.attachments.mapValues(x => x.url).values(), message.content].flatMap(att => att.match(imageLinkRegex) ?? [])
    if (attachments.length > 0) message.react('✅');

  } else {
    const matches = link.match(imageLinkRegex)
    if (!matches) {
      return { success: false, error: "Invalid image attachment." }
    }
    attachments = matches
  }

  if (attachments.length == 0) {
    return { success: false, error: "No attachments found." }
  }

  console.log("Attachments found: " + attachments.length)
  return { success: true, data: attachments }
}

export async function getAttachmentsFromMessage(message: Message): Promise<RetrieveAttachmentResponse> {
  let attachments = [...message.attachments.mapValues(x => x.url).values(), message.content].flatMap(att => att.match(imageLinkRegex) ?? [])
  if (attachments.length > 0) await message.react('✅');
  const matches = message.content.match(imageLinkRegex)
  attachments.push(...(matches ?? []))

  if (attachments.length == 0) {
    return { success: false, error: "No attachments found." }
  }

  console.log("Attachments found: " + attachments.length)
  return { success: true, data: attachments }
}