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
const imageLinkRegex = /(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|svg|PNG|JPG|JPEG|GIF|SVG))/g

export async function getAttachmentsFromMessage(interaction: CommandInteraction): Promise<RetrieveAttachmentResponse> {
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

    console.log(message.id)
    attachments = [...message.attachments
      .map(attachment => attachment.url), message.content]
      .filter(url => imageLinkRegex.test(url));
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

  console.log("Attachment found: " + attachments)
  return { success: true, data: attachments }
}