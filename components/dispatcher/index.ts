
import { Construct } from 'constructs';
import { Resource } from 'cdktf';
import * as aws from '@cdktf/provider-aws';
import { Policy, EventBridgeTarget } from '../../lib'
import * as iam from 'iam-floyd';
import * as asl from 'asl-types';

export interface DispatcherProps {
  readonly eventBridge: aws.CloudwatchEventBus;
  readonly eventPattern: Record<string, any>;
}

// before all: provision -> cdktf deploy
// before each: bootstrap -> fixtures for dynamodb
// trigger event (copied from Github)
//

export class Dispatcher extends Resource {
  readonly table: aws.DynamodbTable;
  readonly workflow: aws.SfnStateMachine;

  constructor(scope: Construct, id: string, props: DispatcherProps) {
    super(scope, id)

    const { eventBridge, eventPattern } = props;

    this.table = new aws.DynamodbTable(this, 'table', {
      name: `${id}-on-duty-users`,
      streamEnabled: true,
      streamViewType: 'NEW_AND_OLD_IMAGES',
      hashKey: 'id',
      attribute: [
        { name: 'id', type: 'S' },
      ],
      billingMode: 'PAY_PER_REQUEST'
    })

    const sfnRole = new aws.IamRole(this, 'sfn-workflow-role', {
      name: `${id}-sfn-workflow-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('states.amazonaws.com')
      ),
      inlinePolicy: [
        {
          name: 'allow-sfn-to-ddb',
          policy: Policy.document(
            new iam
              .Dynamodb()
              .allow()
              .toGetItem()
              .on(this.table.arn)
          )
        }
      ]
    })

    const getDynamoDb: asl.Task = {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:getItem",
      "Parameters": {
        "TableName": this.table.name,
        "Key": {
          "id": {"S": "USER#ONDUTY"}
        }
      },
      "ResultPath": "$.DynamoDB",
      "Next": "finishState"
    }

    const finishState: asl.Succeed = {
      Type: 'Succeed'
    }

    const sfnDefinition: asl.StateMachine = {
      StartAt: 'getDynamoDb',
      States: {
        getDynamoDb,
        finishState
      }
    }

    this.workflow = new aws.SfnStateMachine(this, 'state-machine', {
      name: `${id}-supportmeister`,
      roleArn: sfnRole.arn,
      definition: JSON.stringify(sfnDefinition)
    })

    new EventBridgeTarget(this, `${id}-event-bridge-worfklow`, {
      eventBridge,
      target: this.workflow,
      eventPattern
    })
  }
}