import { Emoji, Events, Message, MessageReplyOptions, ReactionEmoji } from "discord.js";
import type { CustomClient } from ".."
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { analyzeScore } from "../util/analyze-score";
import { createSongAnalysisEmbed, createProcessEmbed } from "../util/embed";
import { compareJackets } from "../util/pixelmatch";
import 'dotenv/config'

const registeredChannels = process.env.AUTO_CHANNELS!.split(',')

export const name = Events.MessageCreate
export const once = false;
export async function execute(message: Message) {
  if (registeredChannels.includes(message.channelId)) {
    console.log("Message found!")
    await tryAutoProcess(message)
  }
}

async function tryAutoProcess(message: Message) {
  let now = Date.now();

  const result = await getAttachmentsFromMessage(message);
  if (!result.success) {
    return
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)

  const attachments = result.data;

  for (const attachment of attachments) {

    const processResult = await processScorecard(attachment);

    if (!processResult.success) {
      return
    }

    const { interval } = processResult.time
    const { data } = processResult
    const { score, difficulty, combo } = data.data;

    const song = await compareJackets(difficulty, (message.client as CustomClient).db.getCollection("songdata")!, data.files.jacket)
    if (!song.difficulty) {
      return
    }
    let songEmbed = [createSongAnalysisEmbed(analyzeScore(data.data, song))]

    const replyContent: MessageReplyOptions = {
      embeds: [createProcessEmbed(interval, score, difficulty, combo), ...songEmbed],
      allowedMentions: { repliedUser: false }
    };

    const reaction = await message.react('💬');

    console.log("Reaction collector created")
    const collector = message.createReactionCollector({
      time: 60_000,
      filter: () => true
    })

    collector.on('collect', () => {
      console.log(reaction.emoji.name)
      if (reaction.emoji.name === '💬') {
        console.log("Reaction collected")
        message.reply(replyContent)
        collector.stop()
      }
    })

    collector.on('end', () => {
      console.log("Reaction collector ended")
      reaction.users.remove(message.client.user)
    })
  }
}