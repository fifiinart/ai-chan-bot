
// Require the necessary discord.js classes
import { Client, GatewayIntentBits, Collection, SlashCommandBuilder, CommandInteraction, type RESTPostAPIChatInputApplicationCommandsJSONBody, REST, Routes, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, AutocompleteInteraction, Partials } from "discord.js";
import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { Database } from "simpl.db";
import { setupDB } from "./util/database";

export interface CommandLike<C extends SlashCommandBuilder | SlashCommandSubcommandBuilder | SlashCommandSubcommandGroupBuilder = SlashCommandBuilder> {
  data: C
  execute(interaction: CommandInteraction): Promise<void>
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
}

export interface CustomClient extends Client {
  commands: Collection<string, CommandLike>,
  db: Database
}

interface Event<N extends string = string> {
  name: N
  once: boolean
  execute(...args: any): void
}

// Create a new client instance
const client: CustomClient = Object.assign<Client, Omit<CustomClient, keyof Client>>(
  new Client({
    intents: [
      GatewayIntentBits.MessageContent,

      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,

      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions
    ],
    partials: [
      Partials.Channel
    ]
  }),
  {
    commands: new Collection(),
    db: setupDB(new Database({ tabSize: 2 }))
  });

// Log in to Discord with your client's token
client.login(process.env.TOKEN);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
const registerData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command: CommandLike = require(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    registerData.push(command.data.toJSON())
    console.log(`Command ${command.data.name} registered!`)
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event: Event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

const rest = new REST().setToken(process.env.TOKEN!);

(async () => {
  try {
    console.log(`Started refreshing ${registerData.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data: any = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: registerData },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();