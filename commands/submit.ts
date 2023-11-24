import { SlashCommandBuilder, CommandInteraction, AttachmentBuilder, InteractionReplyOptions, GuildMember, CommandInteractionOptionResolver } from "discord.js";
import { Difficulty } from "../util/img-format-constants";
import { getAttachmentsFromMessage } from "../util/get-attachments";
import { processScorecard } from "../util/process-scorecard";
import { SongData, SongDifficultyData } from "../util/database";
import fs from "fs/promises"
import path from "path";
import { CustomClient } from "..";
export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submits an Arcaea jacket with information to the database.')
  .addStringOption(opt => opt
    .setName('image')
    .setDescription('Link to the score image, can be "m1" or blank to scrape from your last submission.')
    .setRequired(false))
  .addStringOption(opt => opt
    .setName("id")
    .setDescription("The id of the jacket to add/overwrite the record."))
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
  const name = options.getString('song')!.trim()
  const artist = options.getString('artist')!.trim()
  const charter = options.getString('charter')!.trim()
  const cc = options.getNumber('cc')!
  const notes = options.getInteger('notes')!
  const difficulty = +options.getString('difficulty')! as Difficulty
  const key: keyof SongData = (["past", "present", "future", "beyond"] as const)[difficulty]

  const difficultyData: SongDifficultyData = { name, artist, charter, cc, notes, difficulty }

  const SongData = (interaction.client as CustomClient).db.getCollection<SongData>("songdata")!
  if (SongData.has(target => target.jacketPath === id)) {
    SongData.update(x => {
      x[key] = difficultyData
    }, target => target.jacketPath === id)
  } else {
    SongData.create({ jacketPath: id, [key]: difficultyData })
  }

  const jacketPath = path.join(__dirname, '..', 'jackets', id + '.png')
  await fs.writeFile(jacketPath, jacket)

  return interaction.followUp("Database updated!")
}