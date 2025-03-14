/*** Constants ***/

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { createCanvas } = require('canvas');
const { HtmlValidate } = require('html-validate');
const prettify = require('html-prettify');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const DATA_PATH = path.join(__dirname, "../../sources");
const STAGE_PATH = path.join(__dirname, "../../sources/to_integrate");
const WEBSITE_PATH = path.join(__dirname, "../../website");
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
        await integrate_new_treasures();
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
async function integrate_new_treasures () {
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

    await generateHtml(data);
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

// generate the sites HTML
async function generateHtml (data) {
    console.log("Generating HTML...")

    // generate data structure
    var html = "";
    var data_by_topics = getTopicsAndSubtopics()
    //Format: {topic: TOPIC, entries: [], subtopics: [{subtopic: SUBTOPIC, entries: []},{subtopic: SUBTOPIC, entries: []}]}

    // Gernate the HTML for each entry + place in topic-ordered data struct
    for (var i in data) {
        // generate entry card html & get topics for each entry
        var entry_html = null;
        var entry_topics = null;
        var key = Object.keys(data[i])[0] // get Key = existing_entry or new_entry 

        if (key == "existing_entry") {
            console.log(`... ${data[i].existing_entry.title}`)
            entry_html = generateEntryHtml(data[i].existing_entry, false)
            entry_topics = data[i].existing_entry.data.topics
        } else if (key == "new_entry") {
            console.log(`... ${data[i].new_entry.title}`)    
            entry_html = generateEntryHtml(data[i].new_entry, true)
            entry_topics = data[i].new_entry.data.topics
        }

        // push entries to the right topic
        for (var j in entry_topics) {
            // check if subtopics are set
            if(entry_topics[j].subtopics.length >= 1) { // there is at least one subtopic to be pushed to
                for (var k in entry_topics[j].subtopics) {
                    var searchTopic = entry_topics[j].topic
                    var searchSubtopic = entry_topics[j].subtopics[k]
                    var topicIndex = data_by_topics.findIndex(obj => obj.topic == searchTopic)
                    var subtopicIndex = data_by_topics[topicIndex].subtopics[0].findIndex(obj => obj.subtopic == searchSubtopic)
                    data_by_topics[topicIndex].subtopics[0][subtopicIndex].entries.push(entry_html)
                }
            } else { // no subtopics are found, therefore only push to "main"-topic
                var searchTopic =  entry_topics[j].topic
                var topicIndex = data_by_topics.findIndex(obj => obj.topic == searchTopic)
                data_by_topics[topicIndex].entries.push(entry_html)
            }
        }
    }
    
    //html prototypes
    const html_pre = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>The Internets Treasure Chest</title>
            <link href="public_modules/bootstrap/bootstrap.min.css" rel="stylesheet">
            <link href="public_modules/bootstrap-icons/bootstrap-icons.min.css" rel="stylesheet">
            <script src="public_modules/bootstrap/bootstrap.bundle.min.js"></script>
        </head>
        <body data-bs-spy="scroll" data-bs-target="#navbar-top" data-bs-offset="0" tabindex="0">
            <header class="fixed-top">
                <nav id="navbar-top" class="navbar navbar-expand-lg navbar-light bg-light border-bottom border-secondary">
                    <div class="container">
                        <a class="navbar-brand" href="#">
                            <img src="ressources/TreasureChest.png" alt="Logo" width="60" height="43" class="d-inline-block">
                            The Internets Treasure Chest
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="ms-auto navbar-nav">
                                <li class="nav-item">
                                    <a class="nav-link" href="#treasurechest">Treasure Chest</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" href="#about">About</a>
                                </li>
                                <li class="nav-item dropdown">
                                    <a class="nav-link" href="#more">More</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </nav>
            </header>
            <main style="margin-top: 70px;"> <!--adjust to height of Navbar-->
                <div class="container">
                    <section id="treasurechest" class="pt-3 pb-5">
                        <h2 class="pb-5 visually-hidden">Treasure Chest</h2> <!--Set to be invisible, but still included to not break h hierarchy-->
                        <div id="topics-container">
                            <!--<h3>Topics</h3>-->
                                <!--Main Topics-->`;
    const html_post = 
                `</div>
                        <!--<div id="Types-container">
                        </div>
                        <div id="Tags-container">
                        </div>
                        <div id="Flags-container">
                        </div>-->
                    </section>
                    <section id="about" class="pb-5">
                        <h2>About</h2>
                        <p>
                            I started keeping this list because my bookmarks in the browser have simply become too cluttered and I have often
                            received comments like ‘How do you always find such cool videos/websites?’. Honestly, I can't really answer this 
                            question, but for everyone else: Here you go, a list of all my favourite free, interesting
                            and entertaining websites. 	
                        </p>
                        <p><b>Please note the information below:</b></p>
                        <ul>
                            <li>This is a private hobby project. I do not claim to list *every* great resource here.</li>
                            <li>I cannot guarantee that all links will work forever, I cannot vouch for the safety, usefulness, timeliness, 
                                etc. of the linked resources.</li>
                            <li>There is no advertising here, and no content is sponsored. All content has been selected because I personally 
                                like it, find it useful or entertaining. The content is therefore naturally based on my personal interests. 
                                But maybe there's something here that you'll like.</li>
                            <li>That is why you will also find content that I have created myself. These are transparently flagged as 
                                “shameless-self-plug”.</li>
                        </ul>
                    </section>
                    <section id="more" class="pb-5">
                        <h2>More Stuff</h2>
                        <p>(*・‿・)ノ⌒*:･ﾟ✧ There's more planned for the future:  filters, a search function, a newsletter, a feature that lets you suggest a new treasure, ... ✧ﾟ･:⌒ヽ(・‿・*)</p>
                    </section>
                </div>
            </main>
            <footer class="text-muted py-5">
                <div class="container">
                    <a href="#" class="position-fixed bottom-0 end-0 mb-3 me-3 button-primary" style="font-size: 2rem;" aria-label="Back To Top Button">
                        <i class="bi bi-arrow-up-circle-fill"></i>
                    </a>
                </div>
                <div class="container">
                    <p class="text-center">Copyright (c) 2025 Leon Rosenplaenter. Assembled using node.js, <a href="https://github.com/twbs/bootstrap" target="_blank">Bootstrap</a> and <a href="https://github.com/twbs/icons" target="_blank">Bootstrap Icons</a>. Hosted on GitHub.</p>
                </div>
            </footer>
            <!--<script src="index.js"></script>-->
        </body>
        </html>`;

    // compose the full html page
    html += html_pre; // upper part of the page, static
    for (var i in data_by_topics) { // main section of the page, dyn. generated
        // main-topic (upper)
        html += 
        `<ul class="list-group">
            <li class="list-group-item d-flex justify-content-between align-items-start border-dark">
                <div id="TOPIC_${data_by_topics[i].topic}" class="fw-bold"><h4>${data_by_topics[i].topic}</h4></div>
                    <!--Content/Sub Topics-->
                    <ul class="list-group list-group-flush">
                        <li id="TOPIC_${data_by_topics[i].topic}_NO_SUBTOPIC" class="list-group-item"> <!-- li-elem for treasures without subtopic-->
                            <div class="row">`
        
        // main-topic entries
        for (var j in data_by_topics[i].entries) {
            html += data_by_topics[i].entries[j]
        }
        html += 
        `           </div>
                </li>
            </ul>
        </li>`; // close main topic entries section

        //subtopics
        for (var j in data_by_topics[i].subtopics[0]) {
            // subtopic (upper)
            html += 
                `<li class="list-group-item border-dark"><!-- li-elem for treasures with subtopic #TOPIC-#SUBTOPIC-->
                    <div id="SUBTOPIC_${data_by_topics[i].subtopics[0][j].subtopic}" class="fw-bold"><h5>${data_by_topics[i].topic} / ${data_by_topics[i].subtopics[0][j].subtopic}</h5></div>
                        <div class="row">`
            // subtopic (content)
            for (var k in data_by_topics[i].subtopics[0][j].entries) {
                html += data_by_topics[i].subtopics[0][j].entries[k]
            }
            
            // subtopic (lower)
            html += "</div></li>"; // close subtopic entries section
        }

        // main-topic (lower)
        html += "</ul><br>"
    }
    html += html_post; // lower part of the page, static

    //validate HTML
    await validate_HTML(html);
    
    //prettify HTML
    console.log("Prettifying HTML...")
    var html_prettified = prettify(html)

    //write index.html to app dir
    writeHtml(html_prettified)
}

//generates a card elem
function generateEntryHtml (data, isNewEntry) {
    //protoypes
    var new_badge = `<span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-danger" style="font-size: 100%;">new</span>`
        if (isNewEntry == false) {
            new_badge = "";
        }
    const subtype = data.data.types.subtype 
        ? `/ <span class="badge rounded-pill text-bg-secondary">${data.data.types.subtype}</span>` 
        : "";

    var flags = '<p class="card-text"> <!--FLAGS--> ';
        if (data.data.flags.length == 0) {
            flags = "";
        } else {
            for (var i in data.data.flags) {
                flags += `<span class="badge text-bg-secondary">${data.data.flags[i]}</span> `
            }
            flags += '</p>'
        }

    var tags = '<p class="card-text"> <!--TAGS--> Tags: ';
        if (data.tags.length == 0) {
            tags = "";
        } else {
            for (var i in data.tags) {
                tags += `<span class="badge text-bg-secondary">${data.tags[i]}</span> ` // ggf add: style="background-color: ${determine_color(data.tags[i])} !important"
            }
            tags += '</p>' 
        }

    var more_ressources = '<div class="btn-group mt-1" style="display: inline-flex; overflow-x: auto; max-width: 100%; white-space: nowrap;">'
        if (data.ressources.length < 2) {
            more_ressources = "";
        } else {
            for (let i = 1; i < data.ressources.length; i++) {
                more_ressources += `<a class="btn btn-primary" style="background-color: ${getRessourcesAttribute(data.ressources[i].name, "color")} !important; border-color: ${getRessourcesAttribute(data.ressources[i].name, "color")} !important;"  onmouseover="this.style.filter='brightness(80%)';" onmouseout="this.style.filter='brightness(100%)';" href="${data.ressources[i].payload}" target="_blank"><i class="${getRessourcesAttribute(data.ressources[i].name, "symbol")}"></i> ${getRessourcesAttribute(data.ressources[i].name, "publicname")}</a> `;
            }
            more_ressources += '</div>' 
        }

    var date = new Date(data.date);
        date = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const headerImage = createCardHeaderImage (data.title);
    
    var html = 
        `<div class="col-lg-4 col-md-6 col-sm-12 mb-3 mt-3" id="${data.title}">
            <div class="card shadow">
                ${new_badge}
                <img class="card-img-top" src="${headerImage}">
                <div class="card-body">
                    <p class="card-text"> <!--TYPE-->
                        <span class="badge rounded-pill text-bg-secondary">
                            ${data.data.types.type}
                        </span>
                        ${subtype}
                    </p>
                    <h6 class="card-title">${data.title}</h6>
                    <p class="card-text">${data.description}</p>
                    ${flags}
                </div>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item">
                        ${tags}
                    </li>
                </ul>
                <div class="card-body"> <!--MAIN LINK-->
                    <a class="btn btn-primary" style="background-color: ${getRessourcesAttribute(data.ressources[0].name, "color")} !important;  border-color: ${getRessourcesAttribute(data.ressources[0].name, "color")} !important;" onmouseover="this.style.filter='brightness(80%)';" onmouseout="this.style.filter='brightness(100%)';" href="${data.ressources[0].payload}" target="_blank"><i class="${getRessourcesAttribute(data.ressources[0].name, "symbol")}"></i> ${getRessourcesAttribute(data.ressources[0].name, "publicname")}</a>
                    <br>
                    ${more_ressources}
                    <p class="card-text text-secondary pt-2" style="font-size: 85%;">
                        added: ${date}
                    </p>
                </div>
            </div>
        </div>`

    //console.log(html)
    return html;
}

function createCardHeaderImage (seed) {
        // Create a canvas with the same dimensions
        const canvas = createCanvas(1600, 300);
        const ctx = canvas.getContext('2d');
    
        // Set the background color using determine_color function
        ctx.fillStyle = determine_color(seed);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        // Set text properties
        ctx.font = 'bold 100px Courier';
        ctx.fillStyle = invertColor(determine_color(seed));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add the text to the canvas
        ctx.fillText(seed, canvas.width / 2, canvas.height / 2);
    
        // Convert canvas to a base64 image and return it
        return canvas.toDataURL(); // Returns base64 image of the canvas
}

function getRessourcesAttribute(name, attribute) {
    const dataPath = path.join(DATA_PATH, "ressources.json")
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Find the resource with the matching name
    const resource = data.ressources.find(r => r.name === name);

    // Check if resource exists and if the attribute is valid
    if (resource && resource.hasOwnProperty(attribute)) {
        return resource[attribute];
    } else {
        return `Resource with name "${name}" or attribute "${attribute}" not found.`;
    }
}

function getTopicsAndSubtopics() { // get topics and subtopics from topics.jsom and parse them into an array of objects -> {topic: TOPIC, entries: [], subtopics: [{subtopic: SUBTOPIC, entries: []},{subtopic: SUBTOPIC, entries: []}]}
    const dataPath = path.join(DATA_PATH, "topics.json")
    let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    data = data.topics

    let topics = [];
    for (var i in data) {
        var subtopics = [];
        for (var j in data[i].subtopics) {
            subtopics.push({subtopic: data[i].subtopics[j], entries: []})
        }
        topics.push({topic: data[i].maintopic, entries: [], subtopics: [subtopics]})
    }

    // Sorting topics by topic name
    topics.sort((a, b) => a.topic.localeCompare(b.topic));

    // Sorting subtopics within each topic
    topics.forEach(topic => {
        topic.subtopics[0].sort((a, b) => a.subtopic.localeCompare(b.subtopic));
    });

    return topics;
}

function writeHtml(htmlContent) {
    console.log("Writing HTML File...")
    const outputName = "index.html"
    const location = path.join(WEBSITE_PATH, outputName);
    
    fs.writeFileSync(location, htmlContent, 'utf8');
    console.log(`HTML file has been saved as ${outputName}`);
}

async function validate_HTML(html) {
    console.log("Validating HTML...")
    const htmlvalidate = new HtmlValidate({
        extends: ["html-validate:recommended"],
        rules: {
          "no-inline-style": "off",
          "wcag/h37": "off", //don't check for alt elems
          "no-trailing-whitespace": "off",
          "no-dup-id": "off", //maybe change later
        },
    });
    const report = await htmlvalidate.validateString(html);

    // if html is invalid, display errors and warnings
    if(report.valid) {
        console.log("HMTL is valid!")
    } else {
        console.warn("HMTL is NOT valid!")
        console.log(`Found ${report.results[0].errorCount} error(s) and ${report.results[0].warningCount} warning(s)`)
        for (var i in report.results[0].messages) {
            console.log(`ln ${report.results[0].messages[i].line} (${report.results[0].messages[i].column}): ${report.results[0].messages[i].message}    at: ${report.results[0].messages[i].selector}    rule: ${report.results[0].messages[i].ruleId}`)
        }
    }
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

function determine_color (str) {
    // Thx to Joe Freeman! https://stackoverflow.com/a/16348977
    let hash = 0;
    str.split('').forEach(char => {
        hash = char.charCodeAt(0) + ((hash << 5) - hash)
    })
    let colour = '#'
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff
        colour += value.toString(16).padStart(2, '0')
    }
    return colour
}

function invertColor(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    let num = parseInt(hex, 16);
    let invertedNum = 0xFFFFFF ^ num;
    let invertedHex = invertedNum.toString(16).padStart(6, '0');
    return `#${invertedHex}`;
}

main();