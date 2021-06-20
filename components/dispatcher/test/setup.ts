const onExit = require("signal-exit");
import { deploy, destroy } from './test-helper';

const setup = async (opts: any) => {
  await deploy()
  if (opts.watch && opts.watchAll) {
    onExit(function() {
      destroy().then(function() {
        process.exit();
      });
    });
  }
}

export default setup;