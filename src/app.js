import express from "express"
import * as fs from "fs"
import * as path from "path"
import { fetch, setGlobalDispatcher, Agent, ProxyAgent } from 'undici'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (process.env.https_proxy || process.env.http_proxy) {
    setGlobalDispatcher(new ProxyAgent({
        connect: { timeout: 60_000 },
        uri: process.env.https_proxy ? process.env_https_proxy : process.env_http_proxy
    }));
} else {
    setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));
}
const app = express()

let credits = {}
let empty_credits = {};
let last_refreshed = Date.now()

async function load_credits() {
    const credits_content = fs.readFileSync(path.join(process.cwd(), "credits.json")).toString()
    try {
        empty_credits = { ...JSON.parse(credits_content) }
    } catch (e) {
        console.warn(`failed to reload credits: ${e}`);
    }

    last_refreshed = Date.now()
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// thanks prevter!
const parseKeyMap = (keyMap) => keyMap.split(":")
    .reduce((acc, key, index, array) => {
        if (index % 2 === 0) {
            acc[key] = array[index + 1];
        }
        return acc;
    }, {});

async function update_credits() {
    let is_being_rate_limited = false
    Object.keys(empty_credits).forEach((role) => {
        if (is_being_rate_limited) {
            return
        }

        if (!Object.keys(credits).includes(role) || credits[role].length != empty_credits[role].length) {
            credits[role] = Array(empty_credits[role].length)
        }

        empty_credits[role].forEach((user, index) => {
            (async () => {
                if (is_being_rate_limited) {
                    return
                }
                let new_user = { ...user };

                const res = await fetch("http://www.boomlings.com/database/getGJUserInfo20.php", {
                    method: "POST",
                    body: new URLSearchParams({
                        secret: "Wmfd2893gb7",
                        targetAccountID: `${user.accountID}`
                    }),
                    headers: {
                        "User-Agent": ""
                    }
                }).then(res => res.text());
                if (res.split(":")[1] == " 1015") {
                    console.log("being ratelimited! ending cache update")
                    is_being_rate_limited = true
                    return
                }
                const data = parseKeyMap(res)
                const color1 = parseInt(data["10"])
                const color2 = parseInt(data["11"])
                const gameName = data["1"];
                let color3 = parseInt(data["51"])
                if (parseInt(data["28"]) == 0) {
                    color3 = -1
                }
                const iconID = parseInt(data["21"])

                new_user["color1"] = color1
                new_user["color2"] = color2
                new_user["color3"] = color3
                new_user["iconID"] = iconID
                new_user["gameName"] = gameName

                credits[role][index] = new_user
                // console.log(iconID, color1, color2, color3)
                // await sleep(2 * 1000)
                // credits[role].sort((a, b) => {
                //     if (a.name > b.name) {
                //         return 1;
                //     }
                //     if (a.name < b.name) {
                //         return -1;
                //     }
                // })
            })()
        })
    })
    if (is_being_rate_limited) return
}

app.get("/credits", (req, res) => {
    `
    The format for the credits is as follows:

    {
        "name": "ninXout",
        "userID": 87315798329,
        "accountID": 486522312,
        "iconID": 128,
        "color1": 89,
        "color2": 129,
        "color3": 5
    }

    these will be separated into their own groups, such as Owner, Staff, Contributer, and Special Thanks

    So the format of the response as a whole is:
    {
        "owner": {...credits},
        "staff": {...credits},
        "contrib": {...credits}
    }
    and so on.
    `

    console.log(`sending ${JSON.stringify(credits)}`);
    res.json(credits)

    if (Date.now() - last_refreshed >= 24 * 3600 * 1000) { // 24 * 3600 * 1000 = 24 hours in milliseconds
        // I am aware this looks like a JavaScript warcrime
        // You'd be right
        (async () => {
            await update_credits()
        })()
    }
})

await load_credits()
await update_credits()

let last_watch_change = Date.now();
const watch_min_period = 1000; // 1s

fs.watch("credits.json", (eventType, filename) => {
    if (eventType == "change") {
        if (Date.now() - last_watch_change > watch_min_period) {
            last_watch_change = Date.now();
            (async () => {
                console.log("file changed! updating cache!")
                await load_credits()
                await update_credits()
            })()
        }
    }
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`Globed credits server listening on port ${PORT}`)
})
