import chalk from 'chalk';
export const log = {
  info: (msg) => console.log(chalk.cyan.bold('[INFO]') + chalk.white(` ${msg}`)),
  warn: (msg) => console.log(chalk.yellow.bold('[WARN]') + chalk.yellowBright(` ${msg}`)),
  error: (msg) => console.log(chalk.redBright.bold('[ERROR]') + chalk.red(` ${msg}`)),
  success: (msg) => console.log(chalk.greenBright.bold('[SUCCESS]') + chalk.green(` ${msg}`)),
  debug: (msg) => console.log(chalk.magenta.bold('[DEBUG]') + chalk.gray(` ${msg}`)),
}
