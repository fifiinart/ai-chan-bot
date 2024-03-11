import { Attachment, AttachmentBuilder, DiscordAPIError, EmbedBuilder, Events, GuildMember, Message, MessageReaction, MessageReplyOptions, ReactionEmoji, User, isJSONEncodable } from "discord.js";
import type { CustomClient } from ".."
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { analyzeScore } from "../util/analyze-score";
import { createSongAnalysisEmbed, createProcessEmbed, createErrorEmbed, replaceUser } from "../util/embed";
import { compareJackets } from "../util/pixelmatch";
import 'dotenv/config'
import { stitchMessages } from "../util/stitch-messages";

const registeredChannels = process.env.AUTO_CHANNELS!.split(',')

export const name = Events.MessageCreate
export const once = false;
export async function execute(message: Message) {
  const user = (message.inGuild() && message.member) || message.author
  if (registeredChannels.includes(message.channelId)) {
    console.log("Message found!")
    await tryAutoProcess(message, user)
  }
}

const embedsHaveErrors = (s: MessageReplyOptions) => s.embeds!.some(e => (isJSONEncodable(e) ? e.toJSON() : e).title === "Error");
async function tryAutoProcess(message: Message, user: User | GuildMember) {
  let now = Date.now();

  const result = await getAttachmentsFromMessage(message);
  if (!result.success) {
    return
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)

  const replies = await Promise.all(result.data.map(async attachment => {
    const processResult = await processScorecard(attachment);

    let embeds: EmbedBuilder[];
    let files: AttachmentBuilder[] = [];
    if (!processResult.success) {
      embeds = [createErrorEmbed(processResult.error, user)];
    } else {

      const { interval } = processResult.time;
      const { data } = processResult;
      const { score, difficulty, combo } = data.data;

      const song = await compareJackets(difficulty, (message.client as CustomClient).db.getCollection("songdata")!, data.files.jacket);
      if (!song.difficulty) {
        embeds = [createErrorEmbed("Song not found.", user)];
      }
      else {
        embeds = [createProcessEmbed(interval, score, difficulty, combo, user).setThumbnail("attachment://jacket.png"), createSongAnalysisEmbed(analyzeScore(data.data, song), user)];
        files = [new AttachmentBuilder(data.files.jacket, { name: "jacket.png" })]
      }
    }

    return {
      embeds,
      allowedMentions: { repliedUser: false },
      files
    } as MessageReplyOptions & { embeds: EmbedBuilder[] };
  }));

  if (replies.every(embedsHaveErrors)) {
    return;
  }

  if (replies.length > 1) {
    replies.forEach((r, i) => r.embeds[0] = r.embeds[0].setTitle(r.embeds[0].data.title + ` (${i + 1}/${replies.length})`))
  }

  try { await collectReactions(message, replies); }
  catch (e) {
    if (!(e instanceof DiscordAPIError && e.code == 10008)) throw e;
    else console.log("Message deleted!")
  }
}

async function collectReactions(message: Message<boolean>, replies: (MessageReplyOptions & { embeds: EmbedBuilder[] })[]) {
  const reaction = await message.react('💬');

  console.log("Reaction collector created");
  const collector = message.createReactionCollector({
    time: 60000,
    filter: (reaction: MessageReaction, user: User) => !user.bot
  });

  collector.on('collect', (reaction: MessageReaction, user: User) => {
    console.log(reaction.emoji.name, user.displayName);
    if (reaction.emoji.name === '💬') {
      console.log("Reaction collected");
      stitchMessages(replies.map(r => ({ ...r, embeds: r.embeds.map(e => replaceUser(e as EmbedBuilder, user)) })), async (x) => message.reply(x));
      collector.stop();
    }
  });

  collector.on('end', () => {
    console.log("Reaction collector ended");
    reaction.users.remove(message.client.user);
  });
}
