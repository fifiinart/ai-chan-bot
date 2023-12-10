import { AutocompleteInteraction, CommandInteraction, SlashCommandSubcommandBuilder, bold } from "discord.js";
import type { CustomClient } from "../../.."
import type { SongData } from "../../../util/database";
import { stitchMessages } from "../../../util/stitch-messages";

export const data = new SlashCommandSubcommandBuilder()
  .setName('name')
  .setDescription('Search the database by name.')
  .addStringOption(opt => opt
    .setName("name")
    .setDescription("The name of the song to search for.")
    .setAutocomplete(true)
    .setRequired(true))

export async function execute(interaction: CommandInteraction) {
  const query = interaction.options.get('name', true).value as string

  const Fuse = (await import('fuse.js')).default

  const SongData = (interaction.client as CustomClient).db.getCollection<SongData>("songdata")!
  const fuse = new Fuse<SongData>(SongData.getAll(), {
    includeScore: true,
    threshold: 0.2,
    keys: [
      {
        name: "id", weight: .7
      },
      { name: ["difficulties", "name"], weight: .3 }
    ]
  })

  const results = fuse.search(query, {
    limit: 10
  })

  await stitchMessages(
    results.map((result, i) =>
      ({ content: `${bold(`${result.item.difficulties[0].name} (${i + 1}/${results.length})`)}\nScore: ${result.score}` })
    ),
    interaction, 'reply')
}

export async function autocomplete(interaction: AutocompleteInteraction) {
  interaction.respond([{ name: "Hello World", value: "Hello World" }])
}