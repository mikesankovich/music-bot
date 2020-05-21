require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const TOKEN = process.env.TOKEN;
const ytdl = require('ytdl-core');

client.login(TOKEN);

client.on('ready', () => {
  console.info(`Logged in as ${client.user.tag}!`);
});

const queue = new Map();
const state = {

}

client.on('message', msg => {
  const serverQueue = queue.get(msg.guild.id);
  if (msg.content.startsWith('!p')) {
      getMusic(msg, serverQueue);
  }
  if (msg.content.startsWith('!n') || msg.content.startsWith('!next')) {
    if (!serverQueue) {
      msg.channel.send(`Music must be in the queue to use this command`);
      return;
    }
    next(serverQueue, msg.guild);
  }
  if (msg.content.startsWith('!s') || msg.content.startsWith('!stop')) {
    if (!serverQueue) {
      msg.channel.send(`Music must be in the queue to use this command`);
      return;
    }
    stop(serverQueue);
  }
  if (msg.content.startsWith('!ls') || msg.content.startsWith('!loopsong')) {
    if (!serverQueue) {
      msg.channel.send(`Music must be in the queue to use this command`);
      return;
    }
    state[msg.guild.id] = state[msg.guild.id] || {};
    state[msg.guild.id].loopSong = !state[msg.guild.id].loopSong;
    serverQueue.textChannel.send(`Looping is now turned ${state[msg.guild.id].loopSong ? 'On' : 'Off'} for the current song`);
    return;
  }
  if (msg.content.startsWith('!l') || msg.content.startsWith('!loop')) {
    if (!serverQueue) {
      msg.channel.send(`Music must be in the queue to use this command`);
      return;
    }
    state[msg.guild.id] = state[msg.guild.id] || {};
    state[msg.guild.id].loop = !state[msg.guild.id].loop;
    serverQueue.textChannel.send(`Looping is now turned ${state[msg.guild.id].loop ? 'On' : 'Off'}`);
  }
  if (msg.content.startsWith('!q') || msg.content.startsWith('!queue')) {
    if (!serverQueue) {
      msg.channel.send(`Music must be in the queue to use this command`);
      return;
    }
    const x = serverQueue.songs.map((song, i) => `${i + 1}) ${song.title}`).join('\n')

    serverQueue.textChannel.send(`| Queue: \n ${x}`);
  }
});

function next(serverQueue, guild) {
  const { loop, loopSong } = (state[guild.id] || {});
  if (loop && !loopSong) {
    serverQueue.songs.push(serverQueue.songs.shift());
  } else {
    if (!loopSong) {
      serverQueue.songs.shift();
    }
  }
  play(guild, serverQueue.songs[0]);
}

function stop(serverQueue) {
  serverQueue.songs = [];
  serverQueue.voiceChannel.leave();
}

async function getMusic(message, serverQueue) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return console.error("The channel does not exist!");

  console.log("Successfully connected.");
  const songInfo = message.content.substr(message.content.indexOf(' ')+1)
  const { title, video_url: url } = await ytdl.getInfo(songInfo);
  const song = { title, url };
  if (!serverQueue || !client.voice.connections.has(voiceChannel.guild.id)) {
    const queueConstruct = {
      textChannel: message.channel,
      voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    }
    queue.set(message.guild.id, queueConstruct)
    queueConstruct.songs.push(song)
    try {
      var connection = await voiceChannel.join();
      queueConstruct.connection = connection;
      play(message.guild, queueConstruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`${song.title} has been added to the queue!`);
  }
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      next(serverQueue, guild);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}
