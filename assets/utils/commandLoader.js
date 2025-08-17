import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get all commands from all command directories
 * @returns {Promise<Array>} Array of command objects
 */
export async function getAllCommands() {
  const commands = [];
  const commandsBasePath = path.join(__dirname, "..", "commands");

  // Define command directories
  const commandDirs = ["main", "group", "owner", "game", "download", "sticker"];

  for (const dir of commandDirs) {
    const dirPath = path.join(commandsBasePath, dir);

    try {
      if (fs.existsSync(dirPath)) {
        const files = fs
          .readdirSync(dirPath)
          .filter((file) => file.endsWith(".js"));

        for (const file of files) {
          try {
            const filePath = path.join(dirPath, file);
            const commandModule = await import(`file://${filePath}`);
            const cmd = commandModule.default || commandModule.command;

            if (cmd && cmd.name) {
              commands.push({
                ...cmd,
                category: cmd.category || dir,
                filePath: filePath,
              });
            }
          } catch (error) {
            console.error(`Error loading command ${file} from ${dir}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  return commands;
}

/**
 * Get commands by category
 * @param {string} category - The category to filter by
 * @returns {Promise<Array>} Array of command objects in the specified category
 */
export async function getCommandsByCategory(category) {
  const allCommands = await getAllCommands();
  return allCommands.filter((cmd) => cmd.category === category);
}

/**
 * Get a specific command by name
 * @param {string} name - The command name to search for
 * @returns {Promise<Object|null>} The command object or null if not found
 */
export async function getCommand(name) {
  const allCommands = await getAllCommands();
  return (
    allCommands.find((cmd) => cmd.name.toLowerCase() === name.toLowerCase()) ||
    null
  );
}

/**
 * Get all available categories
 * @returns {Promise<Array>} Array of unique category names
 */
export async function getCategories() {
  const allCommands = await getAllCommands();
  const categories = [...new Set(allCommands.map((cmd) => cmd.category))];
  return categories.sort();
}
