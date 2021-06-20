import { SynthStack, SynthesizedStack } from 'cdktf-cli/bin/cmds/helper/synth-stack';
import { TerraformCli } from 'cdktf-cli/bin/cmds/ui/models/terraform-cli';
import * as path from 'path';
import { TerraformOutput } from 'cdktf-cli/bin/cmds/ui/models/terraform';

class Synth {
  private static instance: Synth;

  private constructor(public stacks: SynthesizedStack[]) {}

  public static async getInstance(cmd?: string): Promise<Synth> {
    if (cmd) {
      const stacks = await SynthStack.synth(`node ${path.join(__dirname, 'stack.js')}`, path.join(__dirname, 'cdktf.test.out'));
      Synth.instance = new Synth(stacks);
    }
    return Synth.instance;
  }
}

export const deploy = async () => {
  try {
    const synth = await Synth.getInstance('node stack.js');
    const cli = new TerraformCli(synth.stacks[0]);
    await cli.init();
    await cli.deploy('', (chunk: Buffer) => (console.log(chunk.toString('utf-8'))));
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

