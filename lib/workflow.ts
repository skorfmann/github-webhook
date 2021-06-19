import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { Policy } from './policy';
import * as aws from '@cdktf/provider-aws';
import * as iam from 'iam-floyd';

export interface TargetProps {
  readonly eventBridge: aws.CloudwatchEventBus;
  readonly target: aws.SfnStateMachine;
  readonly eventPattern: Record<string, any>;
}

export class EventBridgeTarget extends Resource {
  constructor(scope: Construct, id: string, props: TargetProps) {
    super(scope, id);

    const { target, eventBridge, eventPattern } = props;

    // There's a AWS Provider bug preventing this resource
    // being recreated properly when the eventBusName changes
    const rule = new aws.CloudwatchEventRule(this, 'rule', {
      name: 'capture-github-events',
      eventBusName: eventBridge.name,
      eventPattern: JSON.stringify(eventPattern)
    })

    const policies: aws.IamRoleInlinePolicy[] = [];

    if (target instanceof aws.SfnStateMachine) {
      policies.push({
        name: 'allow-invoke-stepfucntion',
        policy: Policy.document(
          new iam.States()
            .allow()
            .toStartExecution()
            .on(target.arn)
        )
      })
    }

    const role = new aws.IamRole(this, 'integration-role', {
      name: `${id}-integration-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('events.amazonaws.com')
      ),
      inlinePolicy: policies
    })

    new aws.CloudwatchEventTarget(this, 'target', {
      targetId: 'foo',
      eventBusName: eventBridge.name,
      rule: rule.name,
      arn: target.arn,
      roleArn: role.arn
    })
  }
}