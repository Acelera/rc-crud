import Console from 'rc-console';
import cron from 'node-cron';

/**
 * FREQUÊNCIA
 ┌────────────── second (optional)  - 0-59
 │ ┌──────────── minute             - 0-59
 │ │ ┌────────── hour               - 0-23
 │ │ │ ┌──────── day of month       - 1-31
 │ │ │ │ ┌────── month              - 1-12
 │ │ │ │ │ ┌──── day of week        - 0-7
 │ │ │ │ │ │
 * * * * * *
 */

/**
 * @param message
 * @param frequencia
 * @param callback
 */
const jobWrapper = ({
  message,
  frequencia,
  callback,
}) => {
  if (process.env.RUN_JOBS) {
    cron.schedule(
      frequencia,
      async () => {
        Console.info(message).newLine();
        callback();
      },
      {
        scheduled: true,
        timezone: 'America/Sao_Paulo',
      },
    );
  }
};

export default jobWrapper;
