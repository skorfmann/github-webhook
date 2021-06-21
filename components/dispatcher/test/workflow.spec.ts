import { TerraformOutput } from "cdktf-cli/bin/cmds/ui/models/terraform";
import { deploy, destroy, output as terraformOutput } from "./test-helper";
import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionCommandInput,
  DescribeExecutionCommand,
  DescribeExecutionCommandInput,
  GetExecutionHistoryCommand,
  GetExecutionHistoryCommandInput
} from "@aws-sdk/client-sfn";
import * as esbuild from 'esbuild';
import path = require("path/posix");

let output: Record<string, TerraformOutput>;

const sleep = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

const client = new SFNClient({ region: "eu-central-1" });

const startAndWaitSfn = async (sfnArn: string) => {
  const params: StartExecutionCommandInput = {
    stateMachineArn: sfnArn,
    input: JSON.stringify({ my: "input" })
  };
  const command = new StartExecutionCommand(params);
  const { executionArn } = await client.send(command);

  while (true) {
    const describeParams: DescribeExecutionCommandInput = {
      executionArn
    };
    const describeCommand = new DescribeExecutionCommand(describeParams);
    const describeResponse = await client.send(describeCommand);

    if (describeResponse.status === "SUCCEEDED") {
      break;
    } else if (describeResponse.status === "FAILED") {
      new Error(JSON.stringify(describeResponse, null, 2));
    } else {
      await sleep(1000);
    }
  }

  return executionArn!;
};

const getSfnHistory = async (executionArn: string) => {
  const historyParmas: GetExecutionHistoryCommandInput = {
    executionArn,
    maxResults: 100,
    includeExecutionData: true
  };
  const historyCommand = new GetExecutionHistoryCommand(historyParmas);
  return await client.send(historyCommand);
};

const build = async (entryPoint: string) => {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    platform: 'node',
    target: 'es2018',
    bundle: true,
    metafile: true,
    entryNames: '[dir]/[name]-[hash]',
    format: 'cjs',
    outfile: 'tmp/cache.js',
    write: false,
    absWorkingDir: path.join(__dirname, '..', '..', '..'),
  });
  const keys = Object.keys(result.metafile?.outputs || {});

  return keys[0]
}

describe("full integration test", () => {
  beforeAll(async () => {
    const newBuildCache = await build(path.join(__dirname, 'stack.ts'))
    const cachePath = path.join(process.cwd(), newBuildCache)

    console.log(cachePath)
    await deploy(cachePath);

    output = await terraformOutput();
  }, 180_000);

  afterAll(async () => {
    if (process.env.SKIP_DESTROY == undefined) {
      await destroy();
    }
  }, 180_000);

  test("step function workflow", async () => {
    const executionArn = await startAndWaitSfn(output.workflow.value as string);
    const history = await getSfnHistory(executionArn);

    if (history.events) {
      for (const event of history.events) {
        if (
          event.type === "TaskSucceeded" &&
          event.taskSucceededEventDetails?.resource === "getItem"
        ) {
          expect(event.taskSucceededEventDetails?.outputDetails)
            .toMatchInlineSnapshot(`
            Object {
              "truncated": false,
            }
          `);
        }
      }
    }
  });

  test("dynamodb task scheduled", async () => {
    const executionArn = await startAndWaitSfn(output.workflow.value as string);
    const history = await getSfnHistory(executionArn);

    if (history.events) {
      for (const event of history.events) {
        if (
          event.type === "TaskScheduled" &&
          event.taskScheduledEventDetails?.resource === "getItem"
        ) {
          expect(event.taskScheduledEventDetails).toMatchInlineSnapshot(`
Object {
  "heartbeatInSeconds": undefined,
  "parameters": "{\\"TableName\\":\\"dispatcher-test-on-duty-users\\",\\"Key\\":{\\"id\\":{\\"S\\":\\"USER#ONDUTY\\"}}}",
  "region": "eu-central-1",
  "resource": "getItem",
  "resourceType": "dynamodb",
  "timeoutInSeconds": undefined,
}
`);
        }
      }
    }
  });
});
