import chalk from 'chalk';
export const log = {
  info: (...msg) => console.log(chalk.cyan.bold('[INFO]') + chalk.white(` ${msg.join(' ')}`)),
  warn: (...msg) => console.log(chalk.yellow.bold('[WARN]') + chalk.yellowBright(` ${msg.join(' ')}`)),
  error: (...msg) => console.log(chalk.redBright.bold('[ERROR]') + chalk.red(` ${msg.join(' ')}`)),
  success: (...msg) => console.log(chalk.greenBright.bold('[SUCCESS]') + chalk.green(` ${msg.join(' ')}`)),
  debug: (...msg) => console.log(chalk.magenta.bold('[DEBUG]') + chalk.gray(` ${msg.join(' ')}`)),
}
