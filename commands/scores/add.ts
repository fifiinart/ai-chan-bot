import { AutocompleteInteraction, CommandInteraction, SlashCommandSubcommandBuilder } from "discord.js";
import type { CustomClient } from "../.."
import { createErrorEmbed, createSongAnalysisEmbed, interactionMemberToMemberOrUser } from "../../util/embed";
import { searchSongdata } from "../../util/search";
import { analyzeScore } from "../../util/analyze-score";
import { addScore, scoreAnalysisToDBEntry } from "../../util/personal-scores";
import { createAddScoreEmbed } from "../../util/embed";

export const data = new SlashCommandSubcommandBuilder()
  .setName('add')
  .setDescription('Add a score into your personal entries.')

  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to add.")
    .setAutocomplete(true)
    .setRequired(true))
  .addStringOption(opt => opt
    .setName('difficulty')
    .setDescription('The difficulty of the song to add.')
    .addChoices(
      { name: "Past", value: "0" },
      { name: "Present", value: "1" },
      { name: "Future", value: "2" },
      { name: "Beyond", value: "3" },
      { name: 'Eternal', value: "4" }).setRequired(true))
  .addIntegerOption(opt => opt
    .setName("score")
    .setDescription("The score to add.")
    .setMinValue(0)
    .setRequired(true))
  .addIntegerOption(opt => opt
    .setName('combo')
    .setDescription('The combo of the score to add.')
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const user = interactionMemberToMemberOrUser(interaction.member)

  const nameQuery = interaction.options.get('name', true).value as string
  const difficultyQuery = interaction.options.get('difficulty')

  const results = (await searchSongdata(interaction.client as CustomClient, 'name', nameQuery))
    .map(res => res.item)
    .map(item => ({
      ...item, difficulties: item.difficulties.filter(
        diff => !difficultyQuery || diff.difficulty.toString() === difficultyQuery.value
      )
    }))
    .filter(item => item.difficulties.length > 0)


  if (results.length === 0) {
    return await interaction.reply({ embeds: [createErrorEmbed("No Matches Found", user)] })
  }

  const score = interaction.options.get('score', true).value as number
  const combo = interaction.options.get('combo', true).value as number

  const song = results[0];
  const difficulty = song.difficulties[0];
  const analysis = analyzeScore({ combo, score, difficulty: difficulty.difficulty }, { song, difficulty })

  const entry = scoreAnalysisToDBEntry({ song, difficulty }, { combo, score, difficulty: difficulty.difficulty }, analysis);
  const result = addScore((interaction.client as CustomClient).db, interaction.user.id, entry)

  // const filename = `${song.id + (difficulty.subid ? '-' + difficulty.subid : '')}.png`
  interaction.reply({
    embeds: [createAddScoreEmbed(entry, result, user), createSongAnalysisEmbed(analysis)],
    // files: [new AttachmentBuilder(
    //   await fs.readFile(path.join(process.cwd(), 'jackets', filename)),
    //   { name: "jacket.png" }
    // )]
  })

}

export async function autocomplete(interaction: AutocompleteInteraction) {

  const query = interaction.options.getFocused();
  const result = await searchSongdata(interaction.client as CustomClient, 'name', query)
  const names = Array.from(new Set(result.flatMap(x => x.item.difficulties.map(x => x.name))))
  if (names.length > 25) names.splice(25)
  interaction.respond(names.map(name => ({ name, value: name })))

}


