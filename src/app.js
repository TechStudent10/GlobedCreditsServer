import express from "express"
import * as fs from "fs"
import * as path from "path"

const app = express()

let credits = {}
let last_refreshed = Date.now()

function load_credits() {
    const credits_content = fs.readFileSync(path.join(process.cwd(), "credits.json")).toString()
    credits = {...JSON.parse(credits_content)}
    // credits = {...JSON.parse(`
    // {"owner":[{"name":"Availax","accountID":1621348,"userID":8463710,"color1":6,"color2":52,"color3":11,"iconID":373},{"name":"dankmeme01","accountID":9735891,"userID":88588343,"color1":41,"color2":16,"color3":15,"iconID":1}],"staff":[{"name":"LimeGradient","accountID":7214334,"userID":42454266,"color1":2,"color2":12,"color3":15,"iconID":46},{"name":"TheKiroshi","accountID":6442871,"userID":31833361,"color1":8,"color2":11,"color3":1,"iconID":1},{"name":"ninXout","accountID":7479054,"userID":47290058,"color1":1,"color2":5,"color3":8,"iconID":77}],"contrib":[{"name":"TechStudent10","accountID":20284359,"userID":179839933,"color1":10,"color2":14,"color3":10,"iconID":79}],"special":[{"name":"HJfod","accountID":104257,"userID":1817908,"color1":8,"color2":3,"color3":15,"iconID":132}]}
    // `)}

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
    const new_credits = {}
    Object.keys(credits).forEach((role) => {
        new_credits[role] = []
        credits[role].forEach((user) => {
            (async () => {
                let new_user = {...user}
                console.log(user.accountID)
                const res = await fetch("http://www.boomlings.com/database/getGJUserInfo20.php", {
                    method: "POST",
                    body: new URLSearchParams({
                        secret: "Wmfd2893gb7",
                        targetAccountID: `${user.accountID}`
                    }),
                    headers: {
                        "User-Agent": ""
                    }
                }).then(res => res.text())
                const data = parseKeyMap(res)
                const color1 = parseInt(data["10"])
                const color2 = parseInt(data["11"])
                let color3 = parseInt(data["51"])
                if (parseInt(data["28"]) == 0) {
                    color3 = -1
                }
                const iconID = parseInt(data["21"])

                new_user["color1"] = color1
                new_user["color2"] = color2
                new_user["color3"] = color3
                new_user["iconID"] = iconID
                new_credits[role].push(new_user)
                console.log(iconID, color1, color2, color3)
                await sleep(2 * 1000)
            })()
            credits[role].sort()
        })
    })
    credits = new_credits
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

    console.log(credits)
    res.json(credits)
    
    if (Date.now() - last_refreshed >= 24 * 3600 * 1000) { // 24 * 3600 * 1000 = 24 hours in milliseconds
        // I am aware this looks like a JavaScript warcrime
        // You'd be right
        (async () => {
            await update_credits()
        })()
    }
})

load_credits()
await update_credits()

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`Globed credits server listening on port ${PORT}`)
})
