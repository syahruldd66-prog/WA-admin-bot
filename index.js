const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const P = require("pino")
const config = require("./config")

async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./session")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const m = messages[0]
        if (!m.message) return

        const from = m.key.remoteJid
        const isGroup = from.endsWith("@g.us")

        // Tolak chat pribadi
        if (!isGroup) {
            await sock.sendMessage(from, {
                text: "❌ Bot hanya bisa digunakan di grup."
            })
            return
        }

        const text =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            ""

        if (!text.startsWith(config.prefix)) return

        const args = text.slice(1).trim().split(/ +/)
        const command = args.shift().toLowerCase()

        const metadata = await sock.groupMetadata(from)

        const participants = metadata.participants

        const sender = m.key.participant

        const admins = participants
            .filter(v => v.admin)
            .map(v => v.id)

        const isAdmin = admins.includes(sender)

        // Hanya admin
        if (!isAdmin) {
            return sock.sendMessage(from, {
                text: "❌ Hanya admin grup yang dapat menggunakan bot."
            })
        }

        switch (command) {

            case "menu":
                sock.sendMessage(from, {
                    text:
`📋 MENU ADMIN

!tagall
!kick
!open
!close
!hidetag`
                })
            break

            case "tagall":

                let members = participants.map(v => v.id)

                sock.sendMessage(from, {
                    text: "📢 Tag Semua Anggota",
                    mentions: members
                })

            break

            case "hidetag":

                let all = participants.map(v => v.id)

                sock.sendMessage(from, {
                    text: "Pesan dari admin",
                    mentions: all
                })

            break

            case "open":

                await sock.groupSettingUpdate(
                    from,
                    "not_announcement"
                )

                sock.sendMessage(from, {
                    text: "✅ Grup dibuka."
                })

            break

            case "close":

                await sock.groupSettingUpdate(
                    from,
                    "announcement"
                )

                sock.sendMessage(from, {
                    text: "✅ Grup ditutup."
                })

            break

            case "kick":

                if (!m.message.extendedTextMessage) {
                    return sock.sendMessage(from, {
                        text: "Tag anggota yang ingin dikick."
                    })
                }

                let target =
                    m.message.extendedTextMessage.contextInfo
                    .mentionedJid[0]

                await sock.groupParticipantsUpdate(
                    from,
                    [target],
                    "remove"
                )

                sock.sendMessage(from, {
                    text: "✅ Anggota berhasil dikeluarkan."
                })

            break
        }

    })

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {

        if (connection === "close") {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut

            if (shouldReconnect) {
                startBot()
            }
        }

        if (connection === "open") {
            console.log("BOT ONLINE")
        }
    })
}

startBot()
