import { SynthStack, SynthesizedStack } from 'cdktf-cli/bin/cmds/helper/synth-stack';
import { TerraformCli } from 'cdktf-cli/bin/cmds/ui/models/terraform-cli';
import * as path from 'path';
import { TerraformOutput } from 'cdktf-cli/bin/cmds/ui/models/terraform';
import * as fs from 'fs';

const sleep = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};
class Synth {
  private static instance: Synth;

  private constructor(public stacks: SynthesizedStack[]) {}

  public static async getInstance(cmd?: string, cachePath?: string): Promise<Synth> {
    if (cmd && cachePath) {
      let stacks: any
      try {
        stacks = await SynthStack.synth(`ts-node ${path.join(__dirname, 'stack.ts')}`, path.join(__dirname, 'cdktf.test.out'));
      } catch(e) {
        console.error(e)
      }
      Synth.instance = new Synth(stacks);
      fs.writeFileSync(cachePath, JSON.stringify(stacks), {encoding: 'utf8'})
    }
    return Synth.instance;
  }

  public static async getCachedInstance(cachePath: string): Promise<Synth> {
    const stacks = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    Synth.instance = new Synth(stacks);

    return Synth.instance;
  }
}

export const deploy = async (cachePath: string) => {
  console.log({cachePath})
  try {
    if (!fs.existsSync(cachePath)) {
      console.log({cachePath})
      const synth = await Synth.getInstance('node stack.js', cachePath);
      const cli = new TerraformCli(synth.stacks[0]);
      await cli.init();
      await cli.deploy('', (chunk: Buffer) => (console.log(chunk.toString('utf-8'))));
      sleep(1000); // give some time to process the deployment
    } else {
      await Synth.getCachedInstance(cachePath);
    }
  }
  catch(e) {
    console.error({e})
  }
}

export const destroy = async () => {
  try {
    const synth = await Synth.getInstance();
    const cli = new TerraformCli(synth.stacks[0]);
    await cli.init();
    await cli.destroy((chunk: Buffer) => (console.log(chunk.toString('utf-8'))));
  } catch(e) {
    console.error(e)
  }
}

export const output = async (): Promise<Record<string, TerraformOutput>> => {
  const synth = await Synth.getInstance();
  const cli = new TerraformCli(synth.stacks[0]);
  return await cli.output();
}

