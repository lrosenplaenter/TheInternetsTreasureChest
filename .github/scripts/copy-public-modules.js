const fs = require('fs');
const path = require('path');
const readline = require('readline');

const scriptDir = path.join(__dirname);
const configFile = path.join(scriptDir, 'config.txt');

function promptForConfigFile() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('No config.txt found. Please create one with the following format:');
    console.log('target-folder:');
    console.log('    ./your_target_folder');
    console.log('ressources:');
    console.log('    ./path/to/resource1');
    console.log('    ./path/to/resource2');
    rl.close();
}

function parseConfig(content) {
    const lines = content.split('\n');
    const config = {
        targetFolder: '',
        resources: []
    };

    let mode;
    lines.forEach(line => {
        if (line.startsWith('target-folder:')) {
            mode = 'target-folder';
        } else if (line.startsWith('ressources:')) {
            mode = 'resources';
        } else if (line.trim() !== '') {
            if (mode === 'target-folder') {
                config.targetFolder = line.trim();
            } else if (mode === 'resources') {
                config.resources.push(line.trim());
            }
        }
    });

    return config;
}

function copyResources(config) {
    if (!fs.existsSync(config.targetFolder)) {
        fs.mkdirSync(config.targetFolder, { recursive: true });
    }

    config.resources.forEach(resource => {
        const moduleName = resource.split('/node_modules/')[1].split('/')[0];
        const targetDir = path.join(config.targetFolderPath, moduleName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const resourceBaseName = path.basename(resource);
        const targetPath = path.join(targetDir, resourceBaseName);

        fs.copyFileSync(resource, targetPath);
        console.log(`Copied ${resource} to ${targetPath}`);
    });
}

if (fs.existsSync(configFile)) {
    const content = fs.readFileSync(configFile, 'utf8');
    const config = parseConfig(content);
    config.targetFolderPath = path.resolve(config.targetFolder); // Resolve target folder to absolute path
    copyResources(config);
} else {
    promptForConfigFile();
}
