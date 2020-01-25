const Discord = require("discord.js");
const { MessageEmbed } = require("discord.js");
const { prefix, token, ytKey } = require("./config.json");
//const ytdl = require("ytdl-core");
const YoutubeObj = require("simple-youtube-api");
const youtube = new YoutubeObj(ytKey);
const ytdl = require('ytdl-core-discord');

// Initial vars
const client = new Discord.Client();
const queue = new Map();

// Ready alert
client.once("ready", () => {
  console.log("Ready!");
});


/* Message events 
client.on("message", message => {
  // Don't respond to own messages
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  // Get queue for the server
  const serverQueue = queue.get(message.guild.id);

  // Split words, and remove exclamation marks from first word
  let msgWords = message.content.split(" ");
  msgWords[0] = msgWords[0].slice(1);

  // Handle based on command option
  switch (msgWords[0].toLowerCase()) {
    case "help":
      help(message);
      break;

    case "play":
      execute(message, serverQueue);
      break;

    case "skip":
      break;

    case "stop":
      stop(message, serverQueue);
      break;
  }
}); */


// Testing ytdl-core-discord
const playTest = async (connection, url) => {
  connection.playOpusStream(await ytdl("https://www.youtube.com/watch?v=ed_UWFr13pU",
    { quality: 'highestaudio' }), { highWaterMark: 1024 * 1024 });
};

client.on('message', async (message) => {

  const args = message.content.slice('!').trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === '!p') {
    const voiceConnection = await message.member.voiceChannel;

    voiceConnection.join().then(async connection => {

      playTest(connection, args.toString());

      await message.channel.send(`Now playing ${args}`);
    }).catch(err => console.error(err));
  }
});


/**
 * Help Msg
 */
function help(msg) {
  msg.channel.send("Help requested!!");
}

/**
 * Executes a play command
 */
async function execute(msg, serverQueue) {
  const args = msg.content.split(" ");
  const voiceChannel = msg.member.voiceChannel;

  // Check conditions (in voice channel and perms)
  if (!voiceChannel)
    return msg.channel.send("You need to be in a voice channel to play music");
  const perms = voiceChannel.permissionsFor(msg.client.user);
  if (!perms.has("CONNECT") || !perms.has("SPEAK")) {
    return msg.channel.send(
      `You do not have permissions to join and speak in the channel ${voiceChannel}`
    );
  }

  /**** LATER - SONG SELECTION FUNCTIOANLITY *****/
  // Get song info
  try {
    console.log(args);
    const results = await youtube.searchVideos("zhu faded", 10);
    const vidArr = [];

    // Generate an array contains all video titles
    for (let i = 0; i < results.length; i++) {
      vidArr.push(`${i + 1}: ${results[i].title}`);
    }
    vidArr.push("c (cancel)");

    // Create an embeded message
    const embed = new Discord.RichEmbed()
      .setColor("#e9f931")
      .setTitle("Choose from the following search results (c to cancel)")
      .addField("Song 1", vidArr[0])
      .addField("Song 2", vidArr[1])
      .addField("Song 3", vidArr[2])
      .addField("Song 4", vidArr[3])
      .addField("Song 5", vidArr[4])
      .addField("Song 6", vidArr[5])
      .addField("Song 7", vidArr[6])
      .addField("Song 8", vidArr[7])
      .addField("Song 9", vidArr[8])
      .addField("Song 10", vidArr[9])
      .addField("Exit", vidArr[10]); // user can reply with 'exit' if none matches
    var songEmbed = await msg.channel.send({ embed });

  } catch (err) {
    console.log(err);
    if (songEmbed) {
      songEmbed.delete();
    }
    return msg.channel.send("Something went wrong searching for you video :(");
  }

  const song = {
    title: "testSong",
    url: "https://www.youtube.com/watch?v=N26N7lQHNW8"
  }

  if (!serverQueue) {
    const queueSchema = {
      textChannel: msg.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 3,
      playing: true
    };

    queue.set(msg.guild.id, queueSchema);
    queueSchema.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueSchema.connection = connection;
      play(msg.guild, queueSchema.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(msg.guild.id);
      return msg.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    console.log(serverQueue.songs);
    return msg.channel.send(`'${song.title}' added to the queue!`);
  }
}

/**
 * Plays a song
 */
async function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  let stream = ytdl("https://www.youtube.com/watch?v=ed_UWFr13pU", { filter: 'audioonly' });
  stream.on('error', console.error);

  const dispatcher = await serverQueue.connection
    .playStream(stream)
    .on("end", () => {
      console.log("Music ended!");
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", err => {
      console.error(err);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

/**
 * Skips a song in the queue
 */
function skip() { }

/**
 * Stops play
 */
function stop(message, serverQueue) {
  if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel!!');
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

// Initialize
client.login(token);
