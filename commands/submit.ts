import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions, GuildMember, CommandInteractionOptionResolver } from "discord.js";
import { Difficulty, JACKET_RESOLUTION } from "../util/img-format-constants";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { SongData, SongDifficultyData } from "../util/database";
import fs from "fs/promises"
import path from "path";
import { CustomClient } from "..";
import sharp from "sharp";
import { createUpdateDatabaseEmbed } from "../util/embed";
export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submits an Arcaea jacket with information to the database.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))
  .addStringOption(opt => opt
    .setName("id")
    .setDescription("The id of the song to add/overwrite the record."))
  .addStringOption(opt => opt
    .setName("subid")
    .setDescription("The subid of the jacket to add/overwrite the record. For songs with special jacket variants only."))
  .addStringOption(opt => opt
    .setName('difficulty')
    .setDescription('The difficulty of the submitted score.')
    .addChoices(
      { name: "Past", value: "0" },
      { name: "Present", value: "1" },
      { name: "Future", value: "2" },
      { name: "Beyond", value: "3" }))
  .addStringOption(opt => opt
    .setName('song').setDescription('The song name.'))
  .addStringOption(opt => opt
    .setName('artist').setDescription('The artist name.'))
  .addStringOption(opt => opt
    .setName('charter').setDescription('The charter name as listed, for that difficulty.'))
  .addNumberOption(opt => opt
    .setName('cc').setDescription('The chart constant.').setMinValue(0))
  .addIntegerOption(opt => opt
    .setName('notes').setDescription('The number of notes for that chart.').setMinValue(0))

export async function execute(interaction: CommandInteraction) {

  let now = Date.now();

  const result = await getAttachmentsFromMessage(interaction);
  if (!result.success) {
    return await interaction.reply(result.error);
  }

  console.log("Get attachments: %ds", -(now - Date.now()) / 1000)
  await interaction.deferReply();

  const attachments = result.data;

  if (attachments.length > 1) {
    return await interaction.followUp('Multiple images given.')
  }

  const [attachment] = attachments;

  const processResult = await processScorecard(attachment);

  if (!processResult.success) {
    return await interaction.followUp(processResult.error);
  }

  const { data } = processResult

  const { jacket } = data.files

  const options = interaction.options as CommandInteractionOptionResolver

  const id = options.getString('id')!.trim()
  const subid = options.getString('subid')?.trim()
  const name = options.getString('song')!.trim()
  const artist = options.getString('artist')!.trim()
  const charter = options.getString('charter')!.trim()
  const cc = options.getNumber('cc')!
  const notes = options.getInteger('notes')!
  const difficulty = +options.getString('difficulty')! as Difficulty

  const difficultyData: SongDifficultyData = { name, artist, charter, cc, notes, difficulty, subid: subid ?? undefined }

  const SongData = (interaction.client as CustomClient).db.getCollection<SongData>("songdata")!
  if (SongData.has(target => target.id === id)) {
    SongData.update(x => {
      const i = x.difficulties.findIndex(d => d.difficulty === difficulty && (d.subid ?? "" === subid ?? ""))
      if (i !== -1) {
        x.difficulties[i] = difficultyData;
      } else {
        x.difficulties.push(difficultyData)
      }
    }, target => target.id === id)
  } else {
    SongData.create({ id: id, difficulties: [difficultyData] })
  }

  const jacketPath = path.join(__dirname, '..', 'jackets', id + (subid ? "-" + subid : "") + '.png')
  await fs.writeFile(jacketPath, await sharp(jacket).resize(JACKET_RESOLUTION).ensureAlpha().png().toBuffer())

  return interaction.followUp({
    files: [new AttachmentBuilder(jacket, { name: "jacket.png" })],
    embeds: [createUpdateDatabaseEmbed(id, difficultyData, Date.now() - now, interaction)]
  })
}
