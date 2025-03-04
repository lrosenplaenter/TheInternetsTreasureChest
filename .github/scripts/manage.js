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
const DATABASE = "data.json"

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
        console.log("Not yet implemented! :(")
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
    let data = []; // to hold the content that will be stores as data.json

    // getting new treasures + add "new" flag + add timestamp
    var TreasuresToIntegrate = getTreasuresToIntegrate(); //
    console.log(`Found ${TreasuresToIntegrate.length} new Treasures to integrate!`)
    TreasuresToIntegrate.forEach(entry => {
        const { title, description, data, tags, ressources } = entry.new_entry;
        data.flags.push("new");
        entry.new_entry = {
          title,
          description,
          date: new Date().toISOString(), // Inserted after description
          data,
          tags,
          ressources
        };
      });

    // gettings existing treasures + remove "new" tag
    var existingTresures = getExistingTreasures(); 
    console.log(`Retrieved ${existingTresures.length} already existing Treasures to integrate!`)
    existingTresures = existingTresures.map(entry => {
        if (entry.existing_entry?.data?.flags) {
            entry.existing_entry.data.flags = entry.existing_entry.data.flags.filter(flag => flag !== "new");
        }
        return entry;
    });


    /** del later! **/
    //console.log(TreasuresToIntegrate, "\n");
    //console.log(existingTresures, "\n");
    //console.log(TreasuresToIntegrate[1].new_entry.data, "\n")
    //saveToJsonFile("eins.json", TreasuresToIntegrate);
    //saveToJsonFile("zwei.json", existingTresures);

    // concat ans sort all treasures together (ToDo for later: check duplicates)
    data = TreasuresToIntegrate.concat(existingTresures)
    data = data.sort((a, b) => {
        const titleA = Object.values(a)[0].title.toLowerCase();
        const titleB = Object.values(b)[0].title.toLowerCase();
        return titleA.localeCompare(titleB);
    })
    //saveToJsonFile("drei.json", data);
    // overwrite existing data.json
    saveNewDataJson(data);

    // clear to_integrate dir from .json files
    deleteStagedJsonFiles(STAGE_PATH, TreasuresToIntegrate);

    generateHtml(data);
}  

// get data from title.json files in ./sources/to_integrate
function getTreasuresToIntegrate () {
    let result = [];

    if (!fs.existsSync(STAGE_PATH)) {
        console.error(`Directory not found: ${STAGE_PATH}`);
        return result;
    }

    const files = fs.readdirSync(STAGE_PATH);

    files.forEach(file => {
        const filePath = path.join(STAGE_PATH, file);
        
        if (path.extname(file) === '.json') {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                if (data.new_entry && data.new_entry.to_integrate === true) {
                    delete data.new_entry.to_integrate;
                    result.push(data);
                }
            } catch (error) {
                console.error(`Error parsing JSON file ${file}:`, error.message);
            }
        }
    });

    return result;
}

// get data from data.json files in ./sources
function getExistingTreasures () {
    const dataPath = path.join(DATA_PATH, "data.json")
    try {
        const rawData = fs.readFileSync(dataPath, 'utf-8');
        const jsonData = JSON.parse(rawData);

        return Object.entries(jsonData).map(([title, content]) => ({
            existing_entry: {
                title,
                description: content.description,
                date: content.date,
                data: {
                    types: {
                        type: content.data.types.type,
                        subtype: content.data.types.subtype
                    },
                    topics: content.data.topics.map(topic => ({
                        topic: topic.topic,
                        subtopics: topic.subtopics
                    })),
                    flags: content.data.flags
                },
                tags: content.tags,
                ressources: content.ressources.map(resource => ({
                    name: resource.name,
                    payload: resource.payload
                }))
            }
        }));
    } catch (error) {
        console.error('Error reading or parsing data.json:', error);
        return [];
    }
}

// Overwrite existing data.json with new data
function saveNewDataJson (array) {
    let formattedData = {};

    array.forEach(entry => {
        const key = Object.keys(entry)[0];
        const data = entry[key];
        
        if (!data || !data.title) return; // Skip invalid entries

        // Ensure "new" flag is present for new entries
        if (key === "new_entry" && data.data && data.data.flags) {
            if (!data.data.flags.includes("new")) {
                data.data.flags.push("new");
            }
        }

        formattedData[data.title] = {
            description: data.description,
            date: data.date,
            data: {
                types: data.data.types,
                topics: data.data.topics,
                flags: [...new Set(data.data.flags)], // Remove duplicates
            },
            tags: data.tags,
            ressources: data.ressources
        };
    });

    // Ensure the directory exists
    if (!fs.existsSync(DATA_PATH)) {
        fs.mkdirSync(DATA_PATH, { recursive: true });
    }

    const filePath = path.join(DATA_PATH, DATABASE);
    fs.writeFileSync(filePath, JSON.stringify(formattedData, null, 4), "utf8");
    console.log(`Database successfully updated: ${filePath}`);
}

// Delete files from STAGE_PATH if they after they were integrated
function deleteStagedJsonFiles(directory, entries) {
    entries.forEach(entry => {
      const filename = `${entry.new_entry.title}.json`;
      const filePath = path.join(directory, filename);
      
      fs.unlink(filePath, (err) => {
        if (err) {
          if (err.code === 'ENOENT') {
            console.log(`File not found: ${filename}`);
          } else {
            console.error(`Error deleting file ${filename}:`, err);
          }
        } else {
          console.log(`Deleted Staged Treasure (.json) after successfull integration: ${filename}`);
        }
      });
    });
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

function saveToJsonFile(filename, data) {
    if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
    }
    
    fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing file:', err);
        } else {
            console.log('File successfully written:', filename);
            return;
        }
    });
}

main();