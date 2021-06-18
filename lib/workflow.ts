import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { Policy } from './policy';
import * as aws from '@cdktf/provider-aws';
import * as iam from 'iam-floyd';

export interface WorkflowProps {
  readonly eventBridge: aws.CloudwatchEventBus;
  readonly target: aws.SfnStateMachine;
  readonly eventPattern: Record<string, any>;
}

export class EventBridgeWorkflow extends Resource {
  constructor(scope: Construct, id: string, props: WorkflowProps) {
    super(scope, id);

    const { target, eventBridge, eventPattern } = props;

    // There's a AWS Provider bug preventing this resource
    // being recreated properly when the eventBusName changes
    const rule = new aws.CloudwatchEventRule(this, 'rule', {
      name: 'capture-github-events',
      eventBusName: eventBridge.name,
      eventPattern: JSON.stringify(eventPattern)
    })

    const role = new aws.IamRole(this, 'integration-role', {
      name: `${id}-integration-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('events.amazonaws.com')
      ),
      inlinePolicy: [
        {
          name: 'allow-invoke-stepfucntion',
          policy: Policy.document(new iam.States().allow().toStartExecution().on(target.arn))
        }
      ]
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