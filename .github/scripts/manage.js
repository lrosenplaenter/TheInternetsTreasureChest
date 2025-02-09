/*** Constants ***/

const readline = require("readline");
const fs = require("fs");
const path = require("path");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const DATA_PATH = path.join(__dirname, "../../sources");
const STAGE_PATH = path.join(__dirname, "../../sources/to_integrate");

/*** Functions ***/
async function main() {
    const choices = [
        "Stage new treasure",
        "Integrate new treasures",
        "Database maintenance"
    ];
    
    const userChoice = await promptUser("What would you like to do?", choices);

    if (userChoice === "Stage new treasure") {
        await stage_new_treasure();
    } else if (userChoice === "Integrate new treasures") {
        integrate_new_treasures();
    } else if (userChoice === "Database maintenance") {
        console.group("Not yet implemented! :(")
        // TODO
    }
    rl.close();
    console.log("\n")
}

/* Stage new */
async function stage_new_treasure() {
    let newEntry = {
        new_entry: {
            to_integrate: true,
            title: await promptUser("Enter the title:"),
            description: await promptUser("Enter the description:"),
            data: {
                types: await getTypeSelection(),
                topics: await getTopicSelection(),
                flags: await getFlagSelection()
            },
            tags: await getTagsSelection(),
            ressources: await getResourceSelection()
        }
    };

    console.log("New entry created:", JSON.stringify(newEntry, null, 2));

    // Save the new entry to a JSON file
    await saveNewEntry(newEntry);
}

async function getTypeSelection() {
    const types = JSON.parse(fs.readFileSync(path.join(DATA_PATH, "types.json")));
    let mainType = await promptUser("Select a main type:", types.types.map(t => t.maintype));
    let subTypeOptions = types.types.find(t => t.maintype === mainType).subtypes.map(s => s.subtype);
    let subType = "";
    if (subTypeOptions.length) {
        subType = await promptUserOptional("Select a subtype (or press Enter to skip):", subTypeOptions);
    }
    return { type: mainType, subtype: subType };
}

async function getTopicSelection() {
    const topicsData = JSON.parse(fs.readFileSync(path.join(DATA_PATH, "topics.json")));
    let topics = [];
    let addMore;
    do {
        let mainTopic = await promptUser("Select a main topic:", topicsData.topics.map(t => t.maintopic));
        let subtopicsOptions = topicsData.topics.find(t => t.maintopic === mainTopic).subtopics;
        let subtopics = subtopicsOptions.length ? await multiPromptUser("Select subtopics (or press Enter to skip):", subtopicsOptions) : [];
        topics.push({ topic: mainTopic, subtopics });
        addMore = await promptUser("Add another topic? (yes/no)", ["yes", "no"]);
    } while (addMore === "yes");
    return topics;
}

async function getFlagSelection() {
    const flagsData = JSON.parse(fs.readFileSync(path.join(DATA_PATH, "flags.json")));
    return await multiPromptUser("Select flags:", flagsData.flags);
}

async function getTagsSelection() {
    const tagsData = JSON.parse(fs.readFileSync(path.join(DATA_PATH, "tags.json")));
    return await multiPromptUser("Select tags:", tagsData.tags);
}

async function getResourceSelection() {
    const resourcesData = JSON.parse(fs.readFileSync(path.join(DATA_PATH, "ressources.json")));
    let resources = [];
    let addMore;
    do {
        let resourceType = await promptUser("Select a resource type:", resourcesData.ressources.map(r => r.name));
        let resourceTemplate = await promptUser(`Enter resource (${resourceType} format [provide full URL!]):`);
        resources.push({ name: resourceType, payload: resourceTemplate });
        addMore = await promptUser("Add another resource? (yes/no)", ["yes", "no"]);
    } while (addMore === "yes");
    return resources;
}

async function saveNewEntry(entry) {
    const title = entry.new_entry.title;
    const fileName = `${title}.json`;  // Using the title as the file name
    const filePath = path.join(STAGE_PATH, fileName);

    try {
        // Write the new entry to a JSON file
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
        console.log(`New entry saved as ${fileName} at ${STAGE_PATH}`);
    } catch (err) {
        console.error("Error saving the new entry:", err);
    }
}

/* integrate new */
function integrate_new_treasures () {
    console.log("TEST")
}

/*** Helper Functions ***/
function promptUser(question, choices = null) {
    return new Promise((resolve) => {
        console.log(question);
        if (choices) {
            choices.forEach((choice, index) => {
                console.log(`${index + 1}) ${choice}`);
            });
        }
        rl.question("Enter your choice: ", (answer) => {
            if (choices) {
                const choiceIndex = parseInt(answer, 10) - 1;
                if (choiceIndex >= 0 && choiceIndex < choices.length) {
                    console.log('\n');
                    resolve(choices[choiceIndex]);
                } else {
                    console.log("Invalid choice. Please try again.\n");
                    resolve(promptUser(question, choices));
                }
            } else {
                console.log('\n');
                resolve(answer);
            }
        });
    });
}

function promptUserOptional(question, choices) {
    return new Promise((resolve) => {
        console.log(question);
        choices.forEach((choice, index) => {
            console.log(`${index + 1}) ${choice}`);
        });
        rl.question("Enter your choice (or press Enter to skip): ", (answer) => {
            if (!answer.trim()) {
                console.log('\n');
                resolve("");
            } else {
                const choiceIndex = parseInt(answer, 10) - 1;
                if (choiceIndex >= 0 && choiceIndex < choices.length) {
                    console.log('\n');
                    resolve(choices[choiceIndex]);
                } else {
                    console.log("Invalid choice. Please try again.\n");
                    resolve(promptUserOptional(question, choices));
                }
            }
        });
    });
}

function multiPromptUser(question, choices) {
    return new Promise((resolve) => {
        console.log(question);
        choices.forEach((choice, index) => {
            console.log(`${index + 1}) ${choice}`);
        });
        rl.question("Enter your choices (comma-separated numbers, or press Enter to skip): ", (answer) => {
            if (!answer.trim()) {
                console.log('\n');
                resolve([]);
            } else {
                const indices = answer.split(",").map(num => parseInt(num.trim(), 10) - 1);
                const selected = indices.filter(i => i >= 0 && i < choices.length).map(i => choices[i]);
                console.log('\n');
                resolve(selected);
            }
        });
    });
}

main();
