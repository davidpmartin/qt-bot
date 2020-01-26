const Discord = require("discord.js");
const { MessageEmbed } = require("discord.js");
const { prefix, token, ytKey } = require("./config.json");
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


// Message events 
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
      skip(message, serverQueue);
      break;

    case "stop":
      stop(message, serverQueue);
      break;

    case "queue":
      sendQueue(message, serverQueue);
      break;
  }
});

/* 
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
 */

/**
 * Help Msg
 */
function help(msg) {
  msg.channel.send("Help requested!!");
}

/**
 * Handles a play music command
 */
async function execute(message, serverQueue) {
  const args = message.content.split(" ");
  const voiceChannel = message.member.voiceChannel;

  // Check conditions (in voice channel and perms)
  if (!voiceChannel)
    return message.channel.send("You need to be in a voice channel to play music");
  const perms = voiceChannel.permissionsFor(message.client.user);
  if (!perms.has("CONNECT") || !perms.has("SPEAK")) {
    return message.channel.send(
      `You do not have permissions to join and speak in the channel ${voiceChannel}`
    );
  }

  // Get search results
  try {
    const search = args.slice(1).join()
    const results = await youtube.searchVideos(search, 10);
    const vidArr = [];

    // Generate an array contains all video titles
    for (let i = 0; i < results.length; i++) {
      vidArr.push(`${i + 1}: ${results[i].title}`);
    }
    vidArr.push("c (cancel)");

    // Create an embeded message
    const embed = new Discord.RichEmbed()
      .setColor("#e9f931")
      .setTitle("Choose from the following search results:")
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
      .addField("cancel (c)", vidArr[10]); // user can reply with 'c' if none matches
    var songEmbed = await message.channel.send({ embed });

    // Wait for response to selection
    try {
      var response = await message.channel.awaitMessages(msg => (msg.content > 0 && msg.content <= 10) || msg.content === 'c',
        {
          max: 1,
          maxProcessed: 1,
          time: 60000,
          errors: ['time']
        }
      );
      var userSelection = parseInt(response.first().content);

    } catch (err) {
      console.error(err);
      songEmbed.delete();
      return message.channel.send('Please try again and enter a number between 1 and 10 or c')
    }

    // Handle cancel selection
    if (response.first().content.toLowerCase() === 'c') return songEmbed.delete();

    // Get video data from youtube api
    try {
      var video = await youtube.getVideoByID(results[userSelection - 1].id);
    } catch (err) {
      console.error(err);
      songEmbed.delete();
      return message.channel.send("An error occured when trying to retrieve the video ID from youtube")
    };

    // Store song details
    const url = `https://www.youtube.com/watch?v=${video.raw.id}`;
    const title = video.title;
    const duration = video.duration;
    const thumbnail = video.thumbnails.high.url;
    const song = {
      url,
      title,
      duration,
      thumbnail,
      voiceChannel
    }

    // Remove the selection
    songEmbed.delete()

    if (!serverQueue) {
      const queueSchema = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 3,
        playing: true
      };
      queue.set(message.guild.id, queueSchema);
      queueSchema.songs.push(song);

      try {
        var connection = await voiceChannel.join();
        queueSchema.connection = connection;
        play(message.guild, message);
      } catch (err) {
        console.log(err);
        queue.delete(message.guild.id);
        return message.channel.send(err);
      }
    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`'${song.title}' added to the queue!`);
    }

  } catch (err) {
    console.log(err);
    if (songEmbed) {
      songEmbed.delete();
    }
    return message.channel.send("Something went wrong searching for your song :(");
  }
}

/**
 * Plays a song
 */
async function play(guild, message) {
  const serverQueue = queue.get(guild.id);
  const song = serverQueue.songs[0];
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = await serverQueue.connection
    .playOpusStream(await ytdl(song.url,
      { quality: 'highestaudio' }), { highWaterMark: 1024 * 1024 * 10 })
    .on("start", () => {

      // Display current song
      const songEmbed = new Discord.RichEmbed()
        .setColor('#e9f931')
        .addField('Now Playing:', song.title)
        .addField('Duration: ', song.duration)
      if (serverQueue.songs[1]) songEmbed.addField('Next Song: ', serverQueue.songs[1].title);
      message.channel.send(songEmbed);
      return serverQueue.songs.shift();

    })
    .on("end", () => {
      console.log("Music ended!");
      if (serverQueue.songs[0]) return play(guild, message);
    })
    .on("error", err => {
      console.error(err);
      message.channel.send("Error playing song");
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

/**
 * Skips a song in the queue
 */
function skip(message, serverQueue) {
  if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel!!');
  if (!serverQueue) return message.channel.send('There is no song to be skipped!');
  serverQueue.connection.dispatcher.end();
}

/**
 * Stops play
 */
function stop(message, serverQueue) {
  if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel!!');
  if (!serverQueue) return message.channel.send('There is no song to be stopped!');
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}

/**
 * Shows the song queue
 */
function sendQueue(message, serverQueue) {
  if (!serverQueue) return message.channel.send("No songs currently in queue!");
  if (!serverQueue.songs) return message.channel.send("No songs currently in queue!");
  const queueEmbed = new Discord.RichEmbed()
    .setColor('#e9f931')
  for (let i = 0; i < serverQueue.songs.length; i++) {
    queueEmbed.addField(`${i + 1}`, `${serverQueue.songs[i].title}`)
  }
  message.channel.send(queueEmbed);
}

// Initialize
client.login(token);
