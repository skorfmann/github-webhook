import { LambdaFunction } from '@cdktf/provider-aws';
import { Resource, TerraformOutput } from 'cdktf';
import { Construct, IAspect } from 'constructs';
import { NodejsFunction, Policy, EventBridgeTarget } from '../../lib';
import * as aws from '@cdktf/provider-aws';
import * as iam from 'iam-floyd';
import * as path from 'path';

export interface EventBridgeSnoopProps {
  readonly eventBridge: aws.CloudwatchEventBus;
}

export class EventBridgeSnoop extends Resource {
  readonly fn: LambdaFunction;

  constructor(scope: Construct, id: string, props: EventBridgeSnoopProps) {
    super(scope, id);

    const { eventBridge } = props;

    const logGroup = new aws.CloudwatchLogGroup(this, 'snoop-log-group', {
      name: `/aws/lambda/${id}`,
      retentionInDays: 1
    });

    new TerraformOutput(this, 'log-group', {
      value: logGroup.name
    })

    const role = new aws.IamRole(this, 'role', {
      name: `${id}-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('lambda.amazonaws.com')
      ),
      inlinePolicy: [
        {
          name: 'cloudwatch',
          policy: Policy.document(new iam.Logs()
            .allow()
            .toCreateLogStream()
            .toPutLogEvents()
            .on(logGroup.arn, `${logGroup.arn}:log-stream:*`)
          )
        }
      ]
    })

    const code = new NodejsFunction(this, 'authorizer', {
      path: path.join(__dirname, 'handler/index.ts')
    })

    this.fn = new aws.LambdaFunction(this, 'fn', {
      functionName: id,
      role: role.arn,
      handler: 'index.handler',
      filename: code.asset.path,
      sourceCodeHash: code.asset.assetHash,
      runtime: 'nodejs14.x',
      dependsOn: [
        logGroup
      ]
    })

    new EventBridgeTarget(this, 'lambda-invoke', {
      eventBridge,
      target: this.fn,
      eventPattern: {
        source: [
          { 'prefix': 'com.supportmeister' }
        ]
      }
    })
  }
}

export class SnoopEvents implements IAspect {
  constructor() {}

  public visit(node: Construct): void {
    if (node instanceof aws.CloudwatchEventBus) {
      new EventBridgeSnoop(node, 'snoop-events', {
        eventBridge: node
      })
    }
  }
}
