import { destroy } from './test-helper';

const teardown = async (opts: any) => {
  if (!opts.watch && !opts.watchAll) {
    await destroy();
  }
}

export default teardown;